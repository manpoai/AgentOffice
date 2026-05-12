/**
 * Memory routes: /api/memories/*
 */
export default function memoriesRoutes(app, { db, authenticateAgent, genId }) {

  function actorName(req) {
    return req.actor?.display_name || req.actor?.username || req.agent?.name || null;
  }

  function actorId(req) {
    return req.actor?.id || req.agent?.id || null;
  }

  function formatMemory(row) {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      agent_id: row.agent_id,
      source: row.source,
      related_task_id: row.related_task_id,
      tags: row.tags ? JSON.parse(row.tags) : [],
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ─── List memories ───────────────────────────────
  app.get('/api/memories', authenticateAgent, (req, res) => {
    const { agent_id, source, tag, limit = '50', offset = '0' } = req.query;
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params = [];

    if (agent_id) { sql += ' AND agent_id = ?'; params.push(agent_id); }
    if (source) { sql += ' AND source = ?'; params.push(source); }
    if (tag) { sql += " AND tags LIKE ?"; params.push(`%"${tag}"%`); }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit), 100), parseInt(offset));

    const rows = db.prepare(sql).all(...params);
    res.json({ memories: rows.map(formatMemory), total: rows.length });
  });

  // ─── List distinct agents with memory counts ────
  // Must be before /:id to avoid matching 'agents' as an ID
  app.get('/api/memories/agents/summary', authenticateAgent, (req, res) => {
    const rows = db.prepare(`
      SELECT m.agent_id, a.display_name, a.username, a.avatar_url, COUNT(*) as memory_count
      FROM memories m
      LEFT JOIN actors a ON a.id = m.agent_id
      GROUP BY m.agent_id
      ORDER BY memory_count DESC
    `).all();
    res.json({ agents: rows });
  });

  // ─── Search memories ─────────────────────────────
  app.get('/api/memories/search', authenticateAgent, (req, res) => {
    const { q, agent_id, limit = '25' } = req.query;
    if (!q) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'q (query) required' });

    let sql = "SELECT * FROM memories WHERE (title LIKE ? OR content LIKE ?)";
    const pattern = `%${q}%`;
    const params = [pattern, pattern];

    if (agent_id) { sql += ' AND agent_id = ?'; params.push(agent_id); }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(Math.min(parseInt(limit), 100));

    const rows = db.prepare(sql).all(...params);
    res.json({ memories: rows.map(formatMemory), total: rows.length });
  });

  // ─── Get single memory ──────────────────────────
  app.get('/api/memories/:id', authenticateAgent, (req, res) => {
    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
    if (!memory) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(formatMemory(memory));
  });

  // ─── Create memory ──────────────────────────────
  app.post('/api/memories', authenticateAgent, (req, res) => {
    const { title, content, agent_id, source, related_task_id, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title required' });

    const id = genId('mem');
    const now = Date.now();
    const creator = actorName(req);
    const memSource = source || (req.actor?.type === 'agent' ? 'agent' : 'human');

    db.prepare(`INSERT INTO memories (id, title, content, agent_id, source, related_task_id, tags, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, title, content || '', agent_id || actorId(req), memSource,
        related_task_id || null, tags ? JSON.stringify(tags) : null, creator, now, now);

    res.status(201).json({ memory_id: id, title, agent_id: agent_id || actorId(req), created_at: now });
  });

  // ─── Update memory ──────────────────────────────
  app.patch('/api/memories/:id', authenticateAgent, (req, res) => {
    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
    if (!memory) return res.status(404).json({ error: 'NOT_FOUND' });

    const { title, content, agent_id, tags } = req.body;
    const now = Date.now();
    const sets = ['updated_at = ?'];
    const params = [now];

    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (content !== undefined) { sets.push('content = ?'); params.push(content); }
    if (agent_id !== undefined) { sets.push('agent_id = ?'); params.push(agent_id); }
    if (tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(tags)); }

    params.push(req.params.id);
    db.prepare(`UPDATE memories SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    res.json({ ok: true, memory_id: memory.id, updated_at: now });
  });

  // ─── Delete memory ──────────────────────────────
  app.delete('/api/memories/:id', authenticateAgent, (req, res) => {
    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
    if (!memory) return res.status(404).json({ error: 'NOT_FOUND' });

    db.prepare('DELETE FROM task_attachments WHERE attachment_type = ? AND attachment_id = ?').run('memory', memory.id);
    db.prepare('DELETE FROM memories WHERE id = ?').run(memory.id);
    res.json({ ok: true, deleted: memory.id });
  });

}
