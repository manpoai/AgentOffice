/**
 * Zylos platform plugin for AOSE Adapter.
 *
 * Delivers events to a Zylos agent by invoking the c4-receive.js CLI, which
 * writes the message into the agent's C4 comm-bridge inbox.
 *
 * Required config fields:
 *   zylos_dir       — the agent's ZYLOS_DIR (working dir)
 *   c4_receive_path — absolute path to c4-receive.js
 */

import { execFile } from 'child_process';

export function init(config) {
  if (!config.zylos_dir) throw new Error('[zylos] config.zylos_dir is required');
  if (!config.c4_receive_path) throw new Error('[zylos] config.c4_receive_path is required');
}

export function deliver(config, endpoint, content) {
  return new Promise((resolve, reject) => {
    execFile('node', [
      config.c4_receive_path,
      '--channel', 'aose',
      '--endpoint', endpoint,
      '--content', content,
    ], {
      env: { ...process.env, ZYLOS_DIR: config.zylos_dir },
      timeout: 10000,
    }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[zylos] c4-receive error: ${stderr || err.message}`);
        reject(err);
      } else {
        console.log(`[zylos] Injected to C4: ${stdout.trim()}`);
        resolve(stdout);
      }
    });
  });
}
