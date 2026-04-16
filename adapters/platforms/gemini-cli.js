/**
 * Gemini CLI platform plugin for AOSE Adapter.
 *
 * Delivers events by writing to the file-based inbox at
 * ~/.aose/inbox/<agent-name>.jsonl. Unlike Claude Code / Codex
 * (which rely on a persistent tmux session + Stop hook), Gemini CLI
 * events are consumed by an AfterAgent hook that checks this file
 * after each turn. The hook uses exit-code 2 + stderr to inject
 * the event as a retry prompt.
 *
 * Required config fields:
 *   agent_name  — the agent's registered AOSE name
 *   agent_dir   — the agent's working directory
 */

import { writeInbox } from '../lib/inbox-writer.js';

export function init(config) {
  if (!config.agent_name) throw new Error('[gemini-cli] config.agent_name is required');
  if (!config.agent_dir) throw new Error('[gemini-cli] config.agent_dir is required');
}

export async function deliver(config, content) {
  writeInbox(config.agent_name, content);
  console.log(`[gemini-cli] Wrote doorbell to inbox for ${config.agent_name}`);
}
