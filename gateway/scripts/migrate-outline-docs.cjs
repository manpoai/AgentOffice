#!/usr/bin/env node
/**
 * Migrate all documents, revisions, comments, and attachments from Outline to Gateway SQLite.
 *
 * Usage:
 *   OL_URL=http://localhost:3000 OL_TOKEN=<token> node scripts/migrate-outline-docs.js
 *
 * Prerequisites:
 *   - Gateway must have been started at least once (to create the SQLite tables)
 *   - Outline must be running and accessible
 */

const Database = require('better-sqlite3');
const pathMod = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const OL_URL = process.env.OL_URL || 'http://localhost:3000';
const OL_TOKEN = process.env.OL_TOKEN;
const DB_PATH = pathMod.join(__dirname, '..', 'gateway.db');
const UPLOADS_DIR = pathMod.join(__dirname, '..', 'uploads', 'files');

if (!OL_TOKEN) {
  console.error('Error: Set OL_TOKEN environment variable');
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error('Error: gateway.db not found. Start the gateway at least once first.');
  process.exit(1);
}

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(DB_PATH);

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function olFetch(endpoint, body = {}) {
  const resp = await fetch(`${OL_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Outline ${endpoint}: ${resp.status}`);
  return resp.json();
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${OL_URL}${url}`;
    const mod = fullUrl.startsWith('https') ? https : http;
    mod.get(fullUrl, { headers: { 'Authorization': `Bearer ${OL_TOKEN}` } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const ws = fs.createWriteStream(destPath);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(); });
      ws.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Outline -> Gateway Migration ===\n');

  // 1. Migrate documents
  console.log('1. Migrating documents...');
  let offset = 0, docCount = 0;
  const insertDoc = db.prepare(`INSERT OR REPLACE INTO documents (id, title, text, icon, full_width, created_by, updated_by, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  while (true) {
    const data = await olFetch('documents.list', { limit: 100, offset, sort: 'updatedAt', direction: 'DESC' });
    if (!data.data?.length) break;
    for (const d of data.data) {
      try {
        const full = await olFetch('documents.info', { id: d.id });
        const doc = full.data;
        insertDoc.run(
          doc.id, doc.title, doc.text || '', doc.icon || doc.emoji || null,
          doc.fullWidth ? 1 : 0,
          doc.createdBy?.name || null, doc.updatedBy?.name || null,
          doc.createdAt, doc.updatedAt, doc.deletedAt || null
        );
        docCount++;
        process.stdout.write(`  Documents: ${docCount}\r`);
      } catch (e) {
        console.warn(`  Warn: doc ${d.id}: ${e.message}`);
      }
    }
    if (data.data.length < 100) break;
    offset += 100;
  }
  console.log(`  Documents: ${docCount} migrated`);

  // 2. Migrate revisions
  console.log('2. Migrating revisions...');
  let revCount = 0;
  const insertRev = db.prepare(`INSERT OR REPLACE INTO document_revisions (id, document_id, title, data_json, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const allDocs = db.prepare('SELECT id FROM documents').all();
  for (const { id: docId } of allDocs) {
    try {
      const data = await olFetch('revisions.list', { documentId: docId });
      for (const rev of (data.data || [])) {
        insertRev.run(rev.id, docId, rev.title || '', JSON.stringify(rev.data), rev.createdBy?.name || null, rev.createdAt);
        revCount++;
      }
    } catch (e) {
      console.warn(`  Warn: revisions for ${docId}: ${e.message}`);
    }
  }
  console.log(`  Revisions: ${revCount} migrated`);

  // 3. Migrate comments
  console.log('3. Migrating comments...');
  let cmtCount = 0;
  const insertCmt = db.prepare(`INSERT OR REPLACE INTO document_comments (id, document_id, parent_id, data_json, actor, actor_id, resolved_by, resolved_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const { id: docId } of allDocs) {
    try {
      const data = await olFetch('comments.list', { documentId: docId });
      for (const c of (data.data || [])) {
        insertCmt.run(c.id, docId, c.parentCommentId || null, JSON.stringify(c.data),
          c.createdBy?.name || 'Unknown', c.createdById || null,
          c.resolvedBy?.name || null, c.resolvedAt || null,
          c.createdAt, c.updatedAt);
        cmtCount++;
      }
    } catch (e) {
      console.warn(`  Warn: comments for ${docId}: ${e.message}`);
    }
  }
  console.log(`  Comments: ${cmtCount} migrated`);

  // 4. Download and rewrite attachment URLs
  console.log('4. Migrating attachments...');
  let attCount = 0;
  const urlMap = {};

  // Find all Outline attachment URLs in documents
  const allDocsText = db.prepare('SELECT id, text FROM documents').all();
  const urlRegex = /(?:\/api\/outline\/attachments\/[^\s)"]+|\/api\/attachments\.[^\s)"]+|https?:\/\/[^\s)"]*\/api\/attachments\.[^\s)"]+)/g;

  for (const { id: docId, text } of allDocsText) {
    const matches = text.match(urlRegex);
    if (!matches) continue;
    for (const url of [...new Set(matches)]) {
      if (urlMap[url]) continue;
      try {
        const ext = pathMod.extname(url.split('?')[0]) || '.png';
        const filename = `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const fullUrl = url.startsWith('http') ? url : `${OL_URL}${url.replace('/api/outline/', '/api/')}`;
        await downloadFile(fullUrl, pathMod.join(UPLOADS_DIR, filename));
        urlMap[url] = `/api/uploads/files/${filename}`;
        attCount++;
        process.stdout.write(`  Attachments: ${attCount}\r`);
      } catch (e) {
        console.warn(`  Warn: download ${url}: ${e.message}`);
      }
    }
  }

  // Rewrite URLs in documents
  if (Object.keys(urlMap).length > 0) {
    console.log(`\n  Rewriting URLs in ${Object.keys(urlMap).length} attachments...`);
    const updateText = db.prepare('UPDATE documents SET text = ? WHERE id = ?');
    for (const { id: docId, text } of allDocsText) {
      let newText = text;
      for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
        newText = newText.split(oldUrl).join(newUrl);
      }
      if (newText !== text) {
        updateText.run(newText, docId);
      }
    }

    // Also rewrite in comments
    console.log('  Rewriting URLs in comments...');
    const allComments = db.prepare('SELECT id, data_json FROM document_comments WHERE data_json IS NOT NULL').all();
    const updateCmt = db.prepare('UPDATE document_comments SET data_json = ? WHERE id = ?');
    for (const { id: cmtId, data_json } of allComments) {
      let newJson = data_json;
      for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
        newJson = newJson.split(oldUrl).join(newUrl);
      }
      if (newJson !== data_json) {
        updateCmt.run(newJson, cmtId);
      }
    }
  }
  console.log(`  Attachments: ${attCount} downloaded and URLs rewritten`);

  // 5. Sync content_items
  console.log('5. Syncing content_items...');
  const contentItemsUpsert = db.prepare(`
    INSERT INTO content_items (id, raw_id, type, title, icon, parent_id, collection_id, created_by, updated_by, created_at, updated_at, deleted_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, icon = excluded.icon,
      created_by = excluded.created_by, updated_by = excluded.updated_by,
      created_at = excluded.created_at, updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at, synced_at = excluded.synced_at
  `);
  const now = Date.now();
  const docs = db.prepare('SELECT * FROM documents').all();
  for (const d of docs) {
    const nodeId = `doc:${d.id}`;
    contentItemsUpsert.run(
      nodeId, d.id, 'doc', d.title || '', d.icon || null,
      null, null, d.created_by, d.updated_by,
      d.created_at, d.updated_at, d.deleted_at, now
    );
  }
  console.log(`  Content items synced: ${docs.length} docs`);

  // 6. Rebuild FTS index
  console.log('6. Rebuilding FTS index...');
  try {
    db.exec("INSERT INTO documents_fts(documents_fts) VALUES('rebuild')");
    console.log('  FTS index rebuilt');
  } catch (e) {
    console.warn(`  FTS rebuild: ${e.message} (run gateway first to create FTS table)`);
  }

  console.log('\n=== Migration complete ===');
  console.log(`  ${docCount} documents, ${revCount} revisions, ${cmtCount} comments, ${attCount} attachments`);
  db.close();
}

main().catch(e => { console.error('Migration failed:', e); process.exit(1); });
