/**
 * Fetch agent skills from the gateway and cache them to ~/.aose-mcp/skills/.
 *
 * Why this exists: onboarding relies on the agent voluntarily downloading its
 * own skills before acting. Agents don't always do that, and even when they
 * do, every MCP host invents its own path. Pulling skills from the MCP server
 * itself on startup gives every agent the same `~/.aose-mcp/skills/` location
 * and makes skills a hard prerequisite rather than a suggestion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_DIR } from './config.js';

const DEFAULT_TIMEOUT_MS = 4000;

export async function fetchAndCacheSkills(baseUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}/agent-skills`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`GET ${url} → timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  const body = await res.json();
  const skills = body?.skills || {};

  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  const written = [];
  for (const [filename, content] of Object.entries(skills)) {
    if (typeof content !== 'string') continue;
    if (!/^[a-zA-Z0-9_.-]+\.md$/.test(filename)) continue;
    const target = path.join(SKILLS_DIR, filename);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, target);
    written.push(filename);
  }
  return { dir: SKILLS_DIR, files: written };
}
