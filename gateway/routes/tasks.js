/**
 * Task routes: /api/tasks/*
 */
import {
  createUnifiedComment, listUnifiedComments,
  updateUnifiedCommentText, deleteUnifiedComment, setUnifiedCommentResolved,
} from '../lib/comment-service.js';

export default function tasksRoutes(app, shared) {
  const { db, authenticateAgent, genId, pushEvent, pushHumanEvent, broadcastHumanEvent, humanClients, deliverWebhook } = shared;

  function actorName(req) {
    return req.actor?.display_name || req.actor?.username || req.agent?.name || null;
  }

  function actorId(req) {
    return req.actor?.id || req.agent?.id || null;
  }

  function formatTask(row) {
    return {
      id: row.id,
      title: row.title,
      text: row.text || null,
      status: row.status,
      priority: row.priority,
      assignee_id: row.assignee_id,
      created_by: row.created_by,
      due_at: row.due_at,
      completed_at: row.completed_at,
      notified_at: row.notified_at,
      parent_task_id: row.parent_task_id,
      schedule_id: row.schedule_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ─── List tasks ──────────────────────────────────
  app.get('/api/tasks', authenticateAgent, (req, res) => {
    const { status, assignee_id, priority, parent_task_id, limit = '50', offset = '0' } = req.query;
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (assignee_id) { sql += ' AND assignee_id = ?'; params.push(assignee_id); }
    if (priority) { sql += ' AND priority = ?'; params.push(priority); }
    if (parent_task_id) { sql += ' AND parent_task_id = ?'; params.push(parent_task_id); }
    if (parent_task_id === 'null') { sql = sql.replace('AND parent_task_id = ?', 'AND parent_task_id IS NULL'); params.pop(); }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit), 100), parseInt(offset));

    const rows = db.prepare(sql).all(...params);
    res.json({ tasks: rows.map(formatTask), total: rows.length });
  });

  // ─── Get single task ─────────────────────────────
  app.get('/api/tasks/:id', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });

    const attachments = db.prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at ASC').all(task.id);
    res.json({ ...formatTask(task), attachments });
  });

  // ─── Task activity (status changes from sync log) ─
  app.get('/api/tasks/:id/activity', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });

    const rows = db.prepare(
      'SELECT id, operation, data_json, actor_id, timestamp FROM _sync_log WHERE table_name = ? AND row_id = ? ORDER BY timestamp ASC'
    ).all('tasks', task.id);

    const actorCache = {};
    function resolveActor(id) {
      if (!id) return 'System';
      if (actorCache[id]) return actorCache[id];
      const actor = db.prepare('SELECT display_name, username FROM actors WHERE id = ?').get(id)
        || db.prepare('SELECT display_name, username FROM actors WHERE username = ? OR display_name = ?').get(id, id);
      const name = actor?.display_name || actor?.username || id;
      actorCache[id] = name;
      return name;
    }

    const activity = [];
    let prevStatus = null;
    let prevAssignee = null;
    let prevPriority = null;

    for (const row of rows) {
      let data;
      try { data = JSON.parse(row.data_json); } catch { continue; }

      if (row.operation === 'insert') {
        activity.push({
          type: 'created',
          actor: resolveActor(row.actor_id),
          timestamp: row.timestamp,
          detail: { status: data.status, assignee_id: data.assignee_id },
        });
        prevStatus = data.status;
        prevAssignee = data.assignee_id;
        prevPriority = data.priority;
        continue;
      }

      if (data.status && data.status !== prevStatus) {
        activity.push({
          type: 'status_change',
          actor: resolveActor(row.actor_id),
          timestamp: row.timestamp,
          detail: { from: prevStatus, to: data.status },
        });
        prevStatus = data.status;
      }

      if (data.assignee_id !== undefined && data.assignee_id !== prevAssignee) {
        activity.push({
          type: 'assignee_change',
          actor: resolveActor(row.actor_id),
          timestamp: row.timestamp,
          detail: { from: prevAssignee, to: data.assignee_id },
        });
        prevAssignee = data.assignee_id;
      }

      if (data.priority && data.priority !== prevPriority) {
        activity.push({
          type: 'priority_change',
          actor: resolveActor(row.actor_id),
          timestamp: row.timestamp,
          detail: { from: prevPriority, to: data.priority },
        });
        prevPriority = data.priority;
      }
    }

    res.json({ activity });
  });

  const stampSyncActor = db.prepare(
    'UPDATE _sync_log SET actor_id = ? WHERE id = (SELECT MAX(id) FROM _sync_log WHERE table_name = ? AND row_id = ?)'
  );

  // ─── Create task ─────────────────────────────────
  app.post('/api/tasks', authenticateAgent, (req, res) => {
    const { title, status, priority, assignee_id, due_at, parent_task_id, text, data_json } = req.body;
    if (!title) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title required' });

    const id = genId('task');
    const now = Date.now();
    const creator = actorName(req);

    db.prepare(`INSERT INTO tasks (id, title, text, data_json, status, priority, assignee_id, created_by, due_at, parent_task_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, title, text || null, data_json ? JSON.stringify(data_json) : null,
        status || 'todo', priority || 'medium', assignee_id || null,
        creator, due_at || null, parent_task_id || null, now, now);
    stampSyncActor.run(actorId(req), 'tasks', id);

    if (assignee_id && shared.taskWatcher) {
      shared.taskWatcher.schedule(id);
    }

    broadcastHumanEvent({ event: 'task.created', data: { task_id: id, title } });
    res.status(201).json({ task_id: id, title, status: status || 'todo', created_at: now });
  });

  // ─── Update task ─────────────────────────────────
  app.patch('/api/tasks/:id', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });

    const { title, status, priority, assignee_id, due_at, text, data_json, schedule_id } = req.body;
    const now = Date.now();
    const sets = ['updated_at = ?'];
    const params = [now];

    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (status !== undefined) {
      sets.push('status = ?'); params.push(status);
      if (status === 'done' || status === 'failed') { sets.push('completed_at = ?'); params.push(now); }
    }
    if (priority !== undefined) { sets.push('priority = ?'); params.push(priority); }
    if (assignee_id !== undefined) { sets.push('assignee_id = ?'); params.push(assignee_id); }
    if (due_at !== undefined) { sets.push('due_at = ?'); params.push(due_at); }
    if (text !== undefined) { sets.push('text = ?'); params.push(text); }
    if (data_json !== undefined) { sets.push('data_json = ?'); params.push(JSON.stringify(data_json)); }
    if (schedule_id !== undefined) { sets.push('schedule_id = ?'); params.push(schedule_id); }

    params.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    stampSyncActor.run(actorId(req), 'tasks', req.params.id);

    if (shared.taskWatcher) {
      const needsReschedule =
        (assignee_id !== undefined && assignee_id !== task.assignee_id) ||
        (due_at !== undefined && due_at !== task.due_at);

      if (needsReschedule) {
        if (assignee_id !== undefined || due_at !== undefined) {
          db.prepare('UPDATE tasks SET notified_at = NULL WHERE id = ?').run(req.params.id);
        }
        const effectiveAssignee = assignee_id !== undefined ? assignee_id : task.assignee_id;
        if (effectiveAssignee) {
          shared.taskWatcher.reschedule(req.params.id);
        } else {
          shared.taskWatcher.cancel(req.params.id);
        }
      }
    }

    broadcastHumanEvent({ event: 'task.updated', data: { task_id: task.id, status: status || task.status } });
    res.json({ ok: true, task_id: task.id, updated_at: now });
  });

  // ─── Update task status ──────────────────────────
  app.patch('/api/tasks/:id/status', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'status required' });
    const now = Date.now();
    const completedAt = (status === 'done' || status === 'failed') ? now : null;
    db.prepare('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?')
      .run(status, completedAt, now, task.id);
    stampSyncActor.run(actorId(req), 'tasks', task.id);
    if (task.assignee_id) {
      pushEvent(task.assignee_id, { event: 'task.updated', data: { task_id: task.id, status } });
    }
    broadcastHumanEvent({ event: 'task.updated', data: { task_id: task.id, status } });
    res.json({ ok: true, task_id: task.id, status, updated_at: now });
  });

  // ─── Get task attachments ──────────────────────────
  app.get('/api/tasks/:id/attachments', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });
    const attachments = db.prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at ASC').all(task.id);
    res.json({ attachments });
  });

  // ─── Delete task ─────────────────────────────────
  app.delete('/api/tasks/:id', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });

    const deleteSchedule = req.query.delete_schedule === 'true';

    if (deleteSchedule && task.schedule_id) {
      const relatedTasks = db.prepare('SELECT id FROM tasks WHERE schedule_id = ?').all(task.schedule_id);
      for (const t of relatedTasks) {
        if (shared.taskWatcher) shared.taskWatcher.cancel(t.id);
        db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(t.id);
        db.prepare('DELETE FROM comments WHERE target_id = ?').run(`task:${t.id}`);
      }
      db.prepare('DELETE FROM tasks WHERE schedule_id = ?').run(task.schedule_id);
      db.prepare('DELETE FROM task_schedules WHERE id = ?').run(task.schedule_id);
      broadcastHumanEvent({ event: 'task.deleted', data: { task_id: task.id, schedule_deleted: task.schedule_id } });
      res.json({ ok: true, deleted: task.id, schedule_deleted: task.schedule_id });
    } else {
      if (shared.taskWatcher) shared.taskWatcher.cancel(task.id);
      db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(task.id);
      db.prepare('DELETE FROM comments WHERE target_id = ?').run(`task:${task.id}`);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
      broadcastHumanEvent({ event: 'task.deleted', data: { task_id: task.id } });

      if (task.schedule_id && shared.scheduleManager) {
        const sched = db.prepare('SELECT schedule_type FROM task_schedules WHERE id = ?').get(task.schedule_id);
        if (sched && sched.schedule_type !== 'once') {
          shared.scheduleManager.createNextInstance(task.schedule_id, task.due_at || Date.now());
        }
      }

      res.json({ ok: true, deleted: task.id });
    }
  });

  // ─── Task attachments ────────────────────────────
  app.post('/api/tasks/:id/attachments', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });

    const { attachment_type, attachment_id } = req.body;
    if (!attachment_type || !attachment_id) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'attachment_type and attachment_id required' });
    }

    const id = genId('tatt');
    const now = Date.now();
    db.prepare('INSERT INTO task_attachments (id, task_id, attachment_type, attachment_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, task.id, attachment_type, attachment_id, now);

    res.status(201).json({ id, task_id: task.id, attachment_type, attachment_id, created_at: now });
  });

  app.delete('/api/tasks/:task_id/attachments/:att_id', authenticateAgent, (req, res) => {
    const result = db.prepare('DELETE FROM task_attachments WHERE id = ? AND task_id = ?')
      .run(req.params.att_id, req.params.task_id);
    if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  });

  // ─── Task comments (unified comment service) ────
  app.post('/api/tasks/:id/comments', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });

    const { text, parent_comment_id } = req.body;
    if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });

    const comment = createUnifiedComment(db,
      { genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook },
      {
        targetType: 'task',
        targetId: `task:${task.id}`,
        text,
        parentId: parent_comment_id || null,
        actorId: actorId(req),
        actorName: actorName(req),
        idPrefix: 'tcmt',
      }
    );

    res.status(201).json(comment);
  });

  app.get('/api/tasks/:id/comments', authenticateAgent, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND' });
    const comments = listUnifiedComments(db, `task:${task.id}`);
    res.json({ comments });
  });

  app.patch('/api/tasks/:id/comments/:commentId', authenticateAgent, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });
    const result = updateUnifiedCommentText(db,
      { genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook },
      req.params.commentId, text
    );
    if (!result) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(result);
  });

  app.delete('/api/tasks/:id/comments/:commentId', authenticateAgent, (req, res) => {
    const result = deleteUnifiedComment(db,
      { genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook },
      req.params.commentId
    );
    if (!result) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  });

  app.post('/api/tasks/:id/comments/:commentId/resolve', authenticateAgent, (req, res) => {
    const result = setUnifiedCommentResolved(db,
      { genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook },
      req.params.commentId, true, actorId(req), actorName(req)
    );
    if (!result) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(result);
  });

  app.post('/api/tasks/:id/comments/:commentId/unresolve', authenticateAgent, (req, res) => {
    const result = setUnifiedCommentResolved(db,
      { genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook },
      req.params.commentId, false, actorId(req), actorName(req)
    );
    if (!result) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(result);
  });
}
