import { Cron } from 'croner';

export function createTaskWatcher(db, { genId, pushEvent, broadcastHumanEvent }) {
  const timers = new Map();
  let scheduleManager = null;

  function setScheduleManager(sm) { scheduleManager = sm; }

  function schedule(taskId) {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND status = 'todo'").get(taskId);
    if (!task || !task.assignee_id || task.notified_at) return;

    const now = Date.now();
    if (!task.due_at || task.due_at <= now) {
      notify(task);
    } else {
      const delay = task.due_at - now;
      const timerId = setTimeout(() => {
        timers.delete(taskId);
        const fresh = db.prepare("SELECT * FROM tasks WHERE id = ? AND status = 'todo' AND notified_at IS NULL").get(taskId);
        if (fresh && fresh.assignee_id) notify(fresh);
      }, delay);
      timers.set(taskId, timerId);
      console.log(`[task-watcher] Timer set for ${taskId} in ${Math.round(delay / 1000)}s (due ${new Date(task.due_at).toISOString()})`);
    }
  }

  function cancel(taskId) {
    const timerId = timers.get(taskId);
    if (timerId) {
      clearTimeout(timerId);
      timers.delete(taskId);
    }
  }

  function reschedule(taskId) {
    cancel(taskId);
    schedule(taskId);
  }

  function notify(task) {
    const now = Date.now();

    db.prepare('UPDATE tasks SET notified_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, task.id);

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

    console.log(`[task-watcher] Notified ${task.assignee_id} for task ${task.id}`);

    if (task.schedule_id && scheduleManager) {
      const sched = db.prepare('SELECT * FROM task_schedules WHERE id = ? AND enabled = 1').get(task.schedule_id);
      if (sched && sched.schedule_type !== 'once') {
        scheduleManager.createNextInstance(task.schedule_id, task.due_at || now);
      } else if (sched && sched.schedule_type === 'once') {
        scheduleManager.disable(task.schedule_id);
      }
    }
  }

  function recover() {
    const tasks = db.prepare(
      "SELECT * FROM tasks WHERE status = 'todo' AND assignee_id IS NOT NULL AND notified_at IS NULL"
    ).all();

    let immediate = 0, scheduled = 0;
    for (const task of tasks) {
      const now = Date.now();
      if (!task.due_at || task.due_at <= now) {
        notify(task);
        immediate++;
      } else {
        schedule(task.id);
        scheduled++;
      }
    }
    console.log(`[task-watcher] Recovered: ${immediate} notified immediately, ${scheduled} timers set`);
  }

  recover();
  return { schedule, cancel, reschedule, setScheduleManager };
}
