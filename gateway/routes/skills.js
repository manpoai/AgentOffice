/**
 * Skill routes: /api/skills/*
 */
export default function skillsRoutes(app, { db, authenticateAgent, genId }) {

  function actorName(req) {
    return req.actor?.display_name || req.actor?.username || req.agent?.name || null;
  }

  function formatSkill(row) {
    return {
      id: row.id,
      title: row.title,
      source: row.source,
      text: row.text,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ─── List skills ─────────────────────────────────
  app.get('/api/skills', authenticateAgent, (req, res) => {
    const { source, limit = '50', offset = '0' } = req.query;
    let sql = 'SELECT * FROM skills WHERE 1=1';
    const params = [];

    if (source) { sql += ' AND source = ?'; params.push(source); }

    sql += ' ORDER BY source DESC, title ASC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit), 100), parseInt(offset));

    const rows = db.prepare(sql).all(...params);
    res.json({ skills: rows.map(formatSkill), total: rows.length });
  });

  // ─── Get single skill ───────────────────────────
  app.get('/api/skills/:id', authenticateAgent, (req, res) => {
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    if (!skill) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(formatSkill(skill));
  });

  // ─── Create skill ───────────────────────────────
  app.post('/api/skills', authenticateAgent, (req, res) => {
    const { title, text, data_json } = req.body;
    if (!title) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title required' });

    const id = genId('skill');
    const now = Date.now();
    const creator = actorName(req);

    db.prepare(`INSERT INTO skills (id, title, text, data_json, source, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`)
      .run(id, title, text || '', data_json ? JSON.stringify(data_json) : null, creator, now, now);

    res.status(201).json({ skill_id: id, title, source: 'user', created_at: now });
  });

  // ─── Update skill ───────────────────────────────
  app.patch('/api/skills/:id', authenticateAgent, (req, res) => {
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    if (!skill) return res.status(404).json({ error: 'NOT_FOUND' });
    if (skill.source === 'builtin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot edit builtin skills' });
    }

    const { title, text, data_json } = req.body;
    const now = Date.now();
    const sets = ['updated_at = ?'];
    const params = [now];

    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (text !== undefined) { sets.push('text = ?'); params.push(text); }
    if (data_json !== undefined) { sets.push('data_json = ?'); params.push(JSON.stringify(data_json)); }

    params.push(req.params.id);
    db.prepare(`UPDATE skills SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    res.json({ ok: true, skill_id: skill.id, updated_at: now });
  });

  // ─── Delete skill ───────────────────────────────
  app.delete('/api/skills/:id', authenticateAgent, (req, res) => {
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    if (!skill) return res.status(404).json({ error: 'NOT_FOUND' });
    if (skill.source === 'builtin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot delete builtin skills' });
    }

    db.prepare('DELETE FROM task_attachments WHERE attachment_type = ? AND attachment_id = ?').run('skill', skill.id);
    db.prepare('DELETE FROM skills WHERE id = ?').run(skill.id);
    res.json({ ok: true, deleted: skill.id });
  });
}
