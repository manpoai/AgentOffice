#!/usr/bin/env node
/**
 * ASuite Docker Init Container
 *
 * Runs once on first `docker compose up` to:
 * 1. Wait for backend services (MM, NocoDB) to be healthy
 * 2. Create admin users in MM and NocoDB
 * 3. Create NocoDB default base + agent_notes table
 * 4. Write /data/init-done marker to skip on subsequent runs
 *
 * Designed to run inside Docker network (uses container hostnames).
 * Gateway reads this init output to auto-configure itself.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@asuite.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Asuite2026!';

// Docker network hostnames
const MM_URL = process.env.MM_URL || 'http://mattermost:8065';
const NC_URL = process.env.NC_URL || 'http://nocodb:8080';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:4000';

const MARKER_PATH = '/data/init-done';

import fs from 'fs';

function log(msg) { console.log(`[init] ${msg}`); }
function warn(msg) { console.warn(`[init] ⚠ ${msg}`); }

async function waitFor(name, url, maxWait = 180000) {
  const start = Date.now();
  log(`Waiting for ${name} at ${url}...`);
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok || res.status < 500) {
        log(`${name} is ready (${Date.now() - start}ms)`);
        return true;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  warn(`${name} not ready after ${maxWait}ms`);
  return false;
}

async function api(baseUrl, method, apiPath, body, headers = {}) {
  const url = `${baseUrl}${apiPath}`;
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function main() {
  // Check if already initialized
  if (fs.existsSync(MARKER_PATH)) {
    log('Already initialized (marker exists). Skipping.');
    process.exit(0);
  }

  log('=== ASuite Docker Init ===');

  // Wait for services
  const services = [
    ['Mattermost', `${MM_URL}/api/v4/system/ping`],
    ['NocoDB', `${NC_URL}/api/v1/health`],
  ];

  for (const [name, url] of services) {
    if (!await waitFor(name, url)) {
      warn(`${name} not ready. Init will retry on next container restart.`);
      process.exit(1);
    }
  }

  // ── Mattermost Setup ──
  log('--- Mattermost Setup ---');
  const mmLogin = await api(MM_URL, 'POST', '/api/v4/users/login',
    { login_id: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  if (mmLogin.status === 200 && mmLogin.data?.id) {
    log('MM admin already exists');
  } else {
    log('Creating MM admin user...');
    const createRes = await api(MM_URL, 'POST', '/api/v4/users', {
      email: ADMIN_EMAIL, username: 'admin', password: ADMIN_PASSWORD,
    });
    if (createRes.data?.id) {
      log(`MM admin created: ${createRes.data.id}`);

      // Create default team
      const loginRes = await api(MM_URL, 'POST', '/api/v4/users/login',
        { login_id: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      if (loginRes.status === 200) {
        // Session token is in Set-Cookie, but we can use the Token header
        // MM returns token in response header, let's use a different approach
        log('MM admin created. Team setup will be done by Gateway on first start.');
      }
    } else {
      warn(`MM admin creation: ${JSON.stringify(createRes.data)}`);
    }
  }

  // ── NocoDB Setup ──
  log('--- NocoDB Setup ---');
  let ncToken = null;

  // Try signup first (first user = super admin)
  const ncSignup = await api(NC_URL, 'POST', '/api/v1/auth/user/signup',
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, firstname: 'Admin', lastname: '' });
  if (ncSignup.data?.token) {
    ncToken = ncSignup.data.token;
    log('NocoDB admin created');
  } else {
    const ncSignin = await api(NC_URL, 'POST', '/api/v1/auth/user/signin',
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (ncSignin.data?.token) {
      ncToken = ncSignin.data.token;
      log('NocoDB admin exists, signed in');
    } else {
      warn(`NocoDB auth failed: ${JSON.stringify(ncSignin.data)}`);
    }
  }

  if (ncToken) {
    // Ensure default base
    const basesRes = await api(NC_URL, 'GET', '/api/v1/db/meta/projects/', null,
      { 'xc-auth': ncToken });
    const bases = basesRes.data?.list || [];
    let baseId = bases.length > 0 ? bases[0].id : null;

    if (!baseId) {
      log('Creating NocoDB default base...');
      const createBase = await api(NC_URL, 'POST', '/api/v1/db/meta/projects/',
        { title: 'ASuite' }, { 'xc-auth': ncToken });
      baseId = createBase.data?.id;
    }

    if (baseId) {
      log(`NocoDB base: ${baseId}`);

      // Create agent_notes table if missing
      const tablesRes = await api(NC_URL, 'GET',
        `/api/v1/db/meta/projects/${baseId}/tables`, null, { 'xc-auth': ncToken });
      const tables = tablesRes.data?.list || [];

      if (!tables.some(t => t.title === 'agent_notes')) {
        log('Creating agent_notes table...');
        await api(NC_URL, 'POST', `/api/v1/db/meta/projects/${baseId}/tables`, {
          table_name: 'agent_notes', title: 'agent_notes',
          columns: [
            { column_name: 'Id', title: 'Id', uidt: 'ID', pk: true, ai: true },
            { column_name: 'Title', title: 'Title', uidt: 'SingleLineText' },
            { column_name: 'Content', title: 'Content', uidt: 'LongText' },
            { column_name: 'Agent', title: 'Agent', uidt: 'SingleLineText' },
            { column_name: 'created_by', title: 'created_by', uidt: 'SingleLineText' },
          ],
        }, { 'xc-auth': ncToken });
        log('agent_notes table created');
      }

      // Write init results for Gateway to read
      const initResult = {
        nocodb_base_id: baseId,
        admin_email: ADMIN_EMAIL,
        initialized_at: new Date().toISOString(),
      };
      fs.writeFileSync('/data/init-result.json', JSON.stringify(initResult, null, 2));
      log('Init result written to /data/init-result.json');
    }
  }

  // Wait for Gateway to be ready, then notify
  log('--- Waiting for Gateway ---');
  if (await waitFor('Gateway', `${GATEWAY_URL}/health`, 120000)) {
    log('Gateway is ready. Init complete.');
  } else {
    log('Gateway not yet ready, but init tasks are done. Gateway will self-configure on start.');
  }

  // Mark init as done
  fs.writeFileSync(MARKER_PATH, new Date().toISOString());
  log('=== Init Complete ===');
}

main().catch(e => {
  console.error(`[init] Fatal: ${e.message}`);
  process.exit(1);
});
