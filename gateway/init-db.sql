-- ASuite Gateway Database Schema

CREATE TABLE IF NOT EXISTS agent_accounts (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  capabilities TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  online      INTEGER DEFAULT 0,
  last_seen_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  avatar_url  TEXT,
  ol_token    TEXT,   -- per-agent Outline API token
  plane_token TEXT,   -- per-agent Plane API token
  nc_password TEXT    -- per-agent NocoDB password (agent email = name@nc-agents.local)
);

CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,
  label       TEXT,
  expires_at  INTEGER NOT NULL,
  used        INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  source      TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  payload     TEXT NOT NULL,
  delivered   INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_agent_time ON events(agent_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_agent_undelivered ON events(agent_id, delivered, occurred_at);

-- Thread context links: cross-system associations
CREATE TABLE IF NOT EXISTS thread_links (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,       -- MM thread root_id (or synthetic thread ID)
  link_type   TEXT NOT NULL,       -- 'doc', 'task', 'data_row'
  link_id     TEXT NOT NULL,       -- doc_id, task_id, or table_id:row_id
  link_title  TEXT,
  created_by  TEXT NOT NULL,       -- agent_id that created the link
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thread_links_thread ON thread_links(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_links_link ON thread_links(link_type, link_id);
