/**
 * Schedule routes: /api/schedules/*
 * Manages recurring/scheduled task creation via cron expressions.
 */
export default function schedulesRoutes(app, shared) {
  const { db, authenticateAgent, genId } = shared;

  function actorName(req) {
    return req.actor?.display_name || req.actor?.username || req.agent?.name || null;
  }

  function formatSchedule(row) {
    return {
      id: row.id,
      title: row.title,
      cron: row.cron,
      schedule_type: row.schedule_type || 'daily',
      timezone: row.timezone,
      template_json: JSON.parse(row.template_json),
      enabled: !!row.enabled,
      mode: row.mode,
      last_run_at: row.last_run_at,
      next_run_at: row.next_run_at,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ─── List schedules ─────────────────────────────
  app.get('/api/schedules', authenticateAgent, (req, res) => {
    const rows = db.prepare('SELECT * FROM task_schedules ORDER BY created_at DESC').all();
    res.json({ schedules: rows.map(formatSchedule) });
  });

  // ─── Get single schedule ────────────────────────
  app.get('/api/schedules/:id', authenticateAgent, (req, res) => {
    const schedule = db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(formatSchedule(schedule));
  });

  // ─── Create schedule ────────────────────────────
  app.post('/api/schedules', authenticateAgent, (req, res) => {
    const { title, cron, timezone, template_json, mode, schedule_type } = req.body;
    if (!title || !cron || !template_json) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title, cron, and template_json required' });
    }

    const id = genId('sched');
    const now = Date.now();
    const creator = actorName(req);

    db.prepare(`INSERT INTO task_schedules (id, title, cron, schedule_type, timezone, template_json, mode, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, title, cron, schedule_type || 'daily', timezone || 'UTC', JSON.stringify(template_json),
        mode || 'create_task', creator, now, now);

    res.status(201).json({ schedule_id: id, title, cron, created_at: now });
  });

  // ─── Update schedule ────────────────────────────
  app.patch('/api/schedules/:id', authenticateAgent, (req, res) => {
    const schedule = db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'NOT_FOUND' });

    const { title, cron, timezone, template_json, enabled, mode } = req.body;
    const now = Date.now();
    const sets = ['updated_at = ?'];
    const params = [now];

    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (cron !== undefined) { sets.push('cron = ?'); params.push(cron); }
    if (req.body.schedule_type !== undefined) { sets.push('schedule_type = ?'); params.push(req.body.schedule_type); }
    if (timezone !== undefined) { sets.push('timezone = ?'); params.push(timezone); }
    if (template_json !== undefined) { sets.push('template_json = ?'); params.push(JSON.stringify(template_json)); }
    if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
    if (mode !== undefined) { sets.push('mode = ?'); params.push(mode); }

    params.push(req.params.id);
    db.prepare(`UPDATE task_schedules SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    res.json({ ok: true, schedule_id: schedule.id, updated_at: now });
  });

  // ─── Delete schedule ────────────────────────────
  app.delete('/api/schedules/:id', authenticateAgent, (req, res) => {
    const result = db.prepare('DELETE FROM task_schedules WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true, deleted: req.params.id });
  });

  // ─── Trigger schedule manually ──────────────────
  app.post('/api/schedules/:id/trigger', authenticateAgent, (req, res) => {
    const schedule = db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'NOT_FOUND' });

    if (shared.scheduleManager) {
      const taskId = shared.scheduleManager.createNextInstance(schedule.id, Date.now() - 1);
      res.json({ ok: true, schedule_id: schedule.id, task_id: taskId, triggered_at: Date.now() });
    } else {
      res.status(500).json({ error: 'SCHEDULE_MANAGER_NOT_READY' });
    }
  });
}
