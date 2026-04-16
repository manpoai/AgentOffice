/**
 * Codex CLI platform plugin for AOSE Adapter.
 *
 * Delivers events by writing to the file-based inbox at
 * ~/.aose/inbox/<agent-name>.jsonl, then sends a keystroke to the
 * agent's tmux session so the Stop hook fires and consumes the event.
 *
 * Required config fields:
 *   agent_name  — the agent's registered AOSE name
 *   agent_dir   — the agent's working directory (cwd for the dedicated process)
 */

import { execFile } from 'node:child_process';
import { writeInbox } from '../lib/inbox-writer.js';

export function init(config) {
  if (!config.agent_name) throw new Error('[codex] config.agent_name is required');
  if (!config.agent_dir) throw new Error('[codex] config.agent_dir is required');
}

export async function deliver(config, content) {
  writeInbox(config.agent_name, content);
  console.log(`[codex] Wrote doorbell to inbox for ${config.agent_name}`);

  // Kick the tmux session so the Stop hook fires and consumes the inbox
  const session = `aose-${config.agent_name}`;
  execFile('tmux', ['send-keys', '-t', session, 'you have a new AOSE event', 'Enter'], (err) => {
    if (err) {
      console.error(`[codex] tmux kick failed for ${session}: ${err.message}`);
    } else {
      console.log(`[codex] Kicked tmux session ${session}`);
    }
  });
}
