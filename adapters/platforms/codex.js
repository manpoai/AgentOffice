/**
 * Codex CLI platform plugin for AOSE Adapter.
 *
 * Delivers events by writing to the file-based inbox at
 * ~/.aose/inbox/<agent-name>.jsonl. The agent's Stop hook
 * (decision:block) checks this file and keeps the Codex
 * session alive when a new event arrives.
 *
 * Required config fields:
 *   agent_name  — the agent's registered AOSE name
 *   agent_dir   — the agent's working directory (cwd for the dedicated process)
 */

import { writeInbox } from '../lib/inbox-writer.js';

export function init(config) {
  if (!config.agent_name) throw new Error('[codex] config.agent_name is required');
  if (!config.agent_dir) throw new Error('[codex] config.agent_dir is required');
}

export async function deliver(config, content) {
  writeInbox(config.agent_name, content);
  console.log(`[codex] Wrote doorbell to inbox for ${config.agent_name}`);
}
