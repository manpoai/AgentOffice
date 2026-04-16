/**
 * Local config file for aose-mcp.
 *
 * Single source of truth for the gateway URL: ~/.aose-mcp/config.json
 * Schema: { base_url: string }
 *
 * IMPORTANT: the token is NOT stored here. The token is set once when the
 * agent registers (via /api/agents/self-register) and lives in the MCP host's
 * mcpServers env block as AOSE_TOKEN. It is read directly from
 * process.env.AOSE_TOKEN every time the MCP server starts. Tokens persist
 * across URL changes; only the URL is mutable from the CLI.
 *
 * URL loading order on startup:
 *   1. config file (if present)
 *   2. AOSE_URL env var (if file absent — migrated to file on first run)
 *   3. error
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_DIR = path.join(os.homedir(), '.aose-mcp');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');

export function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeConfig(patch) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const current = readConfig() || {};
  const next = { ...current, ...patch };
  // Defensive: never persist a token even if a caller passes one.
  delete next.token;
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, CONFIG_PATH);
  return next;
}

export function loadEffectiveConfig() {
  const fileCfg = readConfig();
  let baseUrl = null;
  let urlSource = null;

  // Env AOSE_URL takes priority — each agent sets it in its own .mcp.json env
  // block, so project-level isolation works even when config.json has a
  // different URL from another agent on the same host.
  if (process.env.AOSE_URL) {
    baseUrl = process.env.AOSE_URL;
    urlSource = 'env';
  } else if (fileCfg?.base_url) {
    baseUrl = fileCfg.base_url;
    urlSource = 'file';
  }

  const token = process.env.AOSE_TOKEN || null;

  if (!baseUrl || !token) {
    const missing = [];
    if (!baseUrl) missing.push('AOSE_URL (or run `aose-mcp set-url <url>`)');
    if (!token) missing.push('AOSE_TOKEN env var (set in your MCP host\'s mcpServers env block)');
    const err = new Error(
      'aose MCP is not configured. Missing:\n' +
      missing.map((m) => `  • ${m}`).join('\n') + '\n' +
      `Config file location: ${CONFIG_PATH}`
    );
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  return { base_url: baseUrl, token, source: urlSource || 'env' };
}
