import { Cron } from 'croner';

export function startScheduleRunner(db, { genId, pushEvent, broadcastHumanEvent }) {
  const jobs = new Map();

  function loadAndStart() {
    for (const [, job] of jobs) job.stop();
    jobs.clear();

    const schedules = db.prepare('SELECT * FROM task_schedules WHERE enabled = 1').all();
    for (const sched of schedules) {
      try {
        startJob(sched);
      } catch (e) {
        console.error(`[schedule-runner] Failed to start job ${sched.id}: ${e.message}`);
      }
    }
    console.log(`[schedule-runner] Loaded ${jobs.size} active schedule(s)`);
  }

  function startJob(sched) {
    const opts = { timezone: sched.timezone || 'UTC' };

    if (sched.schedule_type === 'once') {
      const job = new Cron(sched.cron, opts, () => notifyOnceTask(sched.id));
      jobs.set(sched.id, job);
      return;
    }

    const job = new Cron(sched.cron, opts, () => triggerRecurring(sched.id));
    jobs.set(sched.id, job);

    const nextRun = job.nextRun();
    if (nextRun) {
      db.prepare('UPDATE task_schedules SET next_run_at = ?, updated_at = ? WHERE id = ?')
        .run(nextRun.getTime(), Date.now(), sched.id);
    }
  }

  // ── Once: notify agent for the existing task, then disable ──
  function notifyOnceTask(schedId) {
    const sched = db.prepare('SELECT * FROM task_schedules WHERE id = ? AND enabled = 1').get(schedId);
    if (!sched) return;

    const task = db.prepare("SELECT * FROM tasks WHERE schedule_id = ? AND status = 'todo'").get(schedId);
    if (!task || !task.assignee_id) {
      db.prepare('UPDATE task_schedules SET enabled = 0, updated_at = ? WHERE id = ?').run(Date.now(), schedId);
      jobs.get(schedId)?.stop();
      jobs.delete(schedId);
      return;
    }

    const now = Date.now();
    notifyAgent(task, now);

    db.prepare('UPDATE task_schedules SET enabled = 0, last_run_at = ?, updated_at = ? WHERE id = ?').run(now, now, schedId);
    jobs.get(schedId)?.stop();
    jobs.delete(schedId);
    console.log(`[schedule-runner] Once ${schedId} → notified agent for ${task.id}`);
  }

  // ── Recurring (daily/weekly): notify current task + create next task ──
  function triggerRecurring(schedId) {
    const sched = db.prepare('SELECT * FROM task_schedules WHERE id = ? AND enabled = 1').get(schedId);
    if (!sched) return;

    const now = Date.now();
    const template = JSON.parse(sched.template_json);

    // 1. Find the pending task whose due_at is now (or closest past) → notify agent
    const pendingTask = db.prepare("SELECT * FROM tasks WHERE schedule_id = ? AND status = 'todo' ORDER BY due_at ASC LIMIT 1").get(sched.id);
    if (pendingTask && pendingTask.assignee_id) {
      notifyAgent(pendingTask, now);
      console.log(`[schedule-runner] Recurring ${schedId} → notified agent for ${pendingTask.id}`);
    }

    // 2. Create next task instance with due_at = next cron time
    const job = jobs.get(sched.id);
    const nextRun = job?.nextRun();
    if (nextRun) {
      createTaskInstance(sched, template, nextRun.getTime(), now);
    }

    db.prepare('UPDATE task_schedules SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?')
      .run(now, nextRun ? nextRun.getTime() : null, now, sched.id);
  }

  // ── Manual trigger: create next task after a given timestamp (used by delete-single-instance) ──
  function triggerManual(schedId, afterTs) {
    const sched = db.prepare('SELECT * FROM task_schedules WHERE id = ? AND enabled = 1').get(schedId);
    if (!sched) return;

    const template = JSON.parse(sched.template_json);
    const now = Date.now();
    const job = jobs.get(sched.id);
    if (!job) return;

    let nextRun = job.nextRun();
    while (nextRun && nextRun.getTime() <= afterTs) {
      nextRun = job.nextRun(nextRun);
    }
    if (!nextRun) return;

    createTaskInstance(sched, template, nextRun.getTime(), now);

    db.prepare('UPDATE task_schedules SET next_run_at = ?, updated_at = ? WHERE id = ?')
      .run(nextRun.getTime(), now, sched.id);
  }

  // ── Shared: create a task instance from schedule template ──
  function createTaskInstance(sched, template, dueAt, now) {
    const taskId = genId('task');

    db.prepare(`INSERT INTO tasks (id, title, text, status, priority, assignee_id, due_at, schedule_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)`)
      .run(taskId, template.title || sched.title, template.text || null,
        template.priority || 'medium', template.assignee_id || null,
        dueAt, sched.id, `schedule:${sched.id}`, now, now);

    const attachments = template.attachments || [];
    for (const att of attachments) {
      const attId = genId('tatt');
      db.prepare('INSERT INTO task_attachments (id, task_id, attachment_type, attachment_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(attId, taskId, att.type, att.id, now);
    }

    broadcastHumanEvent({ event: 'task.created', data: { task_id: taskId, title: template.title || sched.title, from_schedule: sched.id } });
    console.log(`[schedule-runner] Created task ${taskId} (due ${new Date(dueAt).toISOString()}) for schedule ${sched.id}`);
    return taskId;
  }

  // ── Shared: push task.assigned event to agent ──
  function notifyAgent(task, now) {
    const payload = {
      event: 'task.assigned',
      task_id: task.id,
      title: task.title,
      assignee_id: task.assignee_id,
      created_by: task.created_by,
      occurred_at: now,
    };
    const eventId = genId('evt');
    db.prepare('INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(eventId, task.assignee_id, 'task.assigned', 'gateway', now, JSON.stringify(payload), now);
    pushEvent(task.assignee_id, payload);
  }

  function reload() {
    loadAndStart();
  }

  // Public API: triggerSchedule called by task deletion (manual next instance)
  function triggerSchedule(schedId, { manual, afterTs } = {}) {
    if (manual) {
      triggerManual(schedId, afterTs);
    } else {
      triggerRecurring(schedId);
    }
  }

  loadAndStart();
  return { reload, triggerSchedule };
}
