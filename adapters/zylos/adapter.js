#!/usr/bin/env node
/**
 * ASuite Zylos Adapter
 *
 * A sidecar bridge process (runs alongside the Zylos agent, NOT inside it).
 * - Connects to ASuite Gateway SSE for real-time events
 * - When @mentioned in Mattermost → injects message into Zylos C4 queue
 * - When agent replies via "asuite" channel → send.js routes reply back to Gateway
 *
 * Architecture (from hxa-connect pattern):
 *   Gateway SSE ──→ [Adapter] ──→ c4-receive.js ──→ Agent
 *   Gateway API ←── send.js    ←── c4-send.js   ←── Agent
 *
 * The adapter installs itself as a "channel" in the agent's skills directory
 * (symlink), so c4-send.js can route replies back through send.js.
 * This is the standard Zylos extension mechanism (same as telegram, lark).
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EventSource from 'eventsource';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────
// Per-agent config: looks for config-<dirname>.json based on ZYLOS_DIR
const AGENT_ZYLOS_DIR = process.env.ZYLOS_DIR;
const agentDirName = AGENT_ZYLOS_DIR ? path.basename(AGENT_ZYLOS_DIR) : 'default';
const AGENT_CONFIG_PATH = path.join(__dirname, `config-${agentDirName}.json`);
const DEFAULT_CONFIG_PATH = path.join(__dirname, 'config.json');
let config = {};
try { config = JSON.parse(fs.readFileSync(AGENT_CONFIG_PATH, 'utf8')); }
catch { try { config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8')); } catch {} }

const GATEWAY_URL = config.gateway_url || process.env.ASUITE_GATEWAY_URL || 'http://localhost:4000';
const AGENT_TOKEN = config.agent_token || process.env.ASUITE_AGENT_TOKEN;
const AGENT_NAME = config.agent_name || agentDirName;

if (!AGENT_TOKEN) {
  console.error('[adapter] ASUITE_AGENT_TOKEN is required. Set in config.json or env var.');
  process.exit(1);
}

if (!AGENT_ZYLOS_DIR) {
  console.error('[adapter] ZYLOS_DIR is required. Set in config.json or env var.');
  process.exit(1);
}

// c4-receive.js lives in the shared zylos dir, not per-agent
const ZYLOS_HOME = config.zylos_home || process.env.ZYLOS_HOME || path.join(process.env.HOME, 'zylos');
const C4_RECEIVE = path.join(ZYLOS_HOME, '.claude/skills/comm-bridge/scripts/c4-receive.js');
const SKILLS_DIR = path.join(AGENT_ZYLOS_DIR, '.claude/skills');

// ─── Install channel symlink ─────────────────────
// Creates a symlink in the agent's skills directory so c4-send.js
// can find our send.js. This is the same pattern telegram/lark use.
function ensureChannelLink() {
  const linkPath = path.join(SKILLS_DIR, 'asuite');
  const targetPath = __dirname;

  try {
    const existing = fs.readlinkSync(linkPath);
    if (existing === targetPath) return; // already correct
    fs.unlinkSync(linkPath); // wrong target, fix it
  } catch {
    // doesn't exist, create it
  }

  try {
    fs.symlinkSync(targetPath, linkPath);
    console.log(`[adapter] Installed channel link: ${linkPath} → ${targetPath}`);
  } catch (e) {
    console.error(`[adapter] Failed to create channel link: ${e.message}`);
    console.error(`[adapter] Manually run: ln -sf ${targetPath} ${linkPath}`);
  }
}

// Put send.js in scripts/ subdirectory (c4-send.js expects <channel>/scripts/send.js)
function ensureScriptsDir() {
  const scriptsDir = path.join(__dirname, 'scripts');
  const sendSrc = path.join(__dirname, 'send.js');
  const sendDst = path.join(scriptsDir, 'send.js');

  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  // Symlink send.js into scripts/ if not already there
  if (!fs.existsSync(sendDst)) {
    fs.symlinkSync(sendSrc, sendDst);
  }
}

// ─── Inject message into C4 queue ────────────────
function injectToC4(endpoint, content) {
  return new Promise((resolve, reject) => {
    execFile('node', [
      C4_RECEIVE,
      '--channel', 'asuite',
      '--endpoint', endpoint,
      '--content', content,
    ], {
      env: { ...process.env, ZYLOS_DIR: AGENT_ZYLOS_DIR },
      timeout: 10000,
    }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[adapter] c4-receive error: ${stderr || err.message}`);
        reject(err);
      } else {
        console.log(`[adapter] Injected to C4: ${stdout.trim()}`);
        resolve(stdout);
      }
    });
  });
}

// ─── SSE Event Listener ─────────────────────────
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

function connectSSE() {
  const url = `${GATEWAY_URL}/api/me/events/stream?token=${AGENT_TOKEN}`;
  console.log(`[adapter] Connecting to Gateway SSE`);

  const es = new EventSource(url);

  es.onopen = () => {
    console.log('[adapter] SSE connected');
    reconnectDelay = 1000; // reset on successful connect
  };

  es.onmessage = async (evt) => {
    try {
      const event = JSON.parse(evt.data);
      console.log(`[adapter] Event: ${event.event} from ${event.source}`);
      await handleEvent(event);
    } catch (e) {
      console.error(`[adapter] Event handling error: ${e.message}`);
    }
  };

  es.onerror = (err) => {
    console.error(`[adapter] SSE error, reconnecting in ${reconnectDelay}ms...`);
    es.close();
    setTimeout(connectSSE, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  };
}

// ─── Catchup: fetch missed events on startup ────
async function catchup() {
  const stateFile = path.join(__dirname, '.last-event-ts');
  let since = 0;
  try { since = parseInt(fs.readFileSync(stateFile, 'utf8').trim()); } catch {}

  if (since === 0) {
    console.log('[adapter] No previous state, skipping catchup');
    return;
  }

  console.log(`[adapter] Catching up events since ${new Date(since).toISOString()}`);
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ since: String(since), limit: '50' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${GATEWAY_URL}/api/me/catchup?${params}`, {
      headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    for (const event of data.events) {
      await handleEvent(event);
    }

    hasMore = data.has_more;
    cursor = data.cursor;
  }
  console.log('[adapter] Catchup complete');
}

function saveLastEventTs(ts) {
  const stateFile = path.join(__dirname, '.last-event-ts');
  fs.writeFileSync(stateFile, String(ts));
}

// ─── Event Handler ───────────────────────────────
async function handleEvent(event) {
  saveLastEventTs(event.timestamp);

  switch (event.event) {
    case 'message.mentioned': {
      const d = event.data;
      let endpoint = `${d.channel_id}|msg:${d.message_id}`;
      if (d.thread_id) endpoint += `|thread:${d.thread_id}`;

      const content = `[MM] ${d.sender.name} said: <current-message>\n${d.text_without_mention}\n</current-message>`;

      console.log(`[adapter] @mentioned by ${d.sender.name}: ${d.text_without_mention.substring(0, 80)}`);
      await injectToC4(endpoint, content);
      break;
    }

    case 'message.direct': {
      const d = event.data;
      const endpoint = `${d.channel_id}|msg:${d.message_id}`;
      const content = `[MM DM] ${d.sender.name} said: <current-message>\n${d.text}\n</current-message>`;

      console.log(`[adapter] DM from ${d.sender.name}: ${d.text.substring(0, 80)}`);
      await injectToC4(endpoint, content);
      break;
    }

    case 'task.assigned': {
      const d = event.data;
      const today = new Date().toISOString().slice(0, 10);
      const shouldStartNow = !d.start_date || d.start_date <= today;
      let content = `[Plane] Task assigned by ${d.assigned_by.name}: "${d.task_title}"\nPriority: ${d.priority}\nURL: ${d.task_url}\n\n${d.task_description || ''}`;
      if (d.delegation_context) {
        content += `\n\n--- Context from ${d.delegation_context.from} ---\n${d.delegation_context.text}`;
        content += `\n\nWhen done, comment on the task and @${d.delegation_context.from} with your result so they are notified.`;
      }
      if (shouldStartNow) {
        content += `\n\nTask lifecycle (execute in order):`;
        content += `\n1. Mark in_progress now:\ncurl -s -X PATCH ${GATEWAY_URL}/api/tasks/${d.task_id}/status -H "Authorization: Bearer ${AGENT_TOKEN}" -H "Content-Type: application/json" -d '{"status":"in_progress"}'`;
        content += `\n2. Do the work.`;
        content += `\n3. Mark done when complete:\ncurl -s -X PATCH ${GATEWAY_URL}/api/tasks/${d.task_id}/status -H "Authorization: Bearer ${AGENT_TOKEN}" -H "Content-Type: application/json" -d '{"status":"done"}'`;
      } else {
        content += `\n\nThis task has start_date ${d.start_date} — do not start yet. Mark in_progress only when the start date arrives, then mark done when complete.`;
      }
      await injectToC4(`task:${d.task_id}`, content);
      break;
    }

    case 'task.commented': {
      const d = event.data;
      let content = `[Plane] ${d.sender.name} commented on "${d.task_title}":\n${d.text}`;
      content += `\n\nIf this comment fully resolves the task, mark it done:\ncurl -s -X PATCH ${GATEWAY_URL}/api/tasks/${d.task_id}/status -H "Authorization: Bearer ${AGENT_TOKEN}" -H "Content-Type: application/json" -d '{"status":"done"}'`;
      await injectToC4(`task:${d.task_id}|comment:${d.comment_id}`, content);
      break;
    }

    case 'comment.mentioned': {
      const d = event.data;
      let content = `[Outline] ${d.sender.name} mentioned you in a comment on "${d.doc_title}":\n${d.text_without_mention}`;
      if (d.doc_content) content += `\n\nCurrent document content:\n${d.doc_content}`;
      content += `\n\nAvailable actions (use ASuite Gateway API):`;
      content += `\n- Update document body: PATCH /api/docs/${d.doc_id} with {content_markdown: "..."}`;
      content += `\n- Reply to this comment: reply via the endpoint below`;
      content += `\n\nIf the request asks you to add/edit content in the document, update the document body. If it asks you to answer a question, reply to the comment.`;
      await injectToC4(`doc:${d.doc_id}|comment:${d.comment_id}`, content);
      break;
    }

    case 'doc.mentioned': {
      const d = event.data;
      let content = `[Outline] ${d.sender.name} mentioned you in the body of document "${d.doc_title}":\n${d.text_without_mention}`;
      content += `\n\nAvailable actions (use ASuite Gateway API):`;
      content += `\n- Update document body: PATCH /api/docs/${d.doc_id} with {content_markdown: "..."}`;
      content += `\n- Reply via comment: POST /api/comments with {doc_id: "${d.doc_id}", text: "..."}`;
      await injectToC4(`doc:${d.doc_id}`, content);
      break;
    }

    default:
      console.log(`[adapter] Unhandled event type: ${event.event}`);
  }
}

// ─── Main ────────────────────────────────────────
async function main() {
  console.log(`[adapter] ASuite Zylos Adapter starting`);
  console.log(`[adapter] Agent: ${AGENT_NAME}`);
  console.log(`[adapter] Gateway: ${GATEWAY_URL}`);
  console.log(`[adapter] ZYLOS_DIR: ${AGENT_ZYLOS_DIR}`);

  ensureScriptsDir();
  ensureChannelLink();

  await catchup();
  connectSSE();
}

main().catch(e => { console.error(e); process.exit(1); });
