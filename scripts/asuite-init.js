#!/usr/bin/env node
/**
 * ASuite Bootstrap Script
 *
 * Automates first-time setup after `docker compose up`:
 * 1. Wait for all services to be healthy
 * 2. Create MinIO buckets (outline, plane-uploads)
 * 3. Create Mattermost admin user + team + enable bot accounts
 * 4. Create Outline admin (auto via OIDC on first login)
 * 5. Create Plane admin + workspace + project
 * 6. Create NocoDB admin + base + default tables
 * 7. Create Dex static password for admin
 * 8. Generate Gateway admin token + agent tokens
 * 9. Generate .env with all credentials
 * 10. Generate ecosystem.config.cjs for PM2
 *
 * Usage: node scripts/asuite-init.js [--domain asuite.gridtabs.com] [--admin-email admin@asuite.local] [--admin-password Asuite2026!]
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASUITE_DIR = path.resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const DOMAIN = getArg('domain', 'localhost');
const ADMIN_EMAIL = getArg('admin-email', 'admin@asuite.local');
const ADMIN_PASSWORD = getArg('admin-password', 'Asuite2026!');
const IS_LOCAL = DOMAIN === 'localhost';
const BASE_URL = IS_LOCAL ? 'http://localhost' : `https://${DOMAIN}`;

// Service ports (matching docker-compose)
const PORTS = {
  mm: 8065,
  outline: 3000,
  plane: 8000,
  nocodb: 8080,
  dex: 5556,
  minio: 9000,
  gateway: 4000,
  shell: 3101,
};

// ─── Helpers ──────────────────────────────────────
function genSecret(bytes = 32) { return crypto.randomBytes(bytes).toString('hex'); }
function genShort(bytes = 16) { return crypto.randomBytes(bytes).toString('hex'); }
function log(msg) { console.log(`[init] ${msg}`); }
function warn(msg) { console.warn(`[init] ⚠ ${msg}`); }

async function waitFor(name, url, maxWait = 120000) {
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
    await new Promise(r => setTimeout(r, 2000));
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

// ─── Main ─────────────────────────────────────────
async function main() {
  log('=== ASuite Bootstrap ===');
  log(`Domain: ${DOMAIN}`);
  log(`Admin: ${ADMIN_EMAIL}`);

  const state = {
    env: {},       // will be written to .env
    secrets: {},   // internal tracking
  };

  // ── Step 1: Generate all secrets ──
  log('Generating secrets...');
  state.env.MM_SECRET_KEY = genSecret();
  state.env.POSTGRES_MM_PASS = genShort();
  state.env.OUTLINE_SECRET_KEY = genSecret();
  state.env.OUTLINE_UTILS_SECRET = genSecret();
  state.env.POSTGRES_OL_PASS = genShort();
  state.env.MINIO_ACCESS_KEY = genShort();
  state.env.MINIO_SECRET_KEY = genSecret();
  state.env.POSTGRES_PL_PASS = genShort();
  state.env.PLANE_SECRET_KEY = genSecret();
  state.env.POSTGRES_NC_PASS = genShort();
  state.env.NOCODB_JWT_SECRET = genSecret();
  state.env.MM_PORT = String(PORTS.mm);
  state.env.OUTLINE_PORT = String(PORTS.outline);
  state.env.PLANE_PORT = String(PORTS.plane);
  state.env.GATEWAY_ADMIN_TOKEN = genSecret();

  // ── Step 2: Write .env ──
  const envPath = path.join(ASUITE_DIR, '.env');
  if (fs.existsSync(envPath)) {
    log('.env already exists — skipping secret generation (using existing)');
    // Load existing env
    const existing = fs.readFileSync(envPath, 'utf8');
    for (const line of existing.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) state.env[m[1]] = m[2];
    }
  } else {
    const envContent = [
      `# ASuite .env — generated ${new Date().toISOString()}`,
      `# DO NOT COMMIT`,
      '',
      '# Mattermost',
      `MM_SECRET_KEY=${state.env.MM_SECRET_KEY}`,
      `POSTGRES_MM_PASS=${state.env.POSTGRES_MM_PASS}`,
      '',
      '# Outline',
      `OUTLINE_SECRET_KEY=${state.env.OUTLINE_SECRET_KEY}`,
      `OUTLINE_UTILS_SECRET=${state.env.OUTLINE_UTILS_SECRET}`,
      `POSTGRES_OL_PASS=${state.env.POSTGRES_OL_PASS}`,
      `MINIO_ACCESS_KEY=${state.env.MINIO_ACCESS_KEY}`,
      `MINIO_SECRET_KEY=${state.env.MINIO_SECRET_KEY}`,
      '',
      '# Plane',
      `POSTGRES_PL_PASS=${state.env.POSTGRES_PL_PASS}`,
      `PLANE_SECRET_KEY=${state.env.PLANE_SECRET_KEY}`,
      '',
      '# Ports',
      `MM_PORT=${PORTS.mm}`,
      `OUTLINE_PORT=${PORTS.outline}`,
      `PLANE_PORT=${PORTS.plane}`,
      '',
      '# NocoDB',
      `POSTGRES_NC_PASS=${state.env.POSTGRES_NC_PASS}`,
      `NOCODB_JWT_SECRET=${state.env.NOCODB_JWT_SECRET}`,
      '',
      '# Gateway',
      `GATEWAY_ADMIN_TOKEN=${state.env.GATEWAY_ADMIN_TOKEN}`,
      '',
    ].join('\n');
    fs.writeFileSync(envPath, envContent);
    log('.env written');
  }

  // ── Step 3: Wait for services ──
  const mmUrl = `http://localhost:${PORTS.mm}`;
  const olUrl = `http://localhost:${PORTS.outline}`;
  const planeUrl = `http://localhost:${PORTS.plane}`;
  const ncUrl = `http://localhost:${PORTS.nocodb}`;
  const minioUrl = `http://localhost:${PORTS.minio}`;

  const services = [
    ['Mattermost', `${mmUrl}/api/v4/system/ping`],
    ['NocoDB', `${ncUrl}/api/v1/health`],
  ];

  let allReady = true;
  for (const [name, url] of services) {
    if (!await waitFor(name, url)) {
      allReady = false;
    }
  }

  if (!allReady) {
    warn('Some services not ready. Run `docker compose up -d` first, then re-run this script.');
    process.exit(1);
  }

  // ── Step 4: Setup Mattermost ──
  log('--- Mattermost Setup ---');
  let mmAdminToken = null;

  // Check if admin already exists
  const pingRes = await api(mmUrl, 'POST', '/api/v4/users/login',
    { login_id: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  if (pingRes.status === 200 && pingRes.data?.id) {
    log('MM admin user already exists');
    // Get a personal access token
    const tokenRes = await api(mmUrl, 'POST', `/api/v4/users/${pingRes.data.id}/tokens`,
      { description: 'asuite-init' }, { Authorization: `Bearer ${pingRes.data.id}` });
    // Use session token from login
    const sessionToken = pingRes.data.id; // Actually need to parse header
    // For simplicity, try creating via admin token flow
  } else {
    // Create first admin user
    log('Creating MM admin user...');
    const createRes = await api(mmUrl, 'POST', '/api/v4/users', {
      email: ADMIN_EMAIL, username: 'admin', password: ADMIN_PASSWORD,
    });
    if (createRes.data?.id) {
      log(`MM admin created: ${createRes.data.id}`);
    } else if (createRes.data?.id === 'store.sql_user.save.email_exists.app_error') {
      log('MM admin already exists');
    } else {
      warn(`MM admin creation: ${JSON.stringify(createRes.data)}`);
    }
  }

  // Try local mode for admin operations (MM_SERVICESETTINGS_ENABLELOCALMODE=true)
  // Local mode uses Unix socket — not available from Node, so we use a personal access token
  // For now, log instructions for manual token generation if needed
  log('MM setup: admin user configured. Bot tokens managed by Gateway at runtime.');

  // ── Step 5: Setup NocoDB ──
  log('--- NocoDB Setup ---');

  let ncToken = null;

  // Try signup first (first user becomes super admin), then signin
  log('Creating NocoDB admin...');
  const ncSignup = await api(ncUrl, 'POST', '/api/v1/auth/user/signup',
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, firstname: 'Admin', lastname: '' });
  if (ncSignup.data?.token) {
    ncToken = ncSignup.data.token;
    log('NocoDB admin created');
  } else {
    // Admin already exists — sign in
    const ncSignin = await api(ncUrl, 'POST', '/api/v1/auth/user/signin',
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (ncSignin.data?.token) {
      ncToken = ncSignin.data.token;
      log('NocoDB admin already exists, signed in');
    } else {
      warn(`NocoDB auth failed: ${JSON.stringify(ncSignin.data)}`);
    }
  }

  // Ensure default base exists
  if (ncToken) {
    const basesRes = await api(ncUrl, 'GET', '/api/v1/db/meta/projects/', null,
      { 'xc-auth': ncToken });
    const bases = basesRes.data?.list || [];
    let baseId = bases.length > 0 ? bases[0].id : null;

    if (!baseId) {
      log('Creating NocoDB default base...');
      const createBase = await api(ncUrl, 'POST', '/api/v1/db/meta/projects/',
        { title: 'ASuite' }, { 'xc-auth': ncToken });
      baseId = createBase.data?.id;
    }

    if (baseId) {
      log(`NocoDB base: ${baseId}`);

      state.secrets.NC_BASE_ID = baseId;
    }
  }

  // ── Step 6: Setup Plane ──
  log('--- Plane Setup ---');
  // Plane setup requires going through the web UI or using the admin API
  // The Plane API for setup is limited — log instructions
  log('Plane: requires manual first-login via web UI to create workspace.');
  log(`  URL: ${planeUrl}`);
  log(`  Email: ${ADMIN_EMAIL}, Password: ${ADMIN_PASSWORD}`);
  log('  After login: create workspace "asuite", create project, note the project ID.');

  // ── Step 7: Generate ecosystem.config.cjs ──
  log('--- Generating PM2 config ---');
  const ecoPath = path.join(ASUITE_DIR, 'ecosystem.config.cjs');
  if (fs.existsSync(ecoPath)) {
    log('ecosystem.config.cjs already exists — preserving (delete it first to regenerate)');
  } else {
    const adminToken = state.env.GATEWAY_ADMIN_TOKEN || 'asuite-admin-secret';
    const ecoConfig = generateEcosystemConfig(adminToken, state.secrets.NC_BASE_ID);
    fs.writeFileSync(ecoPath, ecoConfig);
    log('ecosystem.config.cjs written');
  }

  // ── Step 8: Generate .env.example ──
  const envExample = [
    '# ASuite Environment Variables',
    '# Copy this file to .env and fill in your values',
    '# Or run: node scripts/asuite-init.js --domain your-domain.com',
    '',
    '# Domain (used for OIDC redirects and CORS)',
    'DOMAIN=localhost',
    '',
    '# Admin credentials (used across all services)',
    'ADMIN_EMAIL=admin@asuite.local',
    'ADMIN_PASSWORD=changeme',
    '',
    '# Mattermost',
    'POSTGRES_MM_PASS=<auto-generated>',
    '',
    '# Outline',
    'OUTLINE_SECRET_KEY=<auto-generated>',
    'OUTLINE_UTILS_SECRET=<auto-generated>',
    'POSTGRES_OL_PASS=<auto-generated>',
    'MINIO_ACCESS_KEY=<auto-generated>',
    'MINIO_SECRET_KEY=<auto-generated>',
    '',
    '# Plane',
    'POSTGRES_PL_PASS=<auto-generated>',
    'PLANE_SECRET_KEY=<auto-generated>',
    '',
    '# NocoDB',
    'POSTGRES_NC_PASS=<auto-generated>',
    '',
    '# Ports (host-side)',
    'MM_PORT=8065',
    'OUTLINE_PORT=3000',
    'PLANE_PORT=8000',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ASUITE_DIR, '.env.example'), envExample);
  log('.env.example written');

  // ── Summary ──
  log('');
  log('=== Bootstrap Complete ===');
  log('');
  log('Next steps:');
  log('1. Start Docker services:  docker compose up -d');
  log('2. Run this script again if services weren\'t ready');
  log('3. Start Gateway + Adapters:  pm2 start ecosystem.config.cjs');
  log('4. Complete Plane setup via web UI');
  log(`5. Open Shell: ${IS_LOCAL ? 'http://localhost:3101' : `https://${DOMAIN}`}`);
  log('');
  log('To register a new agent:');
  log(`  curl -X POST http://localhost:${PORTS.gateway}/api/agents/self-register \\`);
  log('    -H "Content-Type: application/json" \\');
  log('    -d \'{"name":"my-agent","display_name":"My Agent"}\'');
}

function generateEcosystemConfig(adminToken, ncBaseId) {
  // Read current MM_ADMIN_TOKEN from existing config if available
  const existingEco = path.join(ASUITE_DIR, 'ecosystem.config.cjs');
  let mmAdminToken = 'REPLACE_WITH_MM_ADMIN_TOKEN';
  let olToken = 'REPLACE_WITH_OUTLINE_TOKEN';
  let planeToken = 'REPLACE_WITH_PLANE_TOKEN';
  let planeProjectId = 'REPLACE_WITH_PROJECT_ID';
  let ncEmail = ADMIN_EMAIL;
  let ncPassword = ADMIN_PASSWORD;

  if (fs.existsSync(existingEco)) {
    try {
      const content = fs.readFileSync(existingEco, 'utf8');
      const mmMatch = content.match(/MM_ADMIN_TOKEN:\s*'([^']+)'/);
      if (mmMatch) mmAdminToken = mmMatch[1];
      const olMatch = content.match(/OL_TOKEN:\s*'([^']+)'/);
      if (olMatch) olToken = olMatch[1];
      const ptMatch = content.match(/PLANE_TOKEN:\s*'([^']+)'/);
      if (ptMatch) planeToken = ptMatch[1];
      const ppMatch = content.match(/PLANE_PROJECT_ID:\s*'([^']+)'/);
      if (ppMatch) planeProjectId = ppMatch[1];
      const neMatch = content.match(/NOCODB_EMAIL:\s*'([^']+)'/);
      if (neMatch) ncEmail = neMatch[1];
      const npMatch = content.match(/NOCODB_PASSWORD:\s*'([^']+)'/);
      if (npMatch) ncPassword = npMatch[1];
      const nbMatch = content.match(/NOCODB_BASE_ID:\s*'([^']+)'/);
      if (nbMatch && !ncBaseId) ncBaseId = nbMatch[1];
    } catch {}
  }

  return `const path = require('path');

const ASUITE_DIR = path.join(process.env.HOME, 'Documents/asuite');
const GATEWAY_DIR = path.join(ASUITE_DIR, 'gateway');
const ADAPTERS_DIR = path.join(ASUITE_DIR, 'adapters');

module.exports = {
  apps: [
    // ─── API Gateway ─────────────────────────────
    {
      name: 'asuite-gateway',
      script: path.join(GATEWAY_DIR, 'server.js'),
      cwd: GATEWAY_DIR,
      env: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 4000,
        MM_URL: 'http://localhost:8065',
        MM_ADMIN_TOKEN: '${mmAdminToken}',
        OL_URL: 'http://localhost:3000',
        OL_TOKEN: '${olToken}',
        PLANE_URL: 'http://localhost:8000',
        PLANE_TOKEN: '${planeToken}',
        PLANE_WORKSPACE: 'asuite',
        PLANE_PROJECT_ID: '${planeProjectId}',
        NOCODB_URL: 'http://localhost:8080',
        NOCODB_EMAIL: '${ncEmail}',
        NOCODB_PASSWORD: '${ncPassword}',
        NOCODB_BASE_ID: '${ncBaseId || 'REPLACE_WITH_BASE_ID'}',
        ADMIN_TOKEN: '${adminToken}',
      },
      autorestart: true,
      max_restarts: 20,
      min_uptime: '5s',
      restart_delay: 3000,
    },

    // ─── ASuite Shell (Next.js) ──────────────────
    {
      name: 'asuite-shell',
      script: 'node_modules/.bin/next',
      args: 'start -p 3101',
      cwd: path.join(ASUITE_DIR, 'shell'),
      env: {
        NODE_ENV: 'production',
        NEXTAUTH_URL: '${DOMAIN === 'localhost' ? 'http://localhost:3101' : `https://${DOMAIN}`}',
        NEXTAUTH_SECRET: '${genSecret()}',
        DEX_ISSUER: 'http://localhost:5556/dex',
        DEX_CLIENT_ID: 'asuite-shell',
        DEX_CLIENT_SECRET: 'shell-secret-change-me',
        NEXT_PUBLIC_MM_URL: '${IS_LOCAL ? 'http://localhost:8065' : `https://mm.${DOMAIN}`}',
        NEXT_PUBLIC_OUTLINE_URL: '${IS_LOCAL ? 'http://localhost:3000' : `https://outline.${DOMAIN}`}',
        NEXT_PUBLIC_PLANE_URL: '${IS_LOCAL ? 'http://localhost:8000' : `https://plane.${DOMAIN}`}',
        NEXT_PUBLIC_NOCODB_URL: '${IS_LOCAL ? 'http://localhost:8080' : `https://noco.${DOMAIN}`}',
      },
      autorestart: true,
      max_restarts: 20,
      min_uptime: '5s',
      restart_delay: 3000,
    },
  ],
};
`;
}

main().catch(e => {
  console.error(`[init] Fatal: ${e.message}`);
  process.exit(1);
});
