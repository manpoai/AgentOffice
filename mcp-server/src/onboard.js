/**
 * `aose-mcp onboard` — one-shot agent registration + MCP host wiring.
 *
 * Flow:
 *   1. POST <base_url>/agents/self-register with {name, display_name}
 *   2. Parse response → agent_token, display name, mcp_server.env block
 *   3. Write base_url to ~/.aose-mcp/config.json (so the stdio server can find it)
 *   4. Detect MCP host and install the aose server config:
 *        • OpenClaw: call `openclaw mcp set aose <json>` (writes ~/.openclaw/openclaw.json,
 *          triggers gateway [reload] → per-session runtime rebuild on next message)
 *        • Unknown host: print the JSON block for the human to paste
 *   5. Print next-steps: skills live in ~/.aose-mcp/skills/ after first run;
 *      verify with the `whoami` MCP tool (not curl)
 *
 * Design constraints (from the IRON RULE in Thinker memory):
 *   - Zero forms. The only input is `base_url` (and optional --name/--display-name).
 *   - The user never sees a token, never edits JSON, never restarts a process.
 *   - If the host can be driven programmatically, drive it. If not, fail loudly
 *     with a paste-ready config block, never silently half-install.
 */
import { spawnSync } from 'node:child_process';
import { writeConfig, CONFIG_PATH } from './config.js';

function mask(t) {
  if (!t || typeof t !== 'string') return '(none)';
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

function parseArgs(argv) {
  // argv here is process.argv.slice(3): the tokens AFTER `aose-mcp onboard`
  const out = { base_url: null, name: null, display_name: null, host: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') out.name = argv[++i];
    else if (a === '--display-name') out.display_name = argv[++i];
    else if (a === '--host') out.host = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) {
      console.error(`Error: unknown flag ${a}`);
      process.exit(1);
    } else {
      rest.push(a);
    }
  }
  if (rest.length > 0) out.base_url = rest[0];
  return out;
}

function printOnboardHelp() {
  console.log(`aose-mcp onboard — one-shot agent registration + MCP host wiring

Usage:
  aose-mcp onboard <base_url> [--name NAME] [--display-name "Display Name"] [--host HOST]

Arguments:
  <base_url>               aose gateway URL (e.g. http://localhost:4000/api/gateway)

Options:
  --name NAME              agent username (lowercase, 2-31 chars, matches ^[a-z][a-z0-9-]{1,30}$)
                           if omitted, a name is generated from the host hostname
  --display-name TEXT      agent display name (default: derived from --name)
  --host HOST              MCP host to configure. Supported: openclaw, auto (default).
                           auto-detect looks for the 'openclaw' binary on PATH.
  --help, -h               show this help

What this does:
  1. POSTs to <base_url>/agents/self-register to get a fresh agent token.
  2. Writes <base_url> to ${CONFIG_PATH} so the stdio server can find it.
  3. If OpenClaw is detected, runs 'openclaw mcp set aose <json>' to register
     the aose MCP server in ~/.openclaw/openclaw.json. OpenClaw's [reload]
     mechanism picks up the change automatically — no restart needed.
  4. Prints the 'whoami' verification step.

If your MCP host is not OpenClaw, run with --host manual (or let auto-detect
fall back) to get a paste-ready JSON block instead.
`);
}

function detectHost(explicit) {
  if (explicit && explicit !== 'auto') return explicit;
  // auto: prefer openclaw if the binary is on PATH
  const probe = spawnSync('openclaw', ['--version'], { stdio: 'ignore' });
  if (probe.status === 0) return 'openclaw';
  return 'manual';
}

function generateDefaultName() {
  const host = (process.env.HOSTNAME || process.env.HOST || 'agent').toLowerCase();
  const safe = host.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'agent';
  const suffix = Math.random().toString(36).slice(2, 6);
  // ensure starts with letter
  const prefix = /^[a-z]/.test(safe) ? safe : `agent-${safe}`;
  return `${prefix}-${suffix}`.slice(0, 31);
}

async function selfRegister(baseUrl, name, displayName) {
  const url = `${baseUrl.replace(/\/$/, '')}/agents/self-register`;
  const body = JSON.stringify({ name, display_name: displayName });
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    throw new Error(`POST ${url} → network error: ${err.message}`);
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    const code = json?.error || `HTTP_${res.status}`;
    const msg = json?.message || text.slice(0, 200);
    throw new Error(`self-register failed (${code}): ${msg}`);
  }
  if (!json?.token || !json?.mcp_server?.env) {
    throw new Error(`self-register response missing token or mcp_server.env: ${text.slice(0, 200)}`);
  }
  return json;
}

function buildServerConfig(env) {
  return {
    command: 'npx',
    args: ['-y', 'aose-mcp'],
    env: {
      AOSE_TOKEN: env.AOSE_TOKEN,
      AOSE_URL: env.AOSE_URL,
    },
  };
}

function installOpenClaw(serverConfig) {
  const json = JSON.stringify(serverConfig);
  const result = spawnSync('openclaw', ['mcp', 'set', 'aose', json], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim() || `exit ${result.status}`;
    throw new Error(`'openclaw mcp set aose' failed: ${err}`);
  }
  return (result.stdout || '').trim();
}

function printManualInstructions(serverConfig) {
  console.log('');
  console.log('No supported MCP host was auto-detected. Add this to your MCP host config manually:');
  console.log('');
  console.log(JSON.stringify({ mcpServers: { aose: serverConfig } }, null, 2));
  console.log('');
  console.log('Then restart your MCP host so it re-reads the config.');
}

export async function handleOnboard(rawArgv) {
  const args = parseArgs(rawArgv);
  if (args.help) {
    printOnboardHelp();
    return;
  }
  if (!args.base_url) {
    console.error('Error: onboard requires <base_url> as the first argument.');
    console.error('Run `aose-mcp onboard --help` for usage.');
    process.exit(1);
  }
  if (!/^https?:\/\//.test(args.base_url)) {
    console.error('Error: base_url must start with http:// or https://');
    process.exit(1);
  }
  const baseUrl = args.base_url.replace(/\/$/, '');
  const name = args.name || generateDefaultName();
  const displayName = args.display_name || name;
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(name)) {
    console.error(`Error: --name must match ^[a-z][a-z0-9-]{1,30}$ (got: ${name})`);
    process.exit(1);
  }

  console.log(`[onboard] base_url:     ${baseUrl}`);
  console.log(`[onboard] name:         ${name}`);
  console.log(`[onboard] display_name: ${displayName}`);

  // Step 1: register
  console.log(`[onboard] step 1/3: POST ${baseUrl}/agents/self-register`);
  let reg;
  try {
    reg = await selfRegister(baseUrl, name, displayName);
  } catch (err) {
    console.error(`[onboard] FAILED at self-register: ${err.message}`);
    process.exit(1);
  }
  console.log(`[onboard]   ok: agent_id=${reg.agent_id} token=${mask(reg.token)}`);

  // Step 2: write base_url to local config (stdio server reads this on startup)
  console.log(`[onboard] step 2/3: write base_url → ${CONFIG_PATH}`);
  try {
    writeConfig({ base_url: baseUrl });
  } catch (err) {
    console.error(`[onboard] FAILED writing ${CONFIG_PATH}: ${err.message}`);
    process.exit(1);
  }
  console.log(`[onboard]   ok`);

  // Step 3: install into MCP host
  const host = detectHost(args.host);
  const serverConfig = buildServerConfig(reg.mcp_server.env);
  console.log(`[onboard] step 3/3: install aose into MCP host (host=${host})`);

  if (host === 'openclaw') {
    try {
      const out = installOpenClaw(serverConfig);
      if (out) console.log(`[onboard]   openclaw: ${out}`);
      console.log(`[onboard]   ok: 'openclaw mcp set aose' wrote ~/.openclaw/openclaw.json`);
      console.log(`[onboard]   OpenClaw [reload] will pick up the change on its next config scan.`);
    } catch (err) {
      console.error(`[onboard] FAILED installing into OpenClaw: ${err.message}`);
      console.error(`[onboard] Falling back to manual instructions so you don't lose progress:`);
      printManualInstructions(serverConfig);
      process.exit(1);
    }
  } else {
    printManualInstructions(serverConfig);
  }

  console.log('');
  console.log('[onboard] DONE. Next steps:');
  console.log('  1. In your MCP host, call the `whoami` MCP tool (not curl) to verify the full chain.');
  console.log('  2. Wait for human approval of your registration (you will get an agent.approved event).');
  console.log('  3. Read ~/.aose-mcp/skills/00-role-and-principles.md before calling any mutating tool.');
  console.log('');
  console.log('If whoami fails, check the host stderr for `[aose-mcp] FATAL step=X error=Y` — the step');
  console.log('field tells you which phase failed (load_config / build_server / stdio_connect /');
  console.log('skills_fetch / event_bridge) so you know where to look.');
}
