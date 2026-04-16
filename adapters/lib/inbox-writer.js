/**
 * Minimal inbox writer for local CLI agent platforms (Claude Code, Codex).
 *
 * Appends a JSONL line to ~/.aose/inbox/<agent-name>.jsonl.
 * The agent's Stop hook reads and consumes lines from this file.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const INBOX_DIR = path.join(os.homedir(), '.aose', 'inbox');

export function writeInbox(agentName, content) {
  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const inboxPath = path.join(INBOX_DIR, `${agentName}.jsonl`);
  const line = JSON.stringify({ ts: Date.now(), content }) + '\n';
  fs.appendFileSync(inboxPath, line);
}
