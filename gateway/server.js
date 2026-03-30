#!/usr/bin/env node
/**
 * ASuite API Gateway
 * Implements Agent接入协议v1: registration, docs, data, events
 * Routes operations to Baserow, with local SQLite for docs
 */

import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import multer from 'multer';
import jwt from 'jsonwebtoken';

import {
  BR_URL, BR_EMAIL, BR_PASSWORD, BR_DATABASE_ID, BR_TOKEN,
  getBrJwt, br,
  UIDT_TO_BR, BR_TO_UIDT,
  parseNcWhere, NC_OP_TO_BR, buildBaserowFilterParams, buildBaserowOrderBy,
  BR_VIEW_TYPE_MAP, BR_VIEW_TYPE_NUM,
  getTableFields, invalidateFieldCache, getFieldMap,
  normalizeRowForGateway, normalizeRowForBaserow,
  buildFieldCreateBody,
} from './baserow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.GATEWAY_PORT || 4000;

// Upstream service URLs and tokens (Baserow, NC_ prefix kept for migration compat)
const NC_URL = process.env.NOCODB_URL || 'http://localhost:8080';
const NC_EMAIL = process.env.BASEROW_EMAIL || process.env.NOCODB_EMAIL;
const NC_PASSWORD = process.env.BASEROW_PASSWORD || process.env.NOCODB_PASSWORD;
const NC_BASE_ID = process.env.BASEROW_DATABASE_ID || process.env.NOCODB_BASE_ID || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(32).toString('hex');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ─── Database ────────────────────────────────────
const DB_PATH = process.env.GATEWAY_DB_PATH || path.join(__dirname, 'gateway.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
const schema = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
db.exec(schema);

// Migrate: add nc_password column if not present
try {
  db.exec('ALTER TABLE agent_accounts ADD COLUMN nc_password TEXT');
  console.log('[gateway] DB migrated: added nc_password column');
} catch { /* already exists */ }

// Migrate: add pending_approval column
try {
  db.exec('ALTER TABLE agent_accounts ADD COLUMN pending_approval INTEGER DEFAULT 0');
  console.log('[gateway] DB migrated: added pending_approval column');
} catch { /* already exists */ }

// Migrate: add avatar_url column
try {
  db.exec('ALTER TABLE agent_accounts ADD COLUMN avatar_url TEXT');
  console.log('[gateway] DB migrated: added avatar_url column');
} catch { /* already exists */ }

// Migrate: create table_snapshots table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS table_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    schema_json TEXT NOT NULL,
    data_json TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    agent TEXT,
    row_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_snapshots_table ON table_snapshots(table_id, version DESC)');
} catch { /* already exists */ }

// Migrate: create thread_links table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS thread_links (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, link_type TEXT NOT NULL,
    link_id TEXT NOT NULL, link_title TEXT, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_thread_links_thread ON thread_links(thread_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_thread_links_link ON thread_links(link_type, link_id)');
} catch { /* already exists */ }

// Migrate: create boards table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}}',
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
} catch { /* already exists */ }

// Migrate: create presentations table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{"slides":[]}',
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
} catch { /* already exists */ }

// Migrate: create spreadsheets table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS spreadsheets (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
} catch { /* already exists */ }

// Migrate: create diagrams table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
} catch { /* already exists */ }

// Migrate: create documents table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    data_json TEXT,
    icon TEXT,
    full_width INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`);
} catch { /* already exists */ }

// Migrate: create document_revisions table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS document_revisions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    data_json TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_doc_revisions_doc ON document_revisions(document_id)`);
} catch { /* already exists */ }

// Migrate: create document_comments table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS document_comments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    parent_id TEXT,
    data_json TEXT,
    actor TEXT,
    actor_id TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_doc_comments_doc ON document_comments(document_id)`);
} catch { /* already exists */ }

// Migrate: FTS5 virtual table and sync triggers for documents
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED, title, text, content='documents', content_rowid='rowid'
)`);
db.exec(`CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(id, title, text) VALUES (new.id, new.title, new.text);
END`);
db.exec(`CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
  DELETE FROM documents_fts WHERE id = old.id;
  INSERT INTO documents_fts(id, title, text) VALUES (new.id, new.title, new.text);
END`);
db.exec(`CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  DELETE FROM documents_fts WHERE id = old.id;
END`);

// ─── Migrate: actors table (unified human + agent identity) ─────
try {
  const agents = db.prepare('SELECT * FROM agent_accounts').all();
  const insert = db.prepare(`INSERT OR IGNORE INTO actors (id, type, username, display_name, avatar_url, token_hash, capabilities, webhook_url, webhook_secret, online, last_seen_at, created_at, updated_at) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let migrated = 0;
  for (const a of agents) {
    const result = insert.run(a.id, a.name, a.display_name, a.avatar_url || null, a.token_hash, a.capabilities || null, a.webhook_url || null, a.webhook_secret || null, a.online || 0, a.last_seen_at || null, a.created_at, a.updated_at);
    if (result.changes > 0) migrated++;
  }
  if (migrated > 0) console.log(`[gateway] Migrated ${migrated} agents to actors table`);
} catch (e) { /* actors table not yet created or already migrated */ }

// Migrate: create notifications table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    target_actor_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_actor_id, read, created_at DESC)');
} catch { /* already exists */ }

// Migrate: add pinned column to content_items
try {
  db.exec('ALTER TABLE content_items ADD COLUMN pinned INTEGER DEFAULT 0');
  console.log('[gateway] DB migrated: added pinned column to content_items');
} catch { /* already exists */ }

// Migrate: create content_comments table (generic comments for presentations, diagrams, etc.)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS content_comments (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    text TEXT NOT NULL,
    author TEXT,
    actor_id TEXT,
    parent_comment_id TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_content_comments_content ON content_comments(content_id)');
} catch { /* already exists */ }

// Migrate: create content_revisions table (generic revisions for presentations, diagrams, etc.)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS content_revisions (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_content_revisions_content ON content_revisions(content_id, created_at DESC)');
} catch { /* already exists */ }

// ─── Helpers ─────────────────────────────────────
function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const result = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(result, 'hex'));
}

// Create default admin user if none exists
{
  const adminExists = db.prepare("SELECT id FROM actors WHERE type = 'human' AND role = 'admin'").get();
  if (!adminExists) {
    const adminId = genId('act');
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
    db.prepare(`INSERT INTO actors (id, type, username, display_name, password_hash, role, created_at, updated_at) VALUES (?, 'human', 'admin', 'Administrator', ?, 'admin', ?, ?)`)
      .run(adminId, hashPassword(defaultPassword), Date.now(), Date.now());
    console.log(`[gateway] Created default admin user (username: admin, password: ${defaultPassword})`);
  }
}

async function upstream(baseUrl, method, apiPath, body, token, extraHeaders = {}) {
  const url = `${baseUrl}${apiPath}`;
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (extraHeaders['X-API-Key']) delete headers['Authorization'];

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

// ─── Auth middleware ─────────────────────────────
function authenticateAny(req, res, next) {
  const auth = req.headers.authorization;
  const queryToken = req.query.token;
  let token;
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (queryToken) {
    token = queryToken;
  } else {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authorization' });
  }

  // Try JWT first (human auth)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const actor = db.prepare('SELECT * FROM actors WHERE id = ?').get(decoded.actor_id);
    if (actor) {
      req.actor = { id: actor.id, type: actor.type, username: actor.username, display_name: actor.display_name, role: actor.role, avatar_url: actor.avatar_url };
      // Backward compat: set req.agent for existing code that uses req.agent
      req.agent = { id: actor.id, name: actor.username, display_name: actor.display_name, capabilities: actor.capabilities };
      return next();
    }
  } catch (e) { /* not a JWT, try agent token */ }

  // Try agent token hash (actors table)
  const hash = hashToken(token);
  const agent = db.prepare('SELECT * FROM actors WHERE token_hash = ?').get(hash);
  if (agent) {
    db.prepare('UPDATE actors SET last_seen_at = ?, online = 1 WHERE id = ?').run(Date.now(), agent.id);
    req.actor = { id: agent.id, type: 'agent', username: agent.username, display_name: agent.display_name, role: 'agent', avatar_url: agent.avatar_url };
    req.agent = { id: agent.id, name: agent.username, display_name: agent.display_name, capabilities: agent.capabilities };
    return next();
  }

  // Fallback: try legacy agent_accounts table
  const legacyAgent = db.prepare('SELECT * FROM agent_accounts WHERE token_hash = ?').get(hash);
  if (legacyAgent) {
    db.prepare('UPDATE agent_accounts SET last_seen_at = ?, online = 1 WHERE id = ?').run(Date.now(), legacyAgent.id);
    req.actor = { id: legacyAgent.id, type: 'agent', username: legacyAgent.name, display_name: legacyAgent.display_name, role: 'agent', avatar_url: legacyAgent.avatar_url };
    req.agent = legacyAgent;
    return next();
  }

  return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
}

// Keep backward-compat alias
const authenticateAgent = authenticateAny;

function authenticateAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid admin token' });
  }
  const token = auth.slice(7);

  // Accept ADMIN_TOKEN
  if (token === ADMIN_TOKEN) return next();

  // Accept human JWT with admin role
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const actor = db.prepare("SELECT * FROM actors WHERE id = ? AND type = 'human' AND role = 'admin'").get(decoded.actor_id);
    if (actor) {
      req.actor = { id: actor.id, type: actor.type, username: actor.username, display_name: actor.display_name, role: actor.role };
      req.agent = { id: actor.id, name: actor.username, display_name: actor.display_name };
      return next();
    }
  } catch (e) { /* not a valid JWT */ }

  return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid admin token' });
}

// ─── App ─────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '50mb' }));

// ─── Human Auth ──────────────────────────────────
// POST /api/auth/login — human login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const actor = db.prepare("SELECT * FROM actors WHERE username = ? AND type = 'human'").get(username);
  if (!actor || !actor.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

  if (!verifyPassword(password, actor.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ actor_id: actor.id, type: 'human', username: actor.username, role: actor.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, actor: { id: actor.id, username: actor.username, display_name: actor.display_name, role: actor.role, avatar_url: actor.avatar_url } });
});

// GET /api/auth/me — get current user (works for both human JWT and agent Bearer)
app.get('/api/auth/me', authenticateAny, (req, res) => {
  const a = req.actor;
  res.json({ id: a.id, type: a.type, username: a.username, display_name: a.display_name, role: a.role, avatar_url: a.avatar_url });
});

// PATCH /api/auth/password — change password (human only)
app.patch('/api/auth/password', authenticateAny, (req, res) => {
  if (req.actor.type !== 'human') return res.status(403).json({ error: 'Agents cannot change password' });
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required' });

  const actor = db.prepare('SELECT password_hash FROM actors WHERE id = ?').get(req.actor.id);
  if (!verifyPassword(current_password, actor.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('UPDATE actors SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hashPassword(new_password), Date.now(), req.actor.id);
  res.json({ ok: true });
});

// ─── Admin: Create ticket ────────────────────────
app.post('/api/admin/tickets', authenticateAdmin, (req, res) => {
  const { label, expires_in = 86400 } = req.body;
  const id = `tkt_${crypto.randomBytes(16).toString('hex')}`;
  const now = Date.now();
  db.prepare('INSERT INTO tickets (id, label, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(id, label || '', now + expires_in * 1000, now);
  res.json({ ticket: id, expires_at: now + expires_in * 1000 });
});

// ─── Auth: Register agent ────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { ticket, name, display_name, capabilities, webhook_url, webhook_secret } = req.body;
  if (!ticket || !name || !display_name) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'ticket, name, display_name required' });
  }
  // Validate ticket
  const tkt = db.prepare('SELECT * FROM tickets WHERE id = ? AND used = 0').get(ticket);
  if (!tkt) {
    return res.status(400).json({ error: 'INVALID_TICKET', message: 'Ticket not found or already used' });
  }
  if (Date.now() > tkt.expires_at) {
    return res.status(400).json({ error: 'TICKET_EXPIRED', message: 'Ticket has expired' });
  }
  // Check name uniqueness (both tables)
  const existing = db.prepare('SELECT id FROM agent_accounts WHERE name = ?').get(name);
  const existingActor = db.prepare('SELECT id FROM actors WHERE username = ?').get(name);
  if (existing || existingActor) {
    return res.status(409).json({ error: 'NAME_TAKEN', message: `Name "${name}" already registered` });
  }
  // Create agent
  const agentId = genId('agt');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = Date.now();

  db.prepare(`INSERT INTO agent_accounts (id, name, display_name, token_hash, capabilities, webhook_url, webhook_secret, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(agentId, name, display_name, tokenHash, JSON.stringify(capabilities || []),
      webhook_url || null, webhook_secret || null, now, now);

  // Also insert into actors table
  db.prepare(`INSERT OR IGNORE INTO actors (id, type, username, display_name, token_hash, capabilities, webhook_url, webhook_secret, created_at, updated_at) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(agentId, name, display_name, tokenHash, JSON.stringify(capabilities || []),
      webhook_url || null, webhook_secret || null, now, now);

  // Mark ticket used
  db.prepare('UPDATE tickets SET used = 1 WHERE id = ?').run(ticket);

  // Create a Baserow user for this agent
  createNcUser(name, display_name).then(ncPassword => {
    if (ncPassword) {
      db.prepare('UPDATE agent_accounts SET nc_password = ? WHERE id = ?').run(ncPassword, agentId);
    }
  }).catch(e => console.warn(`[gateway] NC user creation failed: ${e.message}`));

  res.json({ agent_id: agentId, token, name, display_name, created_at: now });
});

// ─── Auth: Verify ────────────────────────────────
app.get('/api/me', authenticateAny, (req, res) => {
  const a = req.actor;
  // Return unified actor info + backward-compatible agent fields
  res.json({
    id: a.id, type: a.type, username: a.username, display_name: a.display_name, role: a.role, avatar_url: a.avatar_url,
    // Backward compat for agents
    agent_id: a.id, name: a.username,
    capabilities: JSON.parse(req.agent?.capabilities || '[]'),
  });
});

// ─── Docs (local SQLite) ────────────────────────
app.post('/api/docs', authenticateAgent, (req, res) => {
  const { title, content_markdown, parent_id, collection_id } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title required' });
  }
  const now = new Date().toISOString();
  const agentName = req.agent?.name || null;
  const docId = genId('doc');

  db.prepare(`INSERT INTO documents (id, title, text, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(docId, title, content_markdown || '', agentName, agentName, now, now);

  const nodeId = `doc:${docId}`;
  contentItemsUpsert.run(
    nodeId, docId, 'doc', title,
    null, parent_id || null, collection_id || null,
    agentName, agentName, now, now, null, Date.now()
  );

  res.status(201).json({
    doc_id: docId,
    created_at: new Date(now).getTime(),
  });
});

app.patch('/api/docs/:doc_id', authenticateAgent, (req, res) => {
  const { title, content_markdown } = req.body;
  const now = new Date().toISOString();
  const agentName = req.agent?.name || null;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.doc_id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  const updates = ['updated_at = ?', 'updated_by = ?'];
  const params = [now, agentName];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (content_markdown !== undefined) { updates.push('text = ?'); params.push(content_markdown); }
  params.push(req.params.doc_id);

  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Sync title change to content_items
  if (title !== undefined) {
    db.prepare('UPDATE content_items SET title = ?, updated_at = ? WHERE raw_id = ? AND type = ?')
      .run(title, now, req.params.doc_id, 'doc');
  }

  res.json({ doc_id: req.params.doc_id, updated_at: new Date(now).getTime() });
});

// ─── Agent-facing comment endpoints ─────────────────────────────────────────

// POST /api/comments — agent posts a comment on a document (plain text → ProseMirror)
app.post('/api/comments', authenticateAgent, (req, res) => {
  const { doc_id, text, parent_comment_id } = req.body;
  if (!doc_id || !text) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'doc_id and text required' });
  }

  const doc = db.prepare('SELECT id FROM documents WHERE id = ? AND deleted_at IS NULL').get(doc_id);
  if (!doc) return res.status(404).json({ error: 'DOC_NOT_FOUND' });

  const agent = req.agent;
  const commentId = genId('cmt');
  const now = new Date().toISOString();

  // Convert plain text to minimal ProseMirror JSON
  const pmData = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };

  db.prepare(`INSERT INTO document_comments (id, document_id, parent_id, data_json, actor, actor_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(commentId, doc_id, parent_comment_id || null, JSON.stringify(pmData),
      agent.display_name || agent.name, agent.id, now, now);

  // @mention detection
  try {
    const allAgents = db.prepare('SELECT * FROM agent_accounts').all();
    const nowMs = Date.now();
    for (const target of allAgents) {
      if (target.id === agent.id) continue;
      const mentionName = new RegExp(`@${target.name}(?![\\w-])`, 'i');
      const mentionDisplay = target.display_name ? new RegExp(`@${target.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i') : null;
      if (!mentionName.test(text) && !(mentionDisplay && mentionDisplay.test(text))) continue;

      const cleanText = text.replace(new RegExp(`@${target.name}(?![\\w-])\\s*`, 'gi'), '').trim();
      const evt = {
        event: 'doc.commented',
        source: 'document_comments',
        event_id: genId('evt'),
        timestamp: nowMs,
        data: {
          comment_id: commentId,
          doc_id,
          parent_id: parent_comment_id || null,
          text: cleanText,
          raw_text: text,
          sender: { name: agent.display_name || agent.name, type: agent.type || 'agent' },
        },
      };
      db.prepare(`INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(evt.event_id, target.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), nowMs);
      pushEvent(target.id, evt);
      if (target.webhook_url) deliverWebhook(target, evt).catch(() => {});
      console.log(`[gateway] Event ${evt.event} → ${target.name} (doc: ${doc_id})`);
    }
  } catch (e) {
    console.error(`[gateway] Doc comment notification error: ${e.message}`);
  }

  res.status(201).json({
    comment_id: commentId,
    doc_id,
    parent_comment_id: parent_comment_id || null,
    actor: agent.display_name || agent.name,
    actor_id: agent.id,
    created_at: new Date(now).getTime(),
  });
});

// GET /api/docs/:doc_id/comments — list comments for a document (agent-facing, simplified)
app.get('/api/docs/:doc_id/comments', authenticateAgent, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM document_comments WHERE document_id = ? ORDER BY created_at ASC'
  ).all(req.params.doc_id);

  const comments = rows.map(r => {
    let pmData = null;
    try { pmData = JSON.parse(r.data_json); } catch { /* ignore */ }
    return {
      id: r.id,
      text: extractTextFromProseMirror(pmData),
      actor: r.actor,
      parent_id: r.parent_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });

  res.json({ comments });
});

function extractTextFromProseMirror(pmData) {
  if (!pmData) return '';
  const extract = (node) => {
    if (node.text) return node.text;
    if (node.content) return node.content.map(extract).join('');
    return '';
  };
  return extract(pmData);
}

// Read a single document
app.get('/api/docs/:doc_id', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.doc_id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    doc_id: doc.id,
    title: doc.title,
    content_markdown: doc.text,
    created_at: new Date(doc.created_at).getTime(),
    updated_at: new Date(doc.updated_at).getTime(),
  });
});

// List/search documents
app.get('/api/docs', authenticateAgent, (req, res) => {
  const { query, limit = '25' } = req.query;
  const lim = Math.min(parseInt(limit) || 25, 100);

  if (query) {
    try {
      const docs = db.prepare(`
        SELECT d.*, snippet(documents_fts, 2, '', '', '...', 40) as context
        FROM documents_fts fts JOIN documents d ON d.id = fts.id
        WHERE documents_fts MATCH ? AND d.deleted_at IS NULL
        ORDER BY rank LIMIT ?
      `).all(query, lim);
      return res.json({ docs: docs.map(d => ({ doc_id: d.id, title: d.title, url: null, snippet: d.context, collection_id: null, updated_at: new Date(d.updated_at).getTime() })) });
    } catch {
      // fallback to LIKE
      const docs = db.prepare('SELECT * FROM documents WHERE deleted_at IS NULL AND (title LIKE ? OR text LIKE ?) ORDER BY updated_at DESC LIMIT ?').all(`%${query}%`, `%${query}%`, lim);
      return res.json({ docs: docs.map(d => ({ doc_id: d.id, title: d.title, url: null, snippet: d.text?.substring(0, 200), collection_id: null, updated_at: new Date(d.updated_at).getTime() })) });
    }
  }

  const docs = db.prepare(
    `SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`
  ).all(lim);

  res.json({
    docs: docs.map(d => ({
      doc_id: d.id,
      title: d.title,
      url: null,
      snippet: null,
      collection_id: null,
      updated_at: new Date(d.updated_at).getTime(),
    })),
  });
});

// ─── Documents (new /api/documents namespace) ───────────────────────────────
// GET /api/documents/search — FTS5 full-text search (must be before /:id)
app.get('/api/documents/search', authenticateAgent, (req, res) => {
  const { q, limit = '25' } = req.query;
  if (!q) return res.status(400).json({ error: 'MISSING_QUERY' });
  const lim = Math.min(parseInt(limit) || 25, 100);

  try {
    const results = db.prepare(`
      SELECT d.*, snippet(documents_fts, 2, '<mark>', '</mark>', '...', 40) as context
      FROM documents_fts fts
      JOIN documents d ON d.id = fts.id
      WHERE documents_fts MATCH ? AND d.deleted_at IS NULL
      ORDER BY rank
      LIMIT ?
    `).all(q, lim);

    res.json({
      data: results.map(r => ({
        document: {
          id: r.id, title: r.title, text: r.text, icon: r.icon,
          full_width: !!r.full_width,
          created_by: r.created_by, updated_by: r.updated_by,
          created_at: r.created_at, updated_at: r.updated_at,
        },
        context: r.context,
      })),
    });
  } catch (e) {
    // Fallback for invalid FTS syntax
    const results = db.prepare('SELECT * FROM documents WHERE deleted_at IS NULL AND (title LIKE ? OR text LIKE ?) ORDER BY updated_at DESC LIMIT ?')
      .all(`%${q}%`, `%${q}%`, lim);
    res.json({
      data: results.map(r => ({
        document: { id: r.id, title: r.title, text: r.text, icon: r.icon, full_width: !!r.full_width, created_by: r.created_by, updated_by: r.updated_by, created_at: r.created_at, updated_at: r.updated_at },
        context: r.text?.substring(0, 200) || '',
      })),
    });
  }
});

// GET /api/documents/:id — read single document (full content)
app.get('/api/documents/:id', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(doc);
});

// POST /api/documents — create document
app.post('/api/documents', authenticateAgent, (req, res) => {
  const { title = '', text = '', data_json, icon, full_width = 0, parent_id, collection_id } = req.body;
  const now = new Date().toISOString();
  const agentName = req.agent?.name || null;
  const docId = genId('doc');

  db.prepare(`INSERT INTO documents (id, title, text, data_json, icon, full_width, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(docId, title, text, data_json ? JSON.stringify(data_json) : null, icon || null, full_width ? 1 : 0, agentName, agentName, now, now);

  const nodeId = `doc:${docId}`;
  contentItemsUpsert.run(
    nodeId, docId, 'doc', title,
    icon || null, parent_id || null, collection_id || null,
    agentName, agentName, now, now, null, Date.now()
  );

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  res.status(201).json(doc);
});

// PATCH /api/documents/:id — update document
app.patch('/api/documents/:id', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  const now = new Date().toISOString();
  const agentName = req.agent?.name || null;
  const { title, text, data_json, icon, full_width } = req.body;

  const updates = ['updated_at = ?', 'updated_by = ?'];
  const params = [now, agentName];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (text !== undefined) { updates.push('text = ?'); params.push(text); }
  if (data_json !== undefined) { updates.push('data_json = ?'); params.push(JSON.stringify(data_json)); }
  if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
  if (full_width !== undefined) { updates.push('full_width = ?'); params.push(full_width ? 1 : 0); }
  params.push(req.params.id);

  // Save revision snapshot before updating (only if text content changed)
  if (text !== undefined && text !== doc.text) {
    const revId = genId('rev');
    db.prepare(`INSERT INTO document_revisions (id, document_id, title, data_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      revId, req.params.id, doc.title,
      JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: doc.text }] }] }),
      doc.updated_by || doc.created_by, doc.updated_at
    );
  }

  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Sync title to content_items
  if (title !== undefined) {
    db.prepare('UPDATE content_items SET title = ?, updated_at = ? WHERE raw_id = ? AND type = ?')
      .run(title, now, req.params.id, 'doc');
  }

  const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/documents/:id — soft delete (or ?permanent=true for hard delete)
app.delete('/api/documents/:id', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  if (req.query.permanent === 'true') {
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM content_items WHERE raw_id = ? AND type = ?').run(req.params.id, 'doc');
    db.prepare('DELETE FROM doc_icons WHERE doc_id = ?').run(req.params.id);
    return res.json({ deleted: true, permanent: true });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE documents SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
  db.prepare('UPDATE content_items SET deleted_at = ? WHERE raw_id = ? AND type = ?').run(now, req.params.id, 'doc');
  res.json({ deleted: true });
});

// POST /api/documents/:id/restore — restore soft-deleted document
app.post('/api/documents/:id/restore', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!doc.deleted_at) return res.status(400).json({ error: 'NOT_DELETED' });

  db.prepare('UPDATE documents SET deleted_at = NULL WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE content_items SET deleted_at = NULL WHERE raw_id = ? AND type = ?').run(req.params.id, 'doc');

  const restored = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  res.json(restored);
});

// GET /api/documents/:id/revisions — list revisions for a document
app.get('/api/documents/:id/revisions', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  const revisions = db.prepare(
    'SELECT * FROM document_revisions WHERE document_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  const data = revisions.map(r => ({
    id: r.id,
    documentId: r.document_id,
    title: r.title,
    data: (() => { try { return JSON.parse(r.data_json); } catch { return null; } })(),
    createdAt: r.created_at,
    createdBy: { id: r.created_by || '', name: r.created_by || '' }
  }));

  res.json({ data });
});

// POST /api/documents/:id/revisions/:revisionId/restore — restore a revision
app.post('/api/documents/:id/revisions/:revisionId/restore', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  const revision = db.prepare(
    'SELECT * FROM document_revisions WHERE id = ? AND document_id = ?'
  ).get(req.params.revisionId, req.params.id);
  if (!revision) return res.status(404).json({ error: 'REVISION_NOT_FOUND' });

  const now = new Date().toISOString();
  const agentName = req.agent?.name || null;

  // Save current state as a new revision (so user can undo the restore)
  const snapId = genId('rev');
  db.prepare(`INSERT INTO document_revisions (id, document_id, title, data_json, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    snapId, req.params.id, doc.title,
    JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: doc.text }] }] }),
    doc.updated_by || doc.created_by, doc.updated_at
  );

  // Extract text from the revision's ProseMirror JSON
  let revData = null;
  try { revData = JSON.parse(revision.data_json); } catch { /* ignore */ }
  const restoredText = revData ? extractTextFromProseMirror(revData) : '';

  // Update document with restored title and text
  db.prepare(`UPDATE documents SET title = ?, text = ?, data_json = ?, updated_by = ?, updated_at = ? WHERE id = ?`)
    .run(revision.title, restoredText, revision.data_json, agentName, now, req.params.id);

  // Sync title to content_items
  db.prepare('UPDATE content_items SET title = ?, updated_at = ? WHERE raw_id = ? AND type = ?')
    .run(revision.title, now, req.params.id, 'doc');

  const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ─── Document Comments (Shell-facing) ───────────────────────────────────────

function formatDocComment(r) {
  let pmData = null;
  try { pmData = JSON.parse(r.data_json); } catch { /* ignore */ }
  return {
    id: r.id,
    documentId: r.document_id,
    parentCommentId: r.parent_id || null,
    data: pmData,
    createdById: r.actor_id || '',
    createdBy: { id: r.actor_id || '', name: r.actor || '' },
    resolvedById: r.resolved_by || null,
    resolvedBy: r.resolved_by ? { id: r.resolved_by, name: r.resolved_by } : null,
    resolvedAt: r.resolved_at || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/documents/:id/comments — list comments for a document
app.get('/api/documents/:id/comments', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  const rows = db.prepare(
    'SELECT * FROM document_comments WHERE document_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  res.json({ data: rows.map(formatDocComment) });
});

// POST /api/documents/:id/comments — create comment
app.post('/api/documents/:id/comments', authenticateAgent, (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NOT_FOUND' });

  const { data, parent_comment_id } = req.body;
  if (!data) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'data (ProseMirror JSON) required' });

  const agent = req.agent;
  const commentId = genId('cmt');
  const now = new Date().toISOString();
  const nowMs = Date.now();

  db.prepare(`INSERT INTO document_comments (id, document_id, parent_id, data_json, actor, actor_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(commentId, req.params.id, parent_comment_id || null, JSON.stringify(data),
      agent.display_name || agent.name, agent.id, now, now);

  // @mention detection
  try {
    const commentText = extractTextFromProseMirror(data);
    const allAgents = db.prepare('SELECT * FROM agent_accounts').all();
    for (const target of allAgents) {
      if (target.id === agent.id) continue;
      const mentionName = new RegExp(`@${target.name}(?![\\w-])`, 'i');
      const mentionDisplay = target.display_name
        ? new RegExp(`@${target.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i')
        : null;
      if (!mentionName.test(commentText) && !(mentionDisplay && mentionDisplay.test(commentText))) continue;

      const cleanText = commentText.replace(new RegExp(`@${target.name}(?![\\w-])\\s*`, 'gi'), '').trim();
      const evt = {
        event: 'doc.commented',
        source: 'document_comments',
        event_id: genId('evt'),
        timestamp: nowMs,
        data: {
          comment_id: commentId,
          doc_id: req.params.id,
          parent_id: parent_comment_id || null,
          text: cleanText,
          raw_text: commentText,
          sender: { name: agent.display_name || agent.name, type: agent.type || 'agent' },
        },
      };
      db.prepare(`INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(evt.event_id, target.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), nowMs);
      pushEvent(target.id, evt);
      if (target.webhook_url) deliverWebhook(target, evt).catch(() => {});
      console.log(`[gateway] Event ${evt.event} → ${target.name} (doc: ${req.params.id})`);
    }
  } catch (e) {
    console.error(`[gateway] Doc comment mention error: ${e.message}`);
  }

  const inserted = db.prepare('SELECT * FROM document_comments WHERE id = ?').get(commentId);
  res.status(201).json(formatDocComment(inserted));
});

// PATCH /api/documents/comments/:commentId — update comment data
app.patch('/api/documents/comments/:commentId', authenticateAgent, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'data (ProseMirror JSON) required' });

  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE document_comments SET data_json = ?, updated_at = ? WHERE id = ?'
  ).run(JSON.stringify(data), now, req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });

  const updated = db.prepare('SELECT * FROM document_comments WHERE id = ?').get(req.params.commentId);
  res.json(formatDocComment(updated));
});

// DELETE /api/documents/comments/:commentId — delete comment
app.delete('/api/documents/comments/:commentId', authenticateAgent, (req, res) => {
  const result = db.prepare('DELETE FROM document_comments WHERE id = ?').run(req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ deleted: true });
});

// POST /api/documents/comments/:commentId/resolve — mark resolved
app.post('/api/documents/comments/:commentId/resolve', authenticateAgent, (req, res) => {
  const agent = req.agent;
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE document_comments SET resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?'
  ).run(agent.display_name || agent.name, now, now, req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  const updated = db.prepare('SELECT * FROM document_comments WHERE id = ?').get(req.params.commentId);
  res.json(formatDocComment(updated));
});

// POST /api/documents/comments/:commentId/unresolve — unmark resolved
app.post('/api/documents/comments/:commentId/unresolve', authenticateAgent, (req, res) => {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE document_comments SET resolved_by = NULL, resolved_at = NULL, updated_at = ? WHERE id = ?'
  ).run(now, req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  const updated = db.prepare('SELECT * FROM document_comments WHERE id = ?').get(req.params.commentId);
  res.json(formatDocComment(updated));
});

// ─── Data (Baserow) ──────────────────────────────
// Baserow JWT is managed by baserow.js module
// The nc() function is replaced by br() from baserow.js
// Legacy aliases for backward compatibility in code
const nc = br;
const getNcJwt = getBrJwt;

// Baserow doesn't need per-agent users — all operations go through the admin JWT
// or the database token. Stub out the Baserow user management functions.
async function createNcUser(agentName, displayName) {
  // No-op in Baserow mode — agent identity is tracked in gateway DB
  console.log(`[gateway] Agent ${agentName} registered (Baserow mode — no per-agent DB user needed)`);
  return null;
}

async function getNcAgentJwt(agentName, password) {
  // In Baserow mode, all operations use the admin JWT
  return getBrJwt();
}

// List tables in the ASuite base
app.get('/api/data/tables', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('GET', `/api/database/tables/database/${NC_BASE_ID}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  const tables = Array.isArray(result.data) ? result.data : [];
  // Map Baserow response to gateway-compatible format
  const list = tables.map(t => ({
    id: String(t.id),
    title: t.name,
    order: t.order,
    created_at: t.created_on || null,
  }));
  res.json({ list });
});

// Create a table in the ASuite base
// Body: { title: string, columns: [{ title, uidt, pk?, ai?, required? }, ...] }
// uidt values: SingleLineText, LongText, Number, Decimal, Checkbox, Date, DateTime, Email, URL
// Agent identity is recorded via a meta column "created_by_agent"
app.post('/api/data/tables', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { title, columns = [] } = req.body;
  if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });

  // Baserow creates a default Name column automatically.
  // We create the table first, then add additional columns.
  const createBody = { name: title };
  const result = await br('POST', `/api/database/tables/database/${NC_BASE_ID}/`, createBody);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  const tableId = String(result.data.id);

  // Add requested columns (skip any that match Baserow's default columns)
  const addedColumns = [];
  for (const col of columns) {
    const colTitle = col.title || col.column_name;
    if (!colTitle) continue;
    try {
      const fieldBody = buildFieldCreateBody(colTitle, col.uidt || 'SingleLineText', {
        options: col.options,
        meta: col.meta,
        childId: col.childId,
        relationType: col.relationType,
        fk_relation_column_id: col.fk_relation_column_id,
        fk_lookup_column_id: col.fk_lookup_column_id,
        formula_raw: col.formula_raw,
      });
      const colResult = await br('POST', `/api/database/fields/table/${tableId}/`, fieldBody);
      if (colResult.status < 400) {
        addedColumns.push({ column_id: String(colResult.data.id), title: colResult.data.name, type: col.uidt || 'SingleLineText' });
      }
    } catch (e) { console.error(`[gateway] Failed to create column "${colTitle}": ${e.message}`); }
  }

  // Add created_by column
  try {
    await br('POST', `/api/database/fields/table/${tableId}/`, { name: 'created_by', type: 'text' });
  } catch {}

  // Rename the default view to "Grid"
  try {
    const viewsResult = await br('GET', `/api/database/views/table/${tableId}/`);
    const views = Array.isArray(viewsResult.data) ? viewsResult.data : [];
    if (views.length > 0 && views[0].name !== 'Grid') {
      await br('PATCH', `/api/database/views/${views[0].id}/`, { name: 'Grid' });
    }
  } catch { /* non-critical */ }

  // Get final field list for response
  const fields = await getTableFields(tableId);
  const responseCols = fields.map(f => ({
    column_id: String(f.id), title: f.name, type: BR_TO_UIDT[f.type] || f.type,
    primary_key: !!f.primary,
  }));

  // Also write to content_items so sidebar is up to date
  const nodeId = `table:${tableId}`;
  contentItemsUpsert.run(nodeId, tableId, 'table', title, null, null, null, req.agent?.name || null, null, new Date().toISOString(), null, null, Date.now());

  res.status(201).json({ table_id: tableId, title, columns: responseCols });
});

// Describe a table (get column definitions)
app.get('/api/data/tables/:table_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;

  // Fetch fields
  const fieldsResult = await br('GET', `/api/database/fields/table/${tableId}/`);
  if (fieldsResult.status >= 400) return res.status(fieldsResult.status).json({ error: 'UPSTREAM_ERROR', detail: fieldsResult.data });

  // Fetch views
  const viewsResult = await br('GET', `/api/database/views/table/${tableId}/`);

  // Fetch table info for name
  const tablesResult = await br('GET', `/api/database/tables/database/${NC_BASE_ID}/`);
  let tableName = 'Untitled';
  let tableCreatedAt = null;
  if (tablesResult.status < 400 && Array.isArray(tablesResult.data)) {
    const t = tablesResult.data.find(t => String(t.id) === String(tableId));
    if (t) { tableName = t.name; tableCreatedAt = t.created_on; }
  }

  const fields = Array.isArray(fieldsResult.data) ? fieldsResult.data : [];
  const columns = fields.map(f => {
    const col = {
      column_id: String(f.id),
      title: f.name,
      type: BR_TO_UIDT[f.type] || f.type,
      primary_key: !!f.primary,
      required: false,
    };
    // Select options
    if (f.select_options) {
      col.options = f.select_options.map((o, i) => ({ title: o.value, color: o.color, order: i + 1 }));
    }
    // Formula
    if (f.formula) {
      col.formula = f.formula;
    }
    // Link row (relation info)
    if (f.type === 'link_row') {
      col.relatedTableId = f.link_row_table_id ? String(f.link_row_table_id) : null;
      col.relationType = 'mm'; // Baserow default
    }
    // Lookup
    if (f.type === 'lookup') {
      if (f.through_field_id) col.fk_relation_column_id = String(f.through_field_id);
      if (f.target_field_id) col.fk_lookup_column_id = String(f.target_field_id);
    }
    // Number decimals as meta
    if (f.type === 'number' && f.number_decimal_places) {
      col.meta = { decimals: f.number_decimal_places };
    }
    return col;
  });

  const brViews = viewsResult.status < 400 && Array.isArray(viewsResult.data) ? viewsResult.data : [];
  const views = brViews.map((v, i) => ({
    view_id: String(v.id),
    title: v.name,
    type: BR_VIEW_TYPE_NUM[v.type] || 3, // default to grid=3
    is_default: i === 0,
    order: v.order,
  }));

  res.json({ table_id: tableId, title: tableName, columns, views, created_at: tableCreatedAt, updated_at: null });
});

// Add a column to a table
// Body: { title: string, uidt: string, options?: [{title, color}] }
app.post('/api/data/tables/:table_id/columns', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { title, uidt: rawUidt = 'SingleLineText', options, meta } = req.body;
  if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });
  const tableId = req.params.table_id;

  const fieldBody = buildFieldCreateBody(title, rawUidt, {
    options,
    meta: meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : undefined,
    childId: req.body.childId,
    relationType: req.body.relationType,
    fk_relation_column_id: req.body.fk_relation_column_id,
    fk_lookup_column_id: req.body.fk_lookup_column_id,
    fk_rollup_column_id: req.body.fk_rollup_column_id,
    rollup_function: req.body.rollup_function,
    formula_raw: req.body.formula_raw,
  });

  const result = await br('POST', `/api/database/fields/table/${tableId}/`, fieldBody);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  invalidateFieldCache(tableId);
  const c = result.data;

  // Backfill CreatedBy/LastModifiedBy for existing rows (Baserow auto-manages created_on/last_modified)
  if (rawUidt === 'CreatedBy' || rawUidt === 'LastModifiedBy') {
    try {
      const rowsResult = await br('GET', `/api/database/rows/table/${tableId}/?user_field_names=true&size=200`, null, { useToken: true });
      if (rowsResult.status < 400 && rowsResult.data?.results?.length > 0) {
        for (const row of rowsResult.data.results) {
          await br('PATCH', `/api/database/rows/table/${tableId}/${row.id}/?user_field_names=true`,
            { [title]: req.agent.display_name || req.agent.name || 'system' }, { useToken: true });
        }
      }
    } catch (backfillErr) {
      console.error('System column backfill failed (non-fatal):', backfillErr.message);
    }
  }

  res.status(201).json({ column_id: String(c.id), title: c.name, type: rawUidt });
});

// Update a column (rename, change type, update options)
// Body: { title?: string, uidt?: string, options?: [{title, color?}] }
app.patch('/api/data/tables/:table_id/columns/:column_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const columnId = req.params.column_id;
  const tableId = req.params.table_id;

  // Fetch current field metadata
  const colMeta = await br('GET', `/api/database/fields/${columnId}/`);
  if (colMeta.status >= 400) return res.status(colMeta.status).json({ error: 'UPSTREAM_ERROR', detail: colMeta.data });
  const currentField = colMeta.data;

  const body = {};
  if (req.body.title) body.name = req.body.title;

  // Type change
  if (req.body.uidt) {
    body.type = UIDT_TO_BR[req.body.uidt] || req.body.uidt;
  }

  // Select options
  if (req.body.options) {
    const existingOpts = currentField.select_options || [];
    const existingMap = new Map(existingOpts.map(o => [o.value, o]));
    body.select_options = req.body.options.map(o => {
      const optTitle = typeof o === 'string' ? o : (o.title || '');
      const existing = existingMap.get(optTitle);
      return {
        ...(existing ? { id: existing.id } : {}),
        value: optTitle,
        color: o.color || (existing ? existing.color : 'light-blue'),
      };
    });
  }

  // Meta (number decimals, etc.)
  if (req.body.meta !== undefined) {
    const metaObj = typeof req.body.meta === 'string' ? JSON.parse(req.body.meta) : req.body.meta;
    if (metaObj.decimals) body.number_decimal_places = metaObj.decimals;
  }

  const result = await br('PATCH', `/api/database/fields/${columnId}/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  invalidateFieldCache(tableId);
  res.json(result.data);
});

// Delete a column
app.delete('/api/data/tables/:table_id/columns/:column_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('DELETE', `/api/database/fields/${req.params.column_id}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  invalidateFieldCache(req.params.table_id);
  res.json({ deleted: true });
});

// Rename a table
app.patch('/api/data/tables/:table_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });
  const result = await br('PATCH', `/api/database/tables/${req.params.table_id}/`, { name: title });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  // Sync title to content_items
  db.prepare('UPDATE content_items SET title = ?, updated_at = ? WHERE raw_id = ? AND type = ?')
    .run(title, new Date().toISOString(), req.params.table_id, 'table');
  res.json({ ...result.data, title });
});

// Delete a table
app.delete('/api/data/tables/:table_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('DELETE', `/api/database/tables/${req.params.table_id}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  invalidateFieldCache(req.params.table_id);
  // Also remove from content_items
  db.prepare('DELETE FROM content_items WHERE raw_id = ? AND type = ?').run(req.params.table_id, 'table');
  res.json({ deleted: true });
});

// ── Views ──

// List views for a table (included in describe, but also standalone)
app.get('/api/data/tables/:table_id/views', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('GET', `/api/database/views/table/${req.params.table_id}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  const brViews = Array.isArray(result.data) ? result.data : [];
  const views = brViews.map((v, i) => ({
    view_id: String(v.id),
    title: v.name,
    type: BR_VIEW_TYPE_NUM[v.type] || 3,
    is_default: i === 0,
    order: v.order,
    lock_type: null,
  }));
  res.json({ list: views });
});

// Create a view
app.post('/api/data/tables/:table_id/views', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { title, type } = req.body;
  if (!title) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title required' });
  const brType = BR_VIEW_TYPE_MAP[type] || 'grid';
  const body = { name: title, type: brType };
  // For kanban, set single_select_field if provided
  if (type === 'kanban' && req.body.fk_grp_col_id) {
    body.single_select_field = parseInt(req.body.fk_grp_col_id, 10);
  }
  const result = await br('POST', `/api/database/views/table/${req.params.table_id}/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.status(201).json({
    view_id: String(result.data.id),
    title: result.data.name,
    type: BR_VIEW_TYPE_NUM[result.data.type] || 3,
    is_default: false,
    order: result.data.order,
  });
});

// Update kanban view config (set grouping column)
app.patch('/api/data/views/:view_id/kanban', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const body = {};
  if (req.body.fk_grp_col_id) body.single_select_field = parseInt(req.body.fk_grp_col_id, 10);
  const result = await br('PATCH', `/api/database/views/${req.params.view_id}/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ updated: true });
});

// Update gallery view config (set cover image column)
app.patch('/api/data/views/:view_id/gallery', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const body = {};
  if (req.body.fk_cover_image_col_id !== undefined) body.card_cover_image_field = parseInt(req.body.fk_cover_image_col_id, 10);
  const result = await br('PATCH', `/api/database/views/${req.params.view_id}/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ updated: true });
});

// Rename a view
app.patch('/api/data/views/:view_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'title required' });
  const result = await br('PATCH', `/api/database/views/${req.params.view_id}/`, { name: title });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ updated: true });
});

// Delete a view
app.delete('/api/data/views/:view_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('DELETE', `/api/database/views/${req.params.view_id}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ deleted: true });
});

// List filters for a view
app.get('/api/data/views/:view_id/filters', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('GET', `/api/database/views/${req.params.view_id}/filters/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  const brFilters = Array.isArray(result.data) ? result.data : [];
  const filters = brFilters.map(f => ({
    filter_id: String(f.id),
    fk_column_id: String(f.field),
    comparison_op: f.type, // Baserow uses 'type' for the operator
    comparison_sub_op: null,
    value: f.value,
    logical_op: 'and', // Baserow uses view-level filter_type
    order: f.order,
  }));
  res.json({ list: filters });
});

// Create a filter for a view
app.post('/api/data/views/:view_id/filters', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { fk_column_id, comparison_op, value } = req.body;
  if (!fk_column_id || !comparison_op) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'fk_column_id and comparison_op required' });
  const brType = NC_OP_TO_BR[comparison_op] || comparison_op;
  const body = { field: parseInt(fk_column_id, 10), type: brType, value: value || '' };
  const result = await br('POST', `/api/database/views/${req.params.view_id}/filters/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.status(201).json({ filter_id: String(result.data.id), fk_column_id: String(result.data.field), comparison_op: comparison_op, value: result.data.value });
});

// Update a filter
app.patch('/api/data/filters/:filter_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const body = {};
  if (req.body.fk_column_id) body.field = parseInt(req.body.fk_column_id, 10);
  if (req.body.comparison_op) body.type = NC_OP_TO_BR[req.body.comparison_op] || req.body.comparison_op;
  if (req.body.value !== undefined) body.value = req.body.value;
  const result = await br('PATCH', `/api/database/views/filter/${req.params.filter_id}/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ updated: true });
});

// Delete a filter
app.delete('/api/data/filters/:filter_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('DELETE', `/api/database/views/filter/${req.params.filter_id}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ deleted: true });
});

// List sorts for a view
app.get('/api/data/views/:view_id/sorts', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('GET', `/api/database/views/${req.params.view_id}/sortings/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  const brSorts = Array.isArray(result.data) ? result.data : [];
  const sorts = brSorts.map(s => ({
    sort_id: String(s.id),
    fk_column_id: String(s.field),
    direction: s.order === 'DESC' ? 'desc' : 'asc',
    order: s.id, // Baserow doesn't have explicit order
  }));
  res.json({ list: sorts });
});

// Create a sort for a view
app.post('/api/data/views/:view_id/sorts', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { fk_column_id, direction } = req.body;
  if (!fk_column_id) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'fk_column_id required' });
  const body = { field: parseInt(fk_column_id, 10), order: (direction || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC' };
  const result = await br('POST', `/api/database/views/${req.params.view_id}/sortings/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.status(201).json({ sort_id: String(result.data.id), fk_column_id: String(result.data.field), direction: direction || 'asc' });
});

// Delete a sort
app.delete('/api/data/sorts/:sort_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('DELETE', `/api/database/views/sorting/${req.params.sort_id}/`);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ deleted: true });
});

// Update a sort
app.patch('/api/data/sorts/:sort_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const body = {};
  if (req.body.fk_column_id) body.field = parseInt(req.body.fk_column_id, 10);
  if (req.body.direction) body.order = req.body.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const result = await br('PATCH', `/api/database/views/sorting/${req.params.sort_id}/`, body);
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json(result.data);
});

// Query rows through a specific view (applies view's filters/sorts)
app.get('/api/data/:table_id/views/:view_id/rows', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  const viewId = req.params.view_id;
  const { where, limit = '25', offset = '0', sort } = req.query;
  const fields = await getTableFields(tableId);
  const fieldMap = {};
  for (const f of fields) fieldMap[f.name] = f;

  const params = new URLSearchParams({ size: limit, user_field_names: 'true' });
  // Baserow uses page-based pagination: page = floor(offset/size) + 1
  const page = Math.floor(parseInt(offset, 10) / parseInt(limit, 10)) + 1;
  params.set('page', String(page));

  // Apply where filters
  if (where) {
    const filters = parseNcWhere(where);
    const filterParams = buildBaserowFilterParams(filters, fieldMap);
    for (const [key, val] of filterParams.entries()) params.append(key, val);
  }

  // Apply sort
  if (sort) {
    params.set('order_by', buildBaserowOrderBy(sort, fieldMap));
  }

  // Use view-specific row listing
  const result = await br('GET', `/api/database/rows/table/${tableId}/?${params}`, null, { useToken: true });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  const rows = (result.data?.results || []).map(r => normalizeRowForGateway(r, fields));
  res.json({ list: rows, pageInfo: { totalRows: result.data?.count || 0, page, pageSize: parseInt(limit, 10), isFirstPage: page === 1, isLastPage: !result.data?.next } });
});

// List rows from a table
app.get('/api/data/:table_id/rows', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  const { where, limit = '25', offset = '0', sort } = req.query;
  const fields = await getTableFields(tableId);
  const fieldMap = {};
  for (const f of fields) fieldMap[f.name] = f;

  const params = new URLSearchParams({ size: limit, user_field_names: 'true' });
  const page = Math.floor(parseInt(offset, 10) / parseInt(limit, 10)) + 1;
  params.set('page', String(page));

  if (where) {
    const filters = parseNcWhere(where);
    const filterParams = buildBaserowFilterParams(filters, fieldMap);
    for (const [key, val] of filterParams.entries()) params.append(key, val);
  }

  if (sort) {
    params.set('order_by', buildBaserowOrderBy(sort, fieldMap));
  }

  const result = await br('GET', `/api/database/rows/table/${tableId}/?${params}`, null, { useToken: true });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  const rows = (result.data?.results || []).map(r => normalizeRowForGateway(r, fields));
  res.json({ list: rows, pageInfo: { totalRows: result.data?.count || 0, page, pageSize: parseInt(limit, 10), isFirstPage: page === 1, isLastPage: !result.data?.next } });
});

// Insert row(s)
app.post('/api/data/:table_id/rows', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  let rowData = req.body;

  // Get fields for normalization
  const fields = await getTableFields(tableId);

  // Auto-fill CreatedBy/LastModifiedBy text fields
  for (const field of fields) {
    if (field.type === 'text' && !rowData[field.name]) {
      // Check if this is a CreatedBy/LastModifiedBy field by name convention
      const lcName = field.name.toLowerCase();
      if (lcName === 'created_by' || lcName === 'createdby') {
        rowData = { ...rowData, [field.name]: req.agent.display_name || req.agent.name };
      }
    }
  }

  // Normalize row data for Baserow
  const normalizedRow = normalizeRowForBaserow(rowData, fields);

  const result = await br('POST', `/api/database/rows/table/${tableId}/?user_field_names=true`, normalizedRow, { useToken: true });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  // Normalize response
  const normalized = normalizeRowForGateway(result.data, fields);
  res.status(201).json(normalized);
  // Async auto-snapshot
  maybeAutoSnapshot(tableId, req.agent.display_name || req.agent.name).catch(() => {});
});

// Update row
app.patch('/api/data/:table_id/rows/:row_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  const rowId = req.params.row_id;
  let updateData = req.body;

  const fields = await getTableFields(tableId);

  // Auto-update LastModifiedBy text fields
  for (const field of fields) {
    if (field.type === 'text') {
      const lcName = field.name.toLowerCase();
      if (lcName === 'lastmodifiedby' || lcName === 'last_modified_by') {
        updateData = { ...updateData, [field.name]: req.agent.display_name || req.agent.name };
      }
    }
  }

  const normalizedUpdate = normalizeRowForBaserow(updateData, fields);
  const result = await br('PATCH', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, normalizedUpdate, { useToken: true });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

  const normalized = normalizeRowForGateway(result.data, fields);
  res.json(normalized);

  // Async: check for User field assignments → notify assigned agents
  try {
    const allAgents = db.prepare('SELECT * FROM agent_accounts').all();
    const agentMap = new Map();
    for (const a of allAgents) {
      agentMap.set(a.name, a);
      if (a.display_name) agentMap.set(a.display_name, a);
    }
    const body = req.body || {};
    for (const [field, val] of Object.entries(body)) {
      if (!val) continue;
      const valStr = typeof val === 'string' ? val : (typeof val === 'object' && val.email ? val.email : null);
      if (!valStr) continue;
      const target = agentMap.get(valStr);
      if (!target || target.id === req.agent.id) continue;
      console.log(`[gateway] User assigned: ${target.name} via field "${field}" by ${req.agent.name}`);
      const now = Date.now();
      const evt = {
        event: 'data.user_assigned',
        source: 'row_update',
        event_id: genId('evt'),
        timestamp: now,
        data: {
          table_id: tableId,
          row_id: rowId,
          field,
          assigned_to: val,
          assigned_by: { name: req.agent.display_name || req.agent.name, type: req.agent.type || 'agent' },
        },
      };
      db.prepare(`INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(evt.event_id, target.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), now);
      pushEvent(target.id, evt);
      if (target.webhook_url) deliverWebhook(target, evt).catch(() => {});
    }
  } catch (e) { console.error(`[gateway] User assignment notification error: ${e.message}`); }
  // Async auto-snapshot
  maybeAutoSnapshot(tableId, req.agent.display_name || req.agent.name).catch(() => {});
});

// Delete row
app.delete('/api/data/:table_id/rows/:row_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const result = await br('DELETE', `/api/database/rows/table/${req.params.table_id}/${req.params.row_id}/`, null, { useToken: true });
  if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
  res.json({ deleted: true });
  // Async auto-snapshot
  maybeAutoSnapshot(req.params.table_id, req.agent.display_name || req.agent.name).catch(() => {});
});

// Duplicate a table (schema + data)
app.post('/api/data/:table_id/duplicate', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  try {
    const srcTableId = req.params.table_id;

    // 1. Get source table name
    const tablesResult = await br('GET', `/api/database/tables/database/${NC_BASE_ID}/`);
    let srcTitle = 'Untitled';
    if (tablesResult.status < 400 && Array.isArray(tablesResult.data)) {
      const t = tablesResult.data.find(t => String(t.id) === String(srcTableId));
      if (t) srcTitle = t.name;
    }

    // Get source fields
    const srcFields = await getTableFields(srcTableId);
    const SKIP_TYPES = new Set(['autonumber', 'created_on', 'last_modified', 'link_row', 'lookup', 'rollup', 'formula', 'count']);

    // 2. Create new table
    const createResult = await br('POST', `/api/database/tables/database/${NC_BASE_ID}/`, { name: `${srcTitle} (copy)` });
    if (createResult.status >= 400) return res.status(createResult.status).json({ error: 'CREATE_FAILED', detail: createResult.data });
    const newTableId = String(createResult.data.id);

    // Add matching columns
    const copyCols = srcFields.filter(f => !f.primary && !f.read_only && !SKIP_TYPES.has(f.type));
    for (const col of copyCols) {
      try {
        const fieldBody = { name: col.name, type: col.type };
        if (col.select_options) fieldBody.select_options = col.select_options.map(o => ({ value: o.value, color: o.color }));
        if (col.number_decimal_places) fieldBody.number_decimal_places = col.number_decimal_places;
        await br('POST', `/api/database/fields/table/${newTableId}/`, fieldBody);
      } catch {}
    }

    // 3. Copy rows
    const validFieldNames = new Set([...copyCols.map(c => c.name), ...srcFields.filter(f => f.primary).map(f => f.name)]);
    const newFields = await getTableFields(newTableId);
    let allRows = [];
    let page = 1;
    while (true) {
      const rowResult = await br('GET', `/api/database/rows/table/${srcTableId}/?user_field_names=true&size=200&page=${page}`, null, { useToken: true });
      if (rowResult.status >= 400) break;
      const list = rowResult.data?.results || [];
      allRows.push(...list);
      if (!rowResult.data?.next) break;
      page++;
    }

    let copiedRows = 0;
    for (const row of allRows) {
      const cleanRow = {};
      for (const [key, val] of Object.entries(row)) {
        if (key === 'id' || key === 'order') continue;
        if (validFieldNames.has(key)) cleanRow[key] = val;
      }
      // Normalize select values
      const normalized = normalizeRowForBaserow(cleanRow, newFields);
      if (Object.keys(normalized).length > 0) {
        await br('POST', `/api/database/rows/table/${newTableId}/?user_field_names=true`, normalized, { useToken: true });
        copiedRows++;
      }
    }

    console.log(`[gateway] Duplicated table ${srcTableId} → ${newTableId} (${copiedRows} rows)`);
    const srcItem = db.prepare('SELECT * FROM content_items WHERE raw_id = ? AND type = ?').get(srcTableId, 'table');
    const displayTitle = srcItem ? `${srcItem.title} (copy)` : `${srcTitle} (copy)`;
    const nodeId = `table:${newTableId}`;
    contentItemsUpsert.run(nodeId, newTableId, 'table', displayTitle, null, srcItem?.parent_id || null, null, req.agent?.name || null, null, new Date().toISOString(), null, null, Date.now());
    res.json({ success: true, new_table_id: newTableId, copied_rows: copiedRows });
  } catch (e) {
    console.error(`[gateway] Duplicate table failed: ${e.message}`);
    res.status(500).json({ error: 'DUPLICATE_FAILED', message: e.message });
  }
});

// Post a comment on a row (stored in SQLite — Baserow has no row comment API)
app.post('/api/data/:table_id/rows/:row_id/comments', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });

  const agent = req.agent;
  const commentId = genId('cmt');
  const now = Date.now();
  db.prepare(
    'INSERT INTO table_comments (id, table_id, row_id, text, actor, actor_id, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(commentId, req.params.table_id, req.params.row_id, text, agent.display_name || agent.name, agent.id, null, now, now);

  res.status(201).json({
    comment_id: commentId,
    table_id: req.params.table_id,
    row_id: req.params.row_id,
    created_at: now,
  });
});

// View columns (field visibility/width per view) — stored in Gateway DB
// View column visibility is managed locally for consistent behavior.
app.get('/api/data/views/:view_id/columns', authenticateAgent, async (req, res) => {
  const viewId = req.params.view_id;
  const rows = db.prepare('SELECT column_id, width, show, sort_order FROM view_column_settings WHERE view_id = ?').all(viewId);
  const list = rows.map(r => ({
    fk_column_id: r.column_id,
    show: r.show === 1,
    width: r.width ? String(r.width) : null,
    order: r.sort_order,
  }));
  res.json({ list });
});

app.patch('/api/data/views/:view_id/columns/:col_id', authenticateAgent, async (req, res) => {
  const { view_id, col_id } = req.params;
  const { show, width, order } = req.body;

  const existing = db.prepare('SELECT 1 FROM view_column_settings WHERE view_id = ? AND column_id = ?').get(view_id, col_id);
  if (existing) {
    const sets = [];
    const vals = [];
    if (show !== undefined) { sets.push('show = ?'); vals.push(show ? 1 : 0); }
    if (width !== undefined) { sets.push('width = ?'); vals.push(typeof width === 'string' ? parseInt(width, 10) || null : width); }
    if (order !== undefined) { sets.push('sort_order = ?'); vals.push(order); }
    sets.push('updated_at = ?'); vals.push(Date.now());
    vals.push(view_id, col_id);
    db.prepare(`UPDATE view_column_settings SET ${sets.join(', ')} WHERE view_id = ? AND column_id = ?`).run(...vals);
  } else {
    db.prepare('INSERT INTO view_column_settings (view_id, column_id, width, show, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      view_id, col_id,
      width !== undefined ? (typeof width === 'string' ? parseInt(width, 10) || null : width) : null,
      show !== undefined ? (show ? 1 : 0) : 1,
      order || null,
      Date.now()
    );
  }
  res.json({ updated: true });
});

// Linked records (for Links/LinkToAnotherRecord columns)
// Baserow manages link_row fields directly through row update — set field value to array of target row IDs
app.get('/api/data/:table_id/rows/:row_id/links/:column_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  const rowId = req.params.row_id;
  const columnId = req.params.column_id;

  // Get the field to find the field name
  const fields = await getTableFields(tableId);
  const linkField = fields.find(f => String(f.id) === String(columnId));
  if (!linkField) return res.status(404).json({ error: 'COLUMN_NOT_FOUND' });

  // Fetch the row and extract the link field value
  const rowResult = await br('GET', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, null, { useToken: true });
  if (rowResult.status >= 400) return res.status(rowResult.status).json({ error: 'UPSTREAM_ERROR', detail: rowResult.data });

  const linkedRows = rowResult.data[linkField.name] || [];
  // Baserow returns [{id, value}] for link_row fields
  const list = Array.isArray(linkedRows) ? linkedRows.map(r => ({ Id: r.id, id: r.id, value: r.value })) : [];
  res.json({ list, pageInfo: { totalRows: list.length } });
});

app.post('/api/data/:table_id/rows/:row_id/links/:column_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  const rowId = req.params.row_id;
  const columnId = req.params.column_id;
  const records = Array.isArray(req.body) ? req.body : [];

  try {
    const fields = await getTableFields(tableId);
    const linkField = fields.find(f => String(f.id) === String(columnId));
    if (!linkField) return res.status(404).json({ error: 'COLUMN_NOT_FOUND' });

    // Get current linked IDs
    const rowResult = await br('GET', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, null, { useToken: true });
    if (rowResult.status >= 400) return res.status(rowResult.status).json({ error: 'UPSTREAM_ERROR', detail: rowResult.data });

    const currentLinks = (rowResult.data[linkField.name] || []).map(r => r.id);
    const newIds = records.map(r => r.Id || r.id).filter(Boolean);
    const allIds = [...new Set([...currentLinks, ...newIds])];

    // Update the link field with the combined list
    const result = await br('PATCH', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`,
      { [linkField.name]: allIds }, { useToken: true });
    if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
    res.json({ msg: 'Links created successfully' });
  } catch (e) {
    console.error('[gateway] Link creation error:', e.message);
    res.status(500).json({ error: 'LINK_FAILED', detail: e.message });
  }
});

app.delete('/api/data/:table_id/rows/:row_id/links/:column_id', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const tableId = req.params.table_id;
  const rowId = req.params.row_id;
  const columnId = req.params.column_id;
  const records = Array.isArray(req.body) ? req.body : [];

  try {
    const fields = await getTableFields(tableId);
    const linkField = fields.find(f => String(f.id) === String(columnId));
    if (!linkField) return res.status(404).json({ error: 'COLUMN_NOT_FOUND' });

    // Get current linked IDs
    const rowResult = await br('GET', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, null, { useToken: true });
    if (rowResult.status >= 400) return res.status(rowResult.status).json({ error: 'UPSTREAM_ERROR', detail: rowResult.data });

    const currentLinks = (rowResult.data[linkField.name] || []).map(r => r.id);
    const removeIds = new Set(records.map(r => r.Id || r.id).filter(Boolean));
    const remaining = currentLinks.filter(id => !removeIds.has(id));

    const result = await br('PATCH', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`,
      { [linkField.name]: remaining }, { useToken: true });
    if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });
    res.json({ msg: 'Links removed successfully' });
  } catch (e) {
    console.error('[gateway] Unlink error:', e.message);
    res.status(500).json({ error: 'UNLINK_FAILED', detail: e.message });
  }
});

// ─── Catchup ─────────────────────────────────────
app.get('/api/me/catchup', authenticateAgent, (req, res) => {
  const since = parseInt(req.query.since || '0');
  const limit = Math.min(parseInt(req.query.limit || '50'), 100);
  const cursor = req.query.cursor;

  let query = 'SELECT * FROM events WHERE agent_id = ? AND occurred_at > ? ORDER BY occurred_at ASC LIMIT ?';
  const params = [req.agent.id, cursor ? parseInt(cursor) : since, limit + 1];

  const rows = db.prepare(query).all(...params);
  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit).map(r => JSON.parse(r.payload));

  // Mark as delivered
  for (const r of rows.slice(0, limit)) {
    db.prepare('UPDATE events SET delivered = 1 WHERE id = ?').run(r.id);
  }

  res.json({
    events,
    has_more: hasMore,
    cursor: events.length > 0 ? String(events[events.length - 1].occurred_at) : null,
  });
});

// ─── SSE Event Stream ────────────────────────────
const sseClients = new Map(); // agent_id → Set<res>

app.get('/api/me/events/stream', authenticateAgent, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const agentId = req.agent.id;
  if (!sseClients.has(agentId)) sseClients.set(agentId, new Set());
  sseClients.get(agentId).add(res);

  // Send heartbeat every 30s
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(agentId)?.delete(res);
  });
});

function pushEvent(agentId, event) {
  const clients = sseClients.get(agentId);
  if (clients) {
    for (const res of clients) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }
}

async function deliverWebhook(agent, event) {
  const timestamp = String(Date.now());
  const body = JSON.stringify(event);
  const signature = 'sha256=' + crypto.createHmac('sha256', agent.webhook_secret || '')
    .update(`${timestamp}.${body}`).digest('hex');

  await fetch(agent.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
      'X-Hub-Timestamp': timestamp,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
}

// NOTE: Outline webhook handler removed — doc mention detection will be added
// inline in the local document write path (Task 3).

// ─── Comment Polling (SQLite-backed) ──────────────────────
// Comments are now stored in SQLite table_comments table.
// No external polling needed — comments are created via the gateway.
// Keep the function stub for backward compatibility with the polling interval setup.
async function pollNcComments() {
  // No-op in Baserow mode — comments are managed via SQLite
}

// ─── Agent Self-Registration ────────────────────
// Simplified flow: agent registers → gets pending status → admin approves in IM
app.post('/api/agents/self-register', async (req, res) => {
  const { name, display_name, capabilities, webhook_url, webhook_secret } = req.body;
  if (!name || !display_name) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'name and display_name required' });
  }
  // Validate name format: lowercase, alphanumeric + hyphens
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(name)) {
    return res.status(400).json({ error: 'INVALID_NAME', message: 'Name must be lowercase alphanumeric with hyphens, 2-31 chars' });
  }
  // Check name uniqueness (both tables)
  const existing = db.prepare('SELECT id FROM agent_accounts WHERE name = ?').get(name);
  const existingActor = db.prepare('SELECT id FROM actors WHERE username = ?').get(name);
  if (existing || existingActor) {
    return res.status(409).json({ error: 'NAME_TAKEN', message: `Name "${name}" already registered` });
  }

  const agentId = genId('agt');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = Date.now();

  db.prepare(`INSERT INTO agent_accounts (id, name, display_name, token_hash, capabilities, webhook_url, webhook_secret, created_at, updated_at, pending_approval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(agentId, name, display_name, tokenHash, JSON.stringify(capabilities || []),
      webhook_url || null, webhook_secret || null, now, now);

  // Also insert into actors table
  db.prepare(`INSERT OR IGNORE INTO actors (id, type, username, display_name, token_hash, capabilities, webhook_url, webhook_secret, created_at, updated_at) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(agentId, name, display_name, tokenHash, JSON.stringify(capabilities || []),
      webhook_url || null, webhook_secret || null, now, now);

  // Create NC user in advance (will only activate after approval)
  createNcUser(name, display_name).then(ncPassword => {
    if (ncPassword) {
      db.prepare('UPDATE agent_accounts SET nc_password = ? WHERE id = ?').run(ncPassword, agentId);
    }
  }).catch(e => console.warn(`[gateway] NC user creation failed: ${e.message}`));

  res.status(201).json({
    agent_id: agentId,
    token,
    name,
    display_name,
    status: 'pending_approval',
    message: 'Registration received. Token is active but rate-limited until admin approval.',
    created_at: now,
  });
});

// Admin: approve a pending agent
app.post('/api/admin/agents/:agent_id/approve', authenticateAdmin, (req, res) => {
  const agent = db.prepare('SELECT * FROM agent_accounts WHERE id = ?').get(req.params.agent_id);
  if (!agent) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Agent not found' });
  }
  db.prepare('UPDATE agent_accounts SET pending_approval = 0, updated_at = ? WHERE id = ?')
    .run(Date.now(), agent.id);
  res.json({ agent_id: agent.id, name: agent.name, status: 'approved' });
});

// Admin: list all agents
app.get('/api/admin/agents', authenticateAdmin, (req, res) => {
  const agents = db.prepare('SELECT id, name, display_name, capabilities, online, last_seen_at, pending_approval, created_at FROM agent_accounts').all();
  res.json({ agents: agents.map(a => ({ ...a, capabilities: JSON.parse(a.capabilities || '[]'), pending_approval: !!a.pending_approval })) });
});

// Agent-facing: list other agents (public info only)
app.get('/api/agents', authenticateAgent, (req, res) => {
  const agents = db.prepare('SELECT id, name, display_name, avatar_url, capabilities, online, last_seen_at FROM agent_accounts WHERE pending_approval = 0 OR pending_approval IS NULL').all();
  res.json({
    agents: agents.map(a => ({
      agent_id: a.id, name: a.name, display_name: a.display_name, avatar_url: a.avatar_url || null,
      capabilities: JSON.parse(a.capabilities || '[]'),
      online: !!a.online, last_seen_at: a.last_seen_at,
    })),
  });
});

// Agent-facing: get info about a specific agent
app.get('/api/agents/:name', authenticateAgent, (req, res) => {
  const agent = db.prepare('SELECT id, name, display_name, avatar_url, capabilities, online, last_seen_at FROM agent_accounts WHERE name = ? AND (pending_approval = 0 OR pending_approval IS NULL)').get(req.params.name);
  if (!agent) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    agent_id: agent.id, name: agent.name, display_name: agent.display_name, avatar_url: agent.avatar_url || null,
    capabilities: JSON.parse(agent.capabilities || '[]'),
    online: !!agent.online, last_seen_at: agent.last_seen_at,
  });
});

// Update agent profile (display_name, avatar_url) — accessible to any authenticated agent
app.patch('/api/agents/:name', authenticateAgent, (req, res) => {
  const { display_name, avatar_url } = req.body;
  const target = db.prepare('SELECT id FROM agent_accounts WHERE name = ?').get(req.params.name);
  if (!target) return res.status(404).json({ error: 'NOT_FOUND' });
  const updates = [];
  const values = [];
  if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name); }
  if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url); }
  if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS' });
  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(target.id);
  db.prepare(`UPDATE agent_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Upload agent avatar — stored in gateway's own uploads dir and served statically
const AVATAR_DIR = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Serve uploaded avatars statically (at both /uploads and /api/uploads for proxy compatibility)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

app.post('/api/agents/:name/avatar', authenticateAgent, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'NO_FILE' });
  const target = db.prepare('SELECT id, avatar_url FROM agent_accounts WHERE name = ?').get(req.params.name);
  if (!target) return res.status(404).json({ error: 'NOT_FOUND' });
  // Delete old avatar file if it exists
  if (target.avatar_url && target.avatar_url.includes('/uploads/avatars/')) {
    const filename = target.avatar_url.split('/uploads/avatars/').pop();
    if (filename) {
      const oldPath = path.join(AVATAR_DIR, filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }
  const avatarUrl = `/api/gateway/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE agent_accounts SET avatar_url = ?, updated_at = ? WHERE id = ?').run(avatarUrl, Date.now(), target.id);
  res.json({ ok: true, avatar_url: avatarUrl });
});

// ─── File Upload (general) ───────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'files');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const fileUploadStorage = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.post('/api/uploads', authenticateAgent, fileUploadStorage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'NO_FILE' });
  const url = `/api/uploads/files/${req.file.filename}`;
  res.status(201).json({
    url,
    name: req.file.originalname,
    size: req.file.size,
    content_type: req.file.mimetype,
  });
});

app.get('/api/uploads/files/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!filePath.startsWith(UPLOADS_DIR)) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'NOT_FOUND' });

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.mp4': 'video/mp4',
  };
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).pipe(res);
});

// ─── Thread Context ─────────────────────────────
// Link a doc/task/data_row to a thread for cross-system context
app.post('/api/threads/:thread_id/links', authenticateAgent, (req, res) => {
  const { link_type, link_id, link_title } = req.body;
  if (!link_type || !link_id) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'link_type and link_id required' });
  }
  if (!['doc', 'task', 'data_row'].includes(link_type)) {
    return res.status(400).json({ error: 'INVALID_LINK_TYPE', message: 'link_type must be doc, task, or data_row' });
  }
  const id = genId('tl');
  db.prepare('INSERT INTO thread_links (id, thread_id, link_type, link_id, link_title, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.thread_id, link_type, link_id, link_title || null, req.agent.id, Date.now());
  res.status(201).json({ id, thread_id: req.params.thread_id, link_type, link_id });
});

// Get thread context: linked resources
app.get('/api/threads/:thread_id/context', authenticateAgent, async (req, res) => {
  const threadId = req.params.thread_id;

  // Get linked resources
  const links = db.prepare('SELECT * FROM thread_links WHERE thread_id = ? ORDER BY created_at ASC').all(threadId);

  const linkedResources = [];
  for (const link of links) {
    const entry = { link_id: link.id, type: link.link_type, id: link.link_id, title: link.link_title };
    linkedResources.push(entry);
  }

  res.json({ thread_id: threadId, messages: [], linked_resources: linkedResources });
});

// Delete a thread link
app.delete('/api/threads/:thread_id/links/:link_id', authenticateAgent, (req, res) => {
  const link = db.prepare('SELECT * FROM thread_links WHERE id = ? AND thread_id = ?').get(req.params.link_id, req.params.thread_id);
  if (!link) return res.status(404).json({ error: 'NOT_FOUND' });
  if (link.created_by !== req.agent.id) return res.status(403).json({ error: 'FORBIDDEN', message: 'Can only delete own links' });
  db.prepare('DELETE FROM thread_links WHERE id = ?').run(link.id);
  res.json({ deleted: true });
});

// ─── Enhanced Catchup ───────────────────────────
// Get unread event count
app.get('/api/me/events/count', authenticateAgent, (req, res) => {
  const since = parseInt(req.query.since || '0');
  const count = db.prepare('SELECT COUNT(*) as count FROM events WHERE agent_id = ? AND delivered = 0 AND occurred_at > ?')
    .get(req.agent.id, since);
  res.json({ unread_count: count.count });
});

// Acknowledge events (mark as delivered up to a cursor)
app.post('/api/me/events/ack', authenticateAgent, (req, res) => {
  const { cursor } = req.body;
  if (!cursor) return res.status(400).json({ error: 'MISSING_CURSOR', message: 'cursor (timestamp) required' });
  const result = db.prepare('UPDATE events SET delivered = 1 WHERE agent_id = ? AND occurred_at <= ? AND delivered = 0')
    .run(req.agent.id, parseInt(cursor));
  res.json({ acknowledged: result.changes });
});

// ─── Doc Icons (emoji per document/table) ─────────
app.get('/api/doc-icons', authenticateAgent, (req, res) => {
  const rows = db.prepare('SELECT doc_id, icon FROM doc_icons').all();
  const map = {};
  for (const r of rows) map[r.doc_id] = r.icon;
  res.json({ icons: map });
});

app.put('/api/doc-icons/:doc_id', authenticateAgent, (req, res) => {
  const { icon } = req.body;
  if (!icon) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: '"icon" required' });
  const now = Date.now();
  db.prepare('INSERT INTO doc_icons (doc_id, icon, updated_at) VALUES (?, ?, ?) ON CONFLICT(doc_id) DO UPDATE SET icon = excluded.icon, updated_at = excluded.updated_at')
    .run(req.params.doc_id, icon, now);
  // Also update content_items if exists (both doc: and table: prefixed)
  db.prepare('UPDATE content_items SET icon = ? WHERE raw_id = ?').run(icon, req.params.doc_id);
  res.json({ doc_id: req.params.doc_id, icon, updated_at: now });
});

app.delete('/api/doc-icons/:doc_id', authenticateAgent, (req, res) => {
  db.prepare('DELETE FROM doc_icons WHERE doc_id = ?').run(req.params.doc_id);
  // Clear icon in content_items too
  db.prepare('UPDATE content_items SET icon = NULL WHERE raw_id = ?').run(req.params.doc_id);
  res.json({ deleted: true });
});

// ─── Content Items (unified sidebar metadata) ─────
// Sync doc/table metadata from local documents + Baserow into content_items table
// Shell reads from here for the unified sidebar tree

const contentItemsUpsert = db.prepare(`
  INSERT INTO content_items (id, raw_id, type, title, icon, parent_id, collection_id, created_by, updated_by, created_at, updated_at, deleted_at, synced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    icon = COALESCE((SELECT icon FROM doc_icons WHERE doc_id = excluded.raw_id), excluded.icon),
    parent_id = excluded.parent_id,
    collection_id = excluded.collection_id,
    created_by = excluded.created_by,
    updated_by = excluded.updated_by,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    synced_at = excluded.synced_at
`);

async function syncContentItems() {
  const now = Date.now();
  console.log('[gateway] Syncing content items from local documents + Baserow...');

  // 1. Sync docs from local documents table
  let docCount = 0;
  try {
    const docs = db.prepare('SELECT d.*, di.icon as custom_icon FROM documents d LEFT JOIN doc_icons di ON di.doc_id = d.id').all();
    for (const doc of docs) {
      const nodeId = `doc:${doc.id}`;
      // Look up existing content_item to preserve parent_id (not stored on documents)
      const existing = db.prepare('SELECT parent_id, collection_id FROM content_items WHERE id = ?').get(nodeId);
      const icon = doc.custom_icon || doc.icon || null;
      contentItemsUpsert.run(
        nodeId, doc.id, 'doc', doc.title || '',
        icon, existing?.parent_id || null, existing?.collection_id || null,
        doc.created_by || null, doc.updated_by || null,
        doc.created_at || null, doc.updated_at || null, doc.deleted_at || null,
        now
      );
      docCount++;
    }
  } catch (err) {
    console.error('[gateway] Content sync: documents error:', err.message);
  }

  // 2. Sync tables from Baserow
  let tableCount = 0;
  if (NC_EMAIL && NC_PASSWORD) {
    try {
      const result = await br('GET', `/api/database/tables/database/${NC_BASE_ID}/`);
      if (result.status < 400 && Array.isArray(result.data)) {
        for (const t of result.data) {
          const nodeId = `table:${t.id}`;
          const customIcon = db.prepare('SELECT icon FROM doc_icons WHERE doc_id = ?').get(String(t.id));
          contentItemsUpsert.run(
            nodeId, String(t.id), 'table', t.name || '',
            customIcon?.icon || null, null, null,
            null, null,
            t.created_on || null, null, null,
            now
          );
          tableCount++;
        }
      }
    } catch (err) {
      console.error('[gateway] Content sync: Baserow error:', err.message);
    }
  }

  // 3. Remove stale table items (not seen in this sync cycle)
  // Only purge 'table' type — docs/boards/etc. are owned by local DB and not purged here
  db.prepare("DELETE FROM content_items WHERE type = 'table' AND synced_at < ? AND deleted_at IS NULL").run(now);

  console.log(`[gateway] Content sync done: ${docCount} docs, ${tableCount} tables`);
}

// ─── Presentations (Fabric.js PPT) ─────────────────
// API: create a presentation
app.post('/api/presentations', authenticateAgent, (req, res) => {
  const { title = '' } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  const agentName = req.agent?.name || null;
  const defaultData = JSON.stringify({ slides: [] });

  db.prepare(`INSERT INTO presentations (id, data_json, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, defaultData, agentName, agentName, now, now);

  // Create content_item entry
  const nodeId = `presentation:${id}`;
  const isoNow = new Date().toISOString();
  contentItemsUpsert.run(
    nodeId, id, 'presentation', title || '',
    null, req.body.parent_id || null, null,
    agentName, agentName, isoNow, isoNow, null, Date.now()
  );

  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
  res.status(201).json({ presentation_id: id, item });
});

// API: get presentation data
app.get('/api/presentations/:id', authenticateAgent, (req, res) => {
  const pres = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
  if (!pres) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    id: pres.id,
    data: JSON.parse(pres.data_json),
    created_by: pres.created_by,
    updated_by: pres.updated_by,
    created_at: pres.created_at,
    updated_at: pres.updated_at,
  });
});

// API: save presentation data (auto-save from frontend)
app.patch('/api/presentations/:id', authenticateAgent, (req, res) => {
  const pres = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
  if (!pres) return res.status(404).json({ error: 'NOT_FOUND' });

  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'MISSING_DATA' });

  const now = Date.now();
  const agentName = req.agent?.name || null;
  db.prepare('UPDATE presentations SET data_json = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(data), agentName, now, req.params.id);

  res.json({ saved: true, updated_at: now });
});

// ─── Presentation Semantic Slide Endpoints ──────────
// Layout templates for Agent-friendly slide creation
const SLIDE_LAYOUTS = {
  title: (opts) => ({
    elements: [
      { type: 'textbox', left: 80, top: 200, width: 800, height: 80, text: opts.title || '', fontSize: 48, fontWeight: 'bold', textAlign: 'center', fill: '#1a1a1a' },
    ],
    background: opts.background || '#ffffff',
    notes: opts.notes || '',
  }),
  'title-content': (opts) => ({
    elements: [
      { type: 'textbox', left: 60, top: 40, width: 840, height: 60, text: opts.title || '', fontSize: 36, fontWeight: 'bold', fill: '#1a1a1a' },
      { type: 'textbox', left: 60, top: 120, width: 840, height: 340, text: (opts.bullets || []).map(b => `• ${b}`).join('\n'), fontSize: 22, fill: '#333333', lineHeight: 1.6 },
    ],
    background: opts.background || '#ffffff',
    notes: opts.notes || '',
  }),
  'title-image': (opts) => ({
    elements: [
      { type: 'textbox', left: 60, top: 40, width: 840, height: 60, text: opts.title || '', fontSize: 36, fontWeight: 'bold', fill: '#1a1a1a' },
      { type: 'image', left: 160, top: 130, width: 640, height: 330, src: opts.image || '' },
    ],
    background: opts.background || '#ffffff',
    notes: opts.notes || '',
  }),
  'two-column': (opts) => ({
    elements: [
      { type: 'textbox', left: 60, top: 40, width: 840, height: 60, text: opts.title || '', fontSize: 36, fontWeight: 'bold', fill: '#1a1a1a' },
      { type: 'textbox', left: 60, top: 120, width: 400, height: 340, text: opts.left_content || '', fontSize: 20, fill: '#333333', lineHeight: 1.5 },
      { type: 'textbox', left: 500, top: 120, width: 400, height: 340, text: opts.right_content || '', fontSize: 20, fill: '#333333', lineHeight: 1.5 },
    ],
    background: opts.background || '#ffffff',
    notes: opts.notes || '',
  }),
  blank: (opts) => ({
    elements: [],
    background: opts.background || '#ffffff',
    notes: opts.notes || '',
  }),
};

// API: append a slide (supports semantic layout)
app.post('/api/presentations/:id/slides', authenticateAgent, (req, res) => {
  const pres = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
  if (!pres) return res.status(404).json({ error: 'NOT_FOUND' });

  const data = JSON.parse(pres.data_json);
  const { layout, ...opts } = req.body;

  let slide;
  if (layout && SLIDE_LAYOUTS[layout]) {
    slide = SLIDE_LAYOUTS[layout](opts);
  } else if (req.body.elements) {
    // Raw Fabric.js elements
    slide = { elements: req.body.elements, background: req.body.background || '#ffffff', notes: req.body.notes || '' };
  } else {
    // Default blank
    slide = SLIDE_LAYOUTS.blank(opts);
  }

  data.slides.push(slide);
  const now = Date.now();
  const agentName = req.agent?.name || null;
  db.prepare('UPDATE presentations SET data_json = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(data), agentName, now, req.params.id);

  res.status(201).json({ index: data.slides.length - 1, slide, updated_at: now });
});

// API: update a single slide
app.patch('/api/presentations/:id/slides/:index', authenticateAgent, (req, res) => {
  const pres = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
  if (!pres) return res.status(404).json({ error: 'NOT_FOUND' });

  const data = JSON.parse(pres.data_json);
  const idx = parseInt(req.params.index, 10);
  if (idx < 0 || idx >= data.slides.length) return res.status(404).json({ error: 'SLIDE_NOT_FOUND' });

  const { layout, ...opts } = req.body;
  if (layout && SLIDE_LAYOUTS[layout]) {
    data.slides[idx] = SLIDE_LAYOUTS[layout](opts);
  } else {
    // Merge provided fields into existing slide
    Object.assign(data.slides[idx], req.body);
  }

  const now = Date.now();
  const agentName = req.agent?.name || null;
  db.prepare('UPDATE presentations SET data_json = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(data), agentName, now, req.params.id);

  res.json({ index: idx, slide: data.slides[idx], updated_at: now });
});

// API: delete a single slide
app.delete('/api/presentations/:id/slides/:index', authenticateAgent, (req, res) => {
  const pres = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
  if (!pres) return res.status(404).json({ error: 'NOT_FOUND' });

  const data = JSON.parse(pres.data_json);
  const idx = parseInt(req.params.index, 10);
  if (idx < 0 || idx >= data.slides.length) return res.status(404).json({ error: 'SLIDE_NOT_FOUND' });

  data.slides.splice(idx, 1);
  const now = Date.now();
  const agentName = req.agent?.name || null;
  db.prepare('UPDATE presentations SET data_json = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(data), agentName, now, req.params.id);

  res.json({ deleted: true, remaining: data.slides.length, updated_at: now });
});

// ─── Diagram CRUD ────────────────────────────────
app.post('/api/diagrams', authenticateAgent, (req, res) => {
  const agentName = req.agentConfig?.name || 'unknown';
  const now = Date.now();
  const id = crypto.randomUUID();
  const defaultData = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  db.prepare(`INSERT INTO diagrams (id, data_json, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, JSON.stringify(defaultData), agentName, agentName, now, now);
  res.json({ id, data: defaultData, created_by: agentName, created_at: now, updated_at: now });
});

app.get('/api/diagrams/:id', authenticateAgent, (req, res) => {
  const row = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Diagram not found' });
  let data;
  try { data = JSON.parse(row.data_json); } catch { data = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }; }
  res.json({ id: row.id, data, created_by: row.created_by, updated_by: row.updated_by, created_at: row.created_at, updated_at: row.updated_at });
});

app.patch('/api/diagrams/:id', authenticateAgent, (req, res) => {
  const row = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Diagram not found' });
  const agentName = req.agentConfig?.name || 'unknown';
  const now = Date.now();
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data is required' });
  db.prepare('UPDATE diagrams SET data_json = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(data), agentName, now, req.params.id);
  res.json({ saved: true, updated_at: now });
});

// API: list content items for sidebar (or trash)
app.get('/api/content-items', authenticateAgent, (req, res) => {
  if (req.query.deleted === 'true') {
    const rows = db.prepare('SELECT * FROM content_items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all();
    return res.json({ items: rows });
  }
  const rows = db.prepare('SELECT * FROM content_items WHERE deleted_at IS NULL ORDER BY pinned DESC, sort_order ASC, created_at ASC').all();
  res.json({ items: rows });
});

// API: get single content item by id
app.get('/api/content-items/:id', authenticateAgent, (req, res) => {
  const row = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Content item not found' });
  res.json({ item: row });
});

// API: create content item (doc or table) — Gateway is source of truth
app.post('/api/content-items', authenticateAgent, async (req, res) => {
  const { type, title = '', parent_id = null, collection_id, columns } = req.body;
  if (!type || !['doc', 'table', 'board', 'presentation', 'spreadsheet', 'diagram'].includes(type)) {
    return res.status(400).json({ error: 'INVALID_TYPE', message: 'type must be "doc", "table", "board", "presentation", "spreadsheet", or "diagram"' });
  }

  const now = new Date().toISOString();
  const agentName = req.agent?.name || null;

  if (type === 'doc') {
    // Create document in local documents table (no Outline upstream)
    const docId = genId('doc');
    db.prepare(`INSERT INTO documents (id, title, text, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(docId, title || '', '', agentName, agentName, now, now);

    const nodeId = `doc:${docId}`;
    contentItemsUpsert.run(
      nodeId, docId, 'doc', title || '',
      null, parent_id, collection_id || null,
      agentName, agentName, now, now, null, Date.now()
    );
    const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
    return res.status(201).json({ item });
  }

  if (type === 'table') {
    if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });

    const tableTitle = title || 'Untitled';
    const result = await br('POST', `/api/database/tables/database/${NC_BASE_ID}/`, { name: tableTitle });
    if (result.status >= 400) return res.status(result.status).json({ error: 'UPSTREAM_ERROR', detail: result.data });

    const tableId = String(result.data.id);

    // Add requested columns
    const tableCols = columns || [
      { title: 'Notes', uidt: 'LongText' },
    ];
    for (const col of tableCols) {
      const colTitle = col.title || col.column_name;
      if (!colTitle) continue;
      try {
        const fieldBody = buildFieldCreateBody(colTitle, col.uidt || 'SingleLineText', { options: col.options });
        await br('POST', `/api/database/fields/table/${tableId}/`, fieldBody);
      } catch {}
    }

    // Add created_by column
    try { await br('POST', `/api/database/fields/table/${tableId}/`, { name: 'created_by', type: 'text' }); } catch {}

    // Rename default view to "Grid"
    try {
      const viewsResult = await br('GET', `/api/database/views/table/${tableId}/`);
      const views = Array.isArray(viewsResult.data) ? viewsResult.data : [];
      if (views.length > 0 && views[0].name !== 'Grid') {
        await br('PATCH', `/api/database/views/${views[0].id}/`, { name: 'Grid' });
      }
    } catch {}

    const fields = await getTableFields(tableId);
    const responseCols = fields.map(f => ({
      column_id: String(f.id), title: f.name, type: BR_TO_UIDT[f.type] || f.type,
    }));

    const nodeId = `table:${tableId}`;
    contentItemsUpsert.run(
      nodeId, tableId, 'table', tableTitle,
      null, parent_id, null,
      agentName, agentName,
      now, now, null, Date.now()
    );
    const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
    return res.status(201).json({ item, table_id: tableId, columns: responseCols });
  }

  if (type === 'board') {
    const id = crypto.randomUUID();
    const now = Date.now();
    const isoNow = new Date().toISOString();
    const agentName = req.agent?.name || null;
    const defaultData = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'asuite',
      elements: [],
      appState: {},
      files: {},
    });

    db.prepare(`INSERT INTO boards (id, data_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, defaultData, agentName, agentName, now, now);

    const nodeId = `board:${id}`;
    contentItemsUpsert.run(
      nodeId, id, 'board', title || '',
      null, parent_id, null,
      agentName, agentName, isoNow, isoNow, null, Date.now()
    );

    const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
    return res.status(201).json({ item });
  }

  if (type === 'presentation') {
    const id = crypto.randomUUID();
    const now = Date.now();
    const isoNow = new Date().toISOString();
    const agentName = req.agent?.name || null;
    const defaultData = JSON.stringify({ slides: [] });

    db.prepare(`INSERT INTO presentations (id, data_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, defaultData, agentName, agentName, now, now);

    const nodeId = `presentation:${id}`;
    contentItemsUpsert.run(
      nodeId, id, 'presentation', title || '',
      null, parent_id, null,
      agentName, agentName, isoNow, isoNow, null, Date.now()
    );

    const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
    return res.status(201).json({ item });
  }

  if (type === 'spreadsheet') {
    const id = crypto.randomUUID();
    const now = Date.now();
    const isoNow = new Date().toISOString();
    const agentName = req.agent?.name || null;
    const defaultData = JSON.stringify({});

    db.prepare(`INSERT INTO spreadsheets (id, data_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, defaultData, agentName, agentName, now, now);

    const nodeId = `spreadsheet:${id}`;
    contentItemsUpsert.run(
      nodeId, id, 'spreadsheet', title || '',
      null, parent_id, null,
      agentName, agentName, isoNow, isoNow, null, Date.now()
    );

    const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
    return res.status(201).json({ item });
  }

  if (type === 'diagram') {
    const id = crypto.randomUUID();
    const now = Date.now();
    const isoNow = new Date().toISOString();
    const agentName = req.agent?.name || null;
    const defaultData = JSON.stringify({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

    db.prepare(`INSERT INTO diagrams (id, data_json, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, defaultData, agentName, agentName, now, now);

    const nodeId = `diagram:${id}`;
    contentItemsUpsert.run(
      nodeId, id, 'diagram', title || '',
      null, parent_id, null,
      agentName, agentName, isoNow, isoNow, null, Date.now()
    );

    const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(nodeId);
    return res.status(201).json({ item });
  }
});

// API: soft-delete content item (move to trash)
app.delete('/api/content-items/:id', authenticateAgent, async (req, res) => {
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  const mode = req.query.mode || 'only'; // 'only' or 'all'
  const now = new Date().toISOString();

  if (item.type === 'doc') {
    if (mode === 'all') {
      // Collect all descendants recursively
      const collectDescendants = (parentId) => {
        const children = db.prepare('SELECT * FROM content_items WHERE parent_id = ? AND deleted_at IS NULL').all(parentId);
        let all = [...children];
        for (const child of children) {
          all = all.concat(collectDescendants(child.id));
        }
        return all;
      };
      const descendants = collectDescendants(req.params.id);

      // Soft-delete this item and its document
      db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
      db.prepare('UPDATE documents SET deleted_at = ? WHERE id = ?').run(now, item.raw_id);

      // Soft-delete descendants
      for (const desc of descendants) {
        db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, desc.id);
        if (desc.type === 'doc') {
          db.prepare('UPDATE documents SET deleted_at = ? WHERE id = ?').run(now, desc.raw_id);
        }
        // Tables: just soft-delete in content_items, don't delete from Baserow yet
      }
    } else {
      // mode === 'only': reparent children in content_items only (no Outline move needed)
      const children = db.prepare('SELECT * FROM content_items WHERE parent_id = ? AND deleted_at IS NULL').all(req.params.id);
      for (const child of children) {
        db.prepare('UPDATE content_items SET parent_id = ? WHERE id = ?').run(item.parent_id, child.id);
      }
      // Soft-delete this item and its document
      db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
      db.prepare('UPDATE documents SET deleted_at = ? WHERE id = ?').run(now, item.raw_id);
    }
  } else if (item.type === 'table') {
    // Soft-delete only — Baserow table data preserved until permanent delete
    db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
  } else if (item.type === 'board') {
    // Soft-delete only — board data preserved until permanent delete
    db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
  } else if (item.type === 'presentation') {
    // Soft-delete only — presentation data preserved until permanent delete
    db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
  } else if (item.type === 'spreadsheet') {
    // Soft-delete only — spreadsheet data preserved until permanent delete
    db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
  } else if (item.type === 'diagram') {
    // Soft-delete only — diagram data preserved until permanent delete
    db.prepare('UPDATE content_items SET deleted_at = ? WHERE id = ?').run(now, req.params.id);
  }

  res.json({ deleted: true });
});

// API: restore content item from trash
app.post('/api/content-items/:id/restore', authenticateAgent, async (req, res) => {
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!item.deleted_at) return res.status(400).json({ error: 'NOT_DELETED' });

  // Clear deleted_at
  db.prepare('UPDATE content_items SET deleted_at = NULL WHERE id = ?').run(req.params.id);

  // Restore document record if doc
  if (item.type === 'doc') {
    db.prepare('UPDATE documents SET deleted_at = NULL WHERE id = ?').run(item.raw_id);
  }
  // Tables: nothing to do in Baserow (data was never deleted)

  const restored = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  res.json({ item: restored });
});

// API: permanently delete content item
app.delete('/api/content-items/:id/permanent', authenticateAgent, async (req, res) => {
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  if (item.type === 'doc') {
    // Permanently delete from local documents table
    db.prepare('DELETE FROM documents WHERE id = ?').run(item.raw_id);
  } else if (item.type === 'table') {
    if (NC_EMAIL && NC_PASSWORD) {
      await br('DELETE', `/api/database/tables/${item.raw_id}/`).catch(() => {});
      invalidateFieldCache(item.raw_id);
    }
  } else if (item.type === 'board') {
    db.prepare('DELETE FROM boards WHERE id = ?').run(item.raw_id);
  } else if (item.type === 'presentation') {
    db.prepare('DELETE FROM presentations WHERE id = ?').run(item.raw_id);
  } else if (item.type === 'spreadsheet') {
    db.prepare('DELETE FROM spreadsheets WHERE id = ?').run(item.raw_id);
  } else if (item.type === 'diagram') {
    db.prepare('DELETE FROM diagrams WHERE id = ?').run(item.raw_id);
  }

  // Remove from content_items
  db.prepare('DELETE FROM content_items WHERE id = ?').run(req.params.id);
  // Clean up related data
  db.prepare('DELETE FROM doc_icons WHERE doc_id = ?').run(item.raw_id);

  res.json({ deleted: true });
});

// API: force sync content items (manual/repair tool only — not used in normal operation)
app.post('/api/content-items/sync', authenticateAgent, async (req, res) => {
  await syncContentItems();
  const rows = db.prepare('SELECT * FROM content_items WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC').all();
  res.json({ items: rows, synced_at: Date.now() });
});

// API: update content item metadata (icon, parent, sort_order) — local-only changes
app.patch('/api/content-items/:id', authenticateAgent, (req, res) => {
  const { icon, parent_id, sort_order, title, pinned } = req.body;
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  const updates = [];
  const params = [];
  if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
  if (parent_id !== undefined) { updates.push('parent_id = ?'); params.push(parent_id); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (pinned !== undefined) { updates.push('pinned = ?'); params.push(pinned ? 1 : 0); }
  if (updates.length === 0) return res.json(item);

  params.push(req.params.id);
  db.prepare(`UPDATE content_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  // Also sync icon to doc_icons for backward compat
  if (icon !== undefined) {
    if (icon) {
      db.prepare('INSERT INTO doc_icons (doc_id, icon, updated_at) VALUES (?, ?, ?) ON CONFLICT(doc_id) DO UPDATE SET icon = excluded.icon, updated_at = excluded.updated_at')
        .run(item.raw_id, icon, Date.now());
    } else {
      db.prepare('DELETE FROM doc_icons WHERE doc_id = ?').run(item.raw_id);
    }
  }
  const updated = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// API: batch update sort/parent for drag-and-drop reordering
app.put('/api/content-items/tree', authenticateAgent, (req, res) => {
  const { items } = req.body; // [{ id, parent_id, sort_order }]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: '"items" array required' });
  const stmt = db.prepare('UPDATE content_items SET parent_id = ?, sort_order = ? WHERE id = ?');
  const tx = db.transaction((list) => {
    for (const item of list) {
      stmt.run(item.parent_id ?? null, item.sort_order ?? 0, item.id);
    }
  });
  tx(items);
  res.json({ updated: items.length });
});

// ─── Preferences (key-value store) ────────────────
const PREFS_DIR = path.join(__dirname, 'data', 'preferences');
fs.mkdirSync(PREFS_DIR, { recursive: true });

function prefsPath(key) {
  // Sanitize key to prevent path traversal
  const safe = key.replace(/[^a-zA-Z0-9_\-:.]/g, '_');
  return path.join(PREFS_DIR, `${safe}.json`);
}

app.get('/api/preferences/:key', authenticateAgent, (req, res) => {
  const filePath = prefsPath(req.params.key);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return res.json({ key: req.params.key, value: data.value });
    }
    return res.status(404).json({ error: 'NOT_FOUND', message: `Preference "${req.params.key}" not found` });
  } catch (e) {
    return res.status(500).json({ error: 'READ_ERROR', message: e.message });
  }
});

app.put('/api/preferences/:key', authenticateAgent, (req, res) => {
  const filePath = prefsPath(req.params.key);
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: '"value" field required' });
  }
  try {
    fs.writeFileSync(filePath, JSON.stringify({ key: req.params.key, value, updated_at: Date.now() }), 'utf8');
    return res.json({ key: req.params.key, value, updated_at: Date.now() });
  } catch (e) {
    return res.status(500).json({ error: 'WRITE_ERROR', message: e.message });
  }
});

// ─── Health Check ─────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── File upload proxy (for Baserow attachments) ──────────────
const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

app.post('/api/data/upload', authenticateAgent, fileUpload.array('files', 10), async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'NO_FILES' });

  try {
    const brJwt = await getBrJwt();
    const results = [];
    for (const file of req.files) {
      const form = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      form.append('file', blob, file.originalname);

      const uploadRes = await fetch(`${BR_URL}/api/user-files/upload-file/`, {
        method: 'POST',
        headers: { 'Authorization': `JWT ${brJwt}` },
        body: form,
      });
      if (!uploadRes.ok) {
        const detail = await uploadRes.text();
        return res.status(uploadRes.status).json({ error: 'UPLOAD_FAILED', detail });
      }
      const data = await uploadRes.json();
      // Map Baserow response to gateway-compatible format
      results.push({
        path: data.url,
        title: data.original_name || file.originalname,
        mimetype: data.mime_type || file.mimetype,
        size: data.size || file.size,
        url: data.url,
        thumbnails: data.thumbnails,
      });
    }
    res.json(results);
  } catch (e) {
    console.error('[gateway] File upload error:', e);
    res.status(500).json({ error: 'UPLOAD_ERROR', detail: e.message });
  }
});

// ─── File download proxy (for Baserow attachment URLs) ──────────────
// Query-parameter based route
app.get('/api/data/dl', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'MISSING_PATH' });
  try {
    // Baserow file URLs are direct — just proxy them
    const targetUrl = filePath.startsWith('http') ? filePath : `${BR_URL}${filePath.startsWith('/') ? filePath : '/' + filePath}`;
    const brRes = await fetch(targetUrl);
    if (!brRes.ok) return res.status(brRes.status).send('Not found');
    res.set('Content-Type', brRes.headers.get('content-type') || 'application/octet-stream');
    const cacheControl = brRes.headers.get('cache-control');
    if (cacheControl) res.set('Cache-Control', cacheControl);
    const buffer = Buffer.from(await brRes.arrayBuffer());
    res.send(buffer);
  } catch (e) {
    console.error('[gateway] File download proxy error:', e);
    res.status(500).json({ error: 'DOWNLOAD_ERROR' });
  }
});
// Legacy path-based route (kept for backward compat)
app.get('/api/data/download/*', authenticateAgent, async (req, res) => {
  if (!NC_EMAIL || !NC_PASSWORD) return res.status(503).json({ error: 'BASEROW_NOT_CONFIGURED' });
  try {
    const brPath = '/' + req.params[0];
    const targetUrl = brPath.startsWith('http') ? brPath : `${BR_URL}${brPath}`;
    const brRes = await fetch(targetUrl);
    if (!brRes.ok) return res.status(brRes.status).send('Not found');
    res.set('Content-Type', brRes.headers.get('content-type') || 'application/octet-stream');
    const cacheControl = brRes.headers.get('cache-control');
    if (cacheControl) res.set('Cache-Control', cacheControl);
    const buffer = Buffer.from(await brRes.arrayBuffer());
    res.send(buffer);
  } catch (e) {
    console.error('[gateway] File download proxy error:', e);
    res.status(500).json({ error: 'DOWNLOAD_ERROR' });
  }
});

// ─── Table Comments (SQLite-backed) ──────────────

// List row IDs that have comments for a table
app.get('/api/data/tables/:table_id/commented-rows', authenticateAgent, (req, res) => {
  const { table_id } = req.params;
  const rows = db.prepare('SELECT DISTINCT row_id, COUNT(*) as count FROM table_comments WHERE table_id = ? AND row_id IS NOT NULL GROUP BY row_id').all(table_id);
  res.json({ rows: rows.map(r => ({ row_id: r.row_id, count: r.count })) });
});

// List comments for a table (optionally filtered by row_id)
app.get('/api/data/tables/:table_id/comments', authenticateAgent, (req, res) => {
  const { table_id } = req.params;
  const { row_id, include_all } = req.query; // row_id: filter by row; include_all: return all comments
  let rows;
  if (row_id) {
    rows = db.prepare('SELECT * FROM table_comments WHERE table_id = ? AND row_id = ? ORDER BY created_at ASC').all(table_id, row_id);
  } else if (include_all === '1' || include_all === 'true') {
    // All comments (table-level + all row-level)
    rows = db.prepare('SELECT * FROM table_comments WHERE table_id = ? ORDER BY created_at ASC').all(table_id);
  } else {
    // Table-level comments only (row_id IS NULL)
    rows = db.prepare('SELECT * FROM table_comments WHERE table_id = ? AND row_id IS NULL ORDER BY created_at ASC').all(table_id);
  }
  const comments = rows.map(r => ({
    id: r.id,
    text: r.text,
    actor: r.actor,
    actor_id: r.actor_id,
    parent_id: r.parent_id || null,
    row_id: r.row_id || null,
    resolved_by: r.resolved_by ? { id: r.resolved_by, name: r.resolved_by } : null,
    resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  }));
  res.json({ comments });
});

// Create a table comment (table-level or row-level)
app.post('/api/data/tables/:table_id/comments', authenticateAgent, (req, res) => {
  const { table_id } = req.params;
  const { text, parent_id, row_id } = req.body;
  if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });

  const agent = req.agent;
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(`INSERT INTO table_comments (id, table_id, row_id, parent_id, text, actor, actor_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, table_id, row_id || null, parent_id || null, text,
    agent.display_name || agent.name, agent.id, now, now
  );

  // Notify agents mentioned via @agentname
  try {
    const allAgents = db.prepare('SELECT * FROM agent_accounts').all();
    for (const target of allAgents) {
      // Skip if the comment author is this agent
      if (target.id === agent.id) continue;
      const mentionRegex = new RegExp(`@${target.name}(?![\\w-])`, 'i');
      if (!mentionRegex.test(text)) continue;

      const cleanText = text.replace(new RegExp(`@${target.name}(?![\\w-])\\s*`, 'gi'), '').trim();
      const evt = {
        event: 'data.commented',
        source: 'table_comments',
        event_id: genId('evt'),
        timestamp: now,
        data: {
          comment_id: id,
          table_id,
          row_id: row_id || null,
          text: cleanText,
          raw_text: text,
          sender: { name: agent.display_name || agent.name, type: agent.type || 'agent' },
        },
      };
      db.prepare(`INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(evt.event_id, target.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), Date.now());
      pushEvent(target.id, evt);
      if (target.webhook_url) deliverWebhook(target, evt).catch(() => {});
      console.log(`[gateway] Event ${evt.event} → ${target.name} (table: ${table_id}, row: ${row_id || 'none'})`);
    }
  } catch (e) {
    console.error(`[gateway] Table comment notification error: ${e.message}`);
  }

  res.status(201).json({
    id,
    text,
    actor: agent.display_name || agent.name,
    actor_id: agent.id,
    parent_id: parent_id || null,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  });
});

// Update a table comment (edit text)
app.patch('/api/data/table-comments/:comment_id', authenticateAgent, (req, res) => {
  const { comment_id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });

  const now = Date.now();
  const result = db.prepare('UPDATE table_comments SET text = ?, updated_at = ? WHERE id = ?').run(text, now, comment_id);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ updated: true });
});

// Delete a table comment
app.delete('/api/data/table-comments/:comment_id', authenticateAgent, (req, res) => {
  const { comment_id } = req.params;
  const result = db.prepare('DELETE FROM table_comments WHERE id = ?').run(comment_id);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ deleted: true });
});

// Resolve a table comment
app.post('/api/data/table-comments/:comment_id/resolve', authenticateAgent, (req, res) => {
  const agent = req.agent;
  const now = Date.now();
  const result = db.prepare('UPDATE table_comments SET resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?')
    .run(agent.display_name || agent.name, now, now, req.params.comment_id);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ resolved: true });
});

// Unresolve a table comment
app.post('/api/data/table-comments/:comment_id/unresolve', authenticateAgent, (req, res) => {
  const now = Date.now();
  const result = db.prepare('UPDATE table_comments SET resolved_by = NULL, resolved_at = NULL, updated_at = ? WHERE id = ?')
    .run(now, req.params.comment_id);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ unresolved: true });
});

// ─── Table Snapshots (History Versioning) ─────────

// Create a snapshot of a table's current state
async function createTableSnapshot(tableId, triggerType, agent) {
  // 1. Fetch table schema from Baserow
  const fields = await getTableFields(tableId);
  const columns = fields.map(f => {
    const col = { id: String(f.id), title: f.name, uidt: BR_TO_UIDT[f.type] || f.type, pk: !!f.primary, rqd: false };
    if (f.select_options) col.colOptions = { options: f.select_options.map((o, i) => ({ title: o.value, color: o.color, order: i + 1 })) };
    if (f.formula) col.formula_raw = f.formula;
    return col;
  });
  const schemaJson = JSON.stringify(columns);

  // 2. Fetch ALL rows (paginate at 200 per page)
  const allRows = [];
  let page = 1;
  while (true) {
    const rowResult = await br('GET', `/api/database/rows/table/${tableId}/?user_field_names=true&size=200&page=${page}`, null, { useToken: true });
    if (rowResult.status >= 400) throw new Error(`Failed to fetch rows: ${rowResult.status}`);
    const list = rowResult.data?.results || [];
    // Normalize rows
    for (const row of list) {
      const normalized = normalizeRowForGateway(row, fields);
      allRows.push(normalized);
    }
    if (!rowResult.data?.next) break;
    page++;
  }
  const dataJson = JSON.stringify(allRows);

  // 3. Get next version number
  const lastVersion = db.prepare('SELECT MAX(version) as maxV FROM table_snapshots WHERE table_id = ?').get(tableId);
  const version = (lastVersion?.maxV || 0) + 1;

  // 4. Insert snapshot
  const result = db.prepare(
    'INSERT INTO table_snapshots (table_id, version, schema_json, data_json, trigger_type, agent, row_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(tableId, version, schemaJson, dataJson, triggerType, agent || null, allRows.length);

  // 5. Retention cleanup: keep last 20 or last 30 days, whichever keeps more
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const countAll = db.prepare('SELECT COUNT(*) as cnt FROM table_snapshots WHERE table_id = ?').get(tableId);
  if (countAll.cnt > 20) {
    // Find the 20th newest snapshot's id
    const fiftieth = db.prepare('SELECT id FROM table_snapshots WHERE table_id = ? ORDER BY version DESC LIMIT 1 OFFSET 19').get(tableId);
    if (fiftieth) {
      // Delete snapshots older than both the 50th and 30 days
      db.prepare('DELETE FROM table_snapshots WHERE table_id = ? AND id < ? AND created_at < ?')
        .run(tableId, fiftieth.id, thirtyDaysAgo);
    }
  }

  return {
    id: result.lastInsertRowid,
    version,
    table_id: tableId,
    trigger_type: triggerType,
    agent: agent || null,
    row_count: allRows.length,
    created_at: new Date().toISOString(),
  };
}

// Check if auto-snapshot is needed (last snapshot older than 5 minutes)
async function maybeAutoSnapshot(tableId, agent) {
  try {
    const last = db.prepare('SELECT created_at FROM table_snapshots WHERE table_id = ? ORDER BY version DESC LIMIT 1').get(tableId);
    if (last) {
      const lastTime = new Date(last.created_at).getTime();
      if (Date.now() - lastTime < 30 * 60 * 1000) return; // less than 30 minutes ago
    }
    await createTableSnapshot(tableId, 'auto', agent);
  } catch (e) {
    console.error(`[gateway] Auto-snapshot failed for ${tableId}: ${e.message}`);
  }
}

// List snapshots (without large data fields)
app.get('/api/data/:table_id/snapshots', authenticateAgent, (req, res) => {
  const snapshots = db.prepare(
    'SELECT id, version, trigger_type, agent, row_count, created_at FROM table_snapshots WHERE table_id = ? ORDER BY version DESC'
  ).all(req.params.table_id);
  res.json({ snapshots });
});

// Get a single snapshot (full data)
app.get('/api/data/:table_id/snapshots/:snapshot_id', authenticateAgent, (req, res) => {
  const snap = db.prepare(
    'SELECT * FROM table_snapshots WHERE id = ? AND table_id = ?'
  ).get(req.params.snapshot_id, req.params.table_id);
  if (!snap) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(snap);
});

// Manually create a snapshot
app.post('/api/data/:table_id/snapshots', authenticateAgent, async (req, res) => {
  try {
    const { agent: agentName } = req.body || {};
    const snap = await createTableSnapshot(req.params.table_id, 'manual', agentName || req.agent.display_name || req.agent.name);
    res.status(201).json(snap);
  } catch (e) {
    console.error(`[gateway] Manual snapshot failed: ${e.message}`);
    res.status(500).json({ error: 'SNAPSHOT_FAILED', message: e.message });
  }
});

// Restore a snapshot
app.post('/api/data/:table_id/snapshots/:snapshot_id/restore', authenticateAgent, async (req, res) => {
  const snap = db.prepare('SELECT * FROM table_snapshots WHERE id = ? AND table_id = ?')
    .get(req.params.snapshot_id, req.params.table_id);
  if (!snap) return res.status(404).json({ error: 'NOT_FOUND' });

  try {
    // 1. Create pre-restore snapshot
    const preRestore = await createTableSnapshot(req.params.table_id, 'pre_restore', req.agent.display_name || req.agent.name);

    // 2. Read snapshot data
    const snapshotRows = JSON.parse(snap.data_json);

    // 3. Delete all current rows
    let delPage = 1;
    while (true) {
      const currentRows = await br('GET', `/api/database/rows/table/${req.params.table_id}/?size=200&page=1`, null, { useToken: true });
      if (currentRows.status >= 400) break;
      const list = currentRows.data?.results || [];
      if (list.length === 0) break;
      for (const row of list) {
        if (row.id) {
          await br('DELETE', `/api/database/rows/table/${req.params.table_id}/${row.id}/`, null, { useToken: true });
        }
      }
    }

    // 4. Get current schema and recreate missing columns from snapshot
    const currentFields = await getTableFields(req.params.table_id);
    const currentCols = new Set(currentFields.map(f => f.name));

    // 4b. Recreate columns from snapshot that are missing in current table
    const snapshotSchema = JSON.parse(snap.schema_json || '[]');
    const SYSTEM_UIDTS = new Set(['ID', 'CreateTime', 'LastModifiedTime', 'CreatedBy', 'LastModifiedBy', 'AutoNumber', 'created_on', 'last_modified', 'autonumber']);
    for (const col of snapshotSchema) {
      if (currentCols.has(col.title)) continue;
      if (col.pk) continue;
      if (SYSTEM_UIDTS.has(col.uidt)) continue;
      try {
        const fieldBody = buildFieldCreateBody(col.title, col.uidt, {
          options: col.colOptions?.options?.map(o => ({ title: o.title, color: o.color })),
          formula_raw: col.formula_raw,
        });
        const createResult = await br('POST', `/api/database/fields/table/${req.params.table_id}/`, fieldBody);
        if (createResult.status < 400) {
          currentCols.add(col.title);
          console.log(`[gateway] Restore: recreated column "${col.title}" (${col.uidt})`);
        } else {
          console.warn(`[gateway] Restore: failed to recreate column "${col.title}": ${JSON.stringify(createResult.data)}`);
        }
      } catch (colErr) {
        console.warn(`[gateway] Restore: error recreating column "${col.title}": ${colErr.message}`);
      }
    }
    invalidateFieldCache(req.params.table_id);
    const newFields = await getTableFields(req.params.table_id);

    // 5. Insert rows from snapshot
    let restored = 0;
    for (const row of snapshotRows) {
      const cleanRow = {};
      for (const [key, val] of Object.entries(row)) {
        if (['Id', 'id', 'order', 'nc_id', 'CreatedAt', 'UpdatedAt', 'created_at', 'updated_at'].includes(key)) continue;
        if (currentCols.has(key)) {
          cleanRow[key] = val;
        }
      }
      if (Object.keys(cleanRow).length > 0) {
        const normalized = normalizeRowForBaserow(cleanRow, newFields);
        await br('POST', `/api/database/rows/table/${req.params.table_id}/?user_field_names=true`, normalized, { useToken: true });
        restored++;
      }
    }

    res.json({ success: true, restored_rows: restored, pre_restore_snapshot_id: preRestore.id });
  } catch (e) {
    console.error(`[gateway] Restore failed: ${e.message}`);
    res.status(500).json({ error: 'RESTORE_FAILED', message: e.message });
  }
});

// ─── Global Search ──────────────────────────────
app.get('/api/search', authenticateAny, (req, res) => {
  const { q, limit = '20' } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: 'MISSING_QUERY', message: 'q parameter required' });

  const lim = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
  const results = [];

  // 1. Search documents via FTS
  try {
    const docResults = db.prepare(`
      SELECT d.id, d.title, snippet(documents_fts, 2, '', '', '...', 40) as snippet, d.updated_at
      FROM documents_fts fts
      JOIN documents d ON d.id = fts.id
      WHERE documents_fts MATCH ? AND d.deleted_at IS NULL
      ORDER BY rank
      LIMIT ?
    `).all(q, lim);
    for (const r of docResults) {
      results.push({ id: `doc:${r.id}`, type: 'doc', title: r.title, snippet: r.snippet || '', updated_at: r.updated_at });
    }
  } catch {
    // Fallback for invalid FTS syntax — use LIKE
    const docResults = db.prepare(
      'SELECT id, title, text, updated_at FROM documents WHERE deleted_at IS NULL AND (title LIKE ? OR text LIKE ?) ORDER BY updated_at DESC LIMIT ?'
    ).all(`%${q}%`, `%${q}%`, lim);
    for (const r of docResults) {
      const idx = (r.text || '').toLowerCase().indexOf(q.toLowerCase());
      const snippet = idx >= 0 ? r.text.substring(Math.max(0, idx - 40), idx + q.length + 40) : (r.text || '').substring(0, 80);
      results.push({ id: `doc:${r.id}`, type: 'doc', title: r.title, snippet, updated_at: r.updated_at });
    }
  }

  // 2. Search content_items (tables, presentations, boards, spreadsheets, diagrams) by title
  try {
    const itemResults = db.prepare(
      "SELECT id, type, title, updated_at FROM content_items WHERE deleted_at IS NULL AND type != 'doc' AND title LIKE ? ORDER BY updated_at DESC LIMIT ?"
    ).all(`%${q}%`, lim);
    for (const r of itemResults) {
      results.push({ id: r.id, type: r.type, title: r.title, snippet: '', updated_at: r.updated_at });
    }
  } catch { /* content_items may not exist yet */ }

  // Sort combined results by updated_at descending, trim to limit
  results.sort((a, b) => {
    const ta = typeof a.updated_at === 'number' ? a.updated_at : new Date(a.updated_at || 0).getTime();
    const tb = typeof b.updated_at === 'number' ? b.updated_at : new Date(b.updated_at || 0).getTime();
    return tb - ta;
  });

  res.json({ results: results.slice(0, lim) });
});

// ─── Notifications ──────────────────────────────
// GET /api/notifications — list for current actor
app.get('/api/notifications', authenticateAny, (req, res) => {
  const { unread, limit = '50' } = req.query;
  const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
  const actorId = req.actor.id;

  let sql = 'SELECT * FROM notifications WHERE target_actor_id = ?';
  const params = [actorId];
  if (unread === 'true') {
    sql += ' AND read = 0';
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(lim);

  const rows = db.prepare(sql).all(...params);
  res.json({ notifications: rows });
});

// GET /api/notifications/unread-count
app.get('/api/notifications/unread-count', authenticateAny, (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE target_actor_id = ? AND read = 0').get(req.actor.id);
  res.json({ count: row.count });
});

// PATCH /api/notifications/:id/read — mark single as read
app.patch('/api/notifications/:id/read', authenticateAny, (req, res) => {
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND target_actor_id = ?').run(req.params.id, req.actor.id);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
});

// POST /api/notifications/mark-all-read
app.post('/api/notifications/mark-all-read', authenticateAny, (req, res) => {
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE target_actor_id = ? AND read = 0').run(req.actor.id);
  res.json({ ok: true, updated: result.changes });
});

// POST /api/notifications — create (admin or agent only)
app.post('/api/notifications', authenticateAny, (req, res) => {
  if (req.actor.type !== 'agent' && req.actor.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only agents or admins can create notifications' });
  }
  const { target_actor_id, type, title, body, link } = req.body;
  if (!target_actor_id || !type || !title) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'target_actor_id, type, and title are required' });
  }
  const id = genId('notif');
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO notifications (id, actor_id, target_actor_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.actor.id, target_actor_id, type, title, body || null, link || null, now);
  res.status(201).json({ id, created_at: now });
});

// ─── Content Comments (Generic — presentations, diagrams, etc.) ─────────
// List comments for a content item
app.get('/api/content-items/:id/comments', authenticateAgent, (req, res) => {
  const contentId = decodeURIComponent(req.params.id);
  const rows = db.prepare(
    'SELECT * FROM content_comments WHERE content_id = ? ORDER BY created_at ASC'
  ).all(contentId);
  const comments = rows.map(r => ({
    id: r.id,
    text: r.text,
    actor: r.author,
    actor_id: r.actor_id,
    parent_id: r.parent_comment_id || null,
    resolved_by: r.resolved_by ? { id: r.resolved_by, name: r.resolved_by } : null,
    resolved_at: r.resolved_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  res.json({ comments });
});

// Create a content comment
app.post('/api/content-items/:id/comments', authenticateAgent, (req, res) => {
  const contentId = decodeURIComponent(req.params.id);
  const { text, parent_comment_id } = req.body;
  if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });

  const agent = req.agent;
  const id = genId('ccmt');
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO content_comments (id, content_id, text, author, actor_id, parent_comment_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, contentId, text, agent.display_name || agent.name, agent.id, parent_comment_id || null, now, now);

  res.status(201).json({
    id,
    text,
    actor: agent.display_name || agent.name,
    actor_id: agent.id,
    parent_id: parent_comment_id || null,
    resolved_by: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
  });
});

// Edit a content comment
app.patch('/api/content-comments/:commentId', authenticateAgent, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'text required' });

  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE content_comments SET text = ?, updated_at = ? WHERE id = ?'
  ).run(text, now, req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ updated: true });
});

// Delete a content comment
app.delete('/api/content-comments/:commentId', authenticateAgent, (req, res) => {
  const result = db.prepare('DELETE FROM content_comments WHERE id = ?').run(req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ deleted: true });
});

// Resolve a content comment
app.post('/api/content-comments/:commentId/resolve', authenticateAgent, (req, res) => {
  const agent = req.agent;
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE content_comments SET resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?'
  ).run(agent.display_name || agent.name, now, now, req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ resolved: true });
});

// Unresolve a content comment
app.post('/api/content-comments/:commentId/unresolve', authenticateAgent, (req, res) => {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE content_comments SET resolved_by = NULL, resolved_at = NULL, updated_at = ? WHERE id = ?'
  ).run(now, req.params.commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ unresolved: true });
});

// ─── Content Revisions (Generic — presentations, diagrams, etc.) ─────────
// List revisions for a content item
app.get('/api/content-items/:id/revisions', authenticateAgent, (req, res) => {
  const contentId = decodeURIComponent(req.params.id);
  const rows = db.prepare(
    'SELECT * FROM content_revisions WHERE content_id = ? ORDER BY created_at DESC'
  ).all(contentId);
  const revisions = rows.map(r => ({
    id: r.id,
    content_id: r.content_id,
    data: (() => { try { return JSON.parse(r.data); } catch { return null; } })(),
    created_at: r.created_at,
    created_by: r.created_by,
  }));
  res.json({ revisions });
});

// Create a revision (snapshot)
app.post('/api/content-items/:id/revisions', authenticateAgent, (req, res) => {
  const contentId = decodeURIComponent(req.params.id);
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'data required' });

  const agent = req.agent;
  const id = genId('crev');
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO content_revisions (id, content_id, data, created_at, created_by)
    VALUES (?, ?, ?, ?, ?)`)
    .run(id, contentId, JSON.stringify(data), now, agent.display_name || agent.name);

  res.status(201).json({ id, content_id: contentId, created_at: now, created_by: agent.display_name || agent.name });
});

// Restore a revision — returns the revision data for the client to apply
app.post('/api/content-items/:id/revisions/:revId/restore', authenticateAgent, (req, res) => {
  const contentId = decodeURIComponent(req.params.id);
  const revision = db.prepare(
    'SELECT * FROM content_revisions WHERE id = ? AND content_id = ?'
  ).get(req.params.revId, contentId);
  if (!revision) return res.status(404).json({ error: 'REVISION_NOT_FOUND' });

  let data;
  try { data = JSON.parse(revision.data); } catch { return res.status(500).json({ error: 'INVALID_REVISION_DATA' }); }
  res.json({ data, revision_id: revision.id, created_at: revision.created_at });
});

// ─── Start ───────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[gateway] ASuite API Gateway listening on :${PORT}`);
  console.log(`[gateway] Admin token: ${ADMIN_TOKEN}`);
  // Start Baserow comment polling every 15s
  setInterval(pollNcComments, 15000);
  console.log('[gateway] Baserow comment polling started (15s interval)');
  // Content items: no periodic sync — Gateway is source of truth.
  // Use POST /api/content-items/sync manually if needed for repair/migration.
  console.log('[gateway] Content items managed by Gateway (no periodic sync)');
});
