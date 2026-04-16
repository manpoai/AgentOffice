/**
 * Gemini CLI platform plugin for AOSE Adapter.
 *
 * Delivers events by writing to the file-based inbox at
 * ~/.aose/inbox/<agent-name>.jsonl, then spawns a headless
 * `gemini -p` call that resumes the agent's session. The AfterAgent
 * hook checks the inbox and injects the event via exit-code 2 + stderr.
 *
 * Required config fields:
 *   agent_name  — the agent's registered AOSE name
 *   agent_dir   — the agent's working directory
 */

import { spawn } from 'node:child_process';
import { writeInbox } from '../lib/inbox-writer.js';

export function init(config) {
  if (!config.agent_name) throw new Error('[gemini-cli] config.agent_name is required');
  if (!config.agent_dir) throw new Error('[gemini-cli] config.agent_dir is required');
}

export async function deliver(config, content) {
  writeInbox(config.agent_name, content);
  console.log(`[gemini-cli] Wrote doorbell to inbox for ${config.agent_name}`);

  // Spawn a headless gemini call that resumes the session.
  // The AfterAgent hook will pick up the inbox event and process it.
  const child = spawn('gemini', [
    '-p', 'You have a new AOSE event. Check your inbox by calling get_unread_events.',
    '--resume', 'latest',
    '--yolo',
  ], {
    cwd: config.agent_dir,
    stdio: 'ignore',
    detached: true,
  });

  child.on('error', (err) => {
    console.error(`[gemini-cli] gemini kick failed for ${config.agent_name}: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`[gemini-cli] gemini session completed for ${config.agent_name}`);
    } else {
      console.error(`[gemini-cli] gemini exited with code ${code} for ${config.agent_name}`);
    }
  });

  // Don't hold the adapter process — let gemini run independently
  child.unref();
}
