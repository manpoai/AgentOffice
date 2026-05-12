import { Cron } from 'croner';

export function createScheduleManager(db, { genId, broadcastHumanEvent, taskWatcher }) {

  function createNextInstance(scheduleId, afterTs) {
    const sched = db.prepare('SELECT * FROM task_schedules WHERE id = ? AND enabled = 1').get(scheduleId);
    if (!sched) return null;

    const template = JSON.parse(sched.template_json);
    const opts = { timezone: sched.timezone || 'UTC' };

    let nextDueAt = null;
    try {
      const job = new Cron(sched.cron, opts);
      let next = job.nextRun();
      while (next && next.getTime() <= afterTs) {
        next = job.nextRun(next);
      }
      if (next) nextDueAt = next.getTime();
      job.stop();
    } catch (e) {
      console.error(`[schedule-manager] Failed to compute next run for ${scheduleId}: ${e.message}`);
      return null;
    }

    if (!nextDueAt) return null;

    const existing = db.prepare(
      'SELECT id FROM tasks WHERE schedule_id = ? AND due_at = ?'
    ).get(scheduleId, nextDueAt);
    if (existing) {
      console.log(`[schedule-manager] Task already exists for schedule ${scheduleId} at ${new Date(nextDueAt).toISOString()}, skipping`);
      return existing.id;
    }

    const now = Date.now();
    const taskId = genId('task');

    try {
      db.prepare(`INSERT INTO tasks (id, title, text, status, priority, assignee_id, due_at, schedule_id, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)`)
        .run(taskId, template.title || sched.title, template.text || null,
          template.priority || 'medium', template.assignee_id || null,
          nextDueAt, sched.id, `schedule:${sched.id}`, now, now);

      const attachments = template.attachments || [];
      for (const att of attachments) {
        const attId = genId('tatt');
        db.prepare('INSERT INTO task_attachments (id, task_id, attachment_type, attachment_id, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(attId, taskId, att.type, att.id, now);
      }
    } catch (e) {
      console.error(`[schedule-manager] Failed to create task for schedule ${scheduleId}: ${e.message}`);
      return null;
    }

    db.prepare('UPDATE task_schedules SET next_run_at = ?, updated_at = ? WHERE id = ?')
      .run(nextDueAt, now, sched.id);

    broadcastHumanEvent({ event: 'task.created', data: { task_id: taskId, title: template.title || sched.title, from_schedule: sched.id } });
    console.log(`[schedule-manager] Created task ${taskId} (due ${new Date(nextDueAt).toISOString()}) for schedule ${sched.id}`);

    taskWatcher.schedule(taskId);

    return taskId;
  }

  function disable(scheduleId) {
    const now = Date.now();
    db.prepare('UPDATE task_schedules SET enabled = 0, last_run_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, scheduleId);
    console.log(`[schedule-manager] Disabled schedule ${scheduleId}`);
  }

  return { createNextInstance, disable };
}
