/**
 * OAuth 2.1 Provider for MCP connector agents.
 *
 * Implements:
 * - RFC 9728: Protected Resource Metadata (/.well-known/oauth-protected-resource)
 * - RFC 8414: Authorization Server Metadata (/.well-known/oauth-authorization-server)
 * - Authorization endpoint (GET /oauth/authorize)
 * - Token endpoint (POST /oauth/token)
 * - PKCE (RFC 7636) mandatory
 *
 * On first successful authorization for a platform, automatically creates
 * a connector agent (singleton per platform).
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import express from 'express';

const urlencodedParser = express.urlencoded({ extended: false });

export default function oauthRoutes(app, shared) {
  const { db, genId, hashToken } = shared;

  function getBaseUrl(req) {
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    return `${proto}://${host}`;
  }

  // ── RFC 9728: Protected Resource Metadata ──────────────────────
  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const base = getBaseUrl(req);
    res.json({
      resource: `${base}/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
    });
  });

  // ── RFC 8414: Authorization Server Metadata ────────────────────
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const base = getBaseUrl(req);
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    });
  });

  // ── Authorization endpoint ─────────────────────────────────────
  app.get('/oauth/authorize', (req, res) => {
    const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, resource } = req.query;

    if (response_type !== 'code') {
      return res.status(400).send('unsupported_response_type');
    }
    if (!client_id || !redirect_uri) {
      return res.status(400).send('invalid_request: missing client_id or redirect_uri');
    }
    if (!code_challenge) {
      return res.status(400).send('invalid_request: PKCE code_challenge required');
    }
    if (code_challenge_method && code_challenge_method !== 'S256') {
      return res.status(400).send('invalid_request: only S256 code_challenge_method supported');
    }

    // Render a simple authorization page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Authorize — AgentOffice</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 100%; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .client-info { background: #f9f9f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .client-info dt { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .client-info dd { font-size: 14px; margin-bottom: 12px; word-break: break-all; }
    .client-info dd:last-child { margin-bottom: 0; }
    .permissions { margin-bottom: 24px; }
    .permissions h3 { font-size: 14px; margin-bottom: 8px; }
    .permissions ul { list-style: none; padding: 0; }
    .permissions li { font-size: 13px; color: #444; padding: 4px 0; }
    .permissions li::before { content: "✓ "; color: #22c55e; }
    .actions { display: flex; gap: 12px; }
    .btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 500; }
    .btn-deny { background: #f1f1f1; color: #333; }
    .btn-allow { background: #171717; color: white; }
    .btn:hover { opacity: 0.9; }
    .error { color: #dc2626; font-size: 13px; margin-top: 12px; display: none; }
    .login-form { margin-bottom: 24px; }
    .login-form label { display: block; font-size: 13px; color: #555; margin-bottom: 4px; }
    .login-form input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; }
    .login-form input:focus { outline: none; border-color: #171717; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize AgentOffice</h1>
    <p class="subtitle">An external application wants to access your workspace.</p>
    <div class="client-info">
      <dt>Application</dt>
      <dd>${escapeHtml(client_id)}</dd>
    </div>
    <div class="permissions">
      <h3>This will allow it to:</h3>
      <ul>
        <li>Read and edit documents, tables, and other content</li>
        <li>Create and manage tasks</li>
        <li>Post comments and messages</li>
        <li>Access skills and memories</li>
      </ul>
    </div>
    <form class="login-form" id="authForm" method="POST" action="/oauth/authorize">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autocomplete="username">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}">
      <input type="hidden" name="state" value="${escapeHtml(state || '')}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || 'S256')}">
      <input type="hidden" name="scope" value="${escapeHtml(scope || 'mcp')}">
      <input type="hidden" name="resource" value="${escapeHtml(resource || '')}">
      <div class="actions">
        <button type="button" class="btn btn-deny" onclick="window.close()">Deny</button>
        <button type="submit" class="btn btn-allow">Authorize</button>
      </div>
      <p class="error" id="errorMsg"></p>
    </form>
  </div>
</body>
</html>`;

    res.type('html').send(html);
  });

  // ── Authorization POST (form submit) ───────────────────────────
  app.post('/oauth/authorize', urlencodedParser, (req, res) => {
    const { username, password, client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, resource } = req.body;

    // Authenticate user
    const actor = db.prepare("SELECT * FROM actors WHERE username = ? AND type = 'human'").get(username);
    if (!actor || !actor.password_hash || !shared.verifyPassword(password, actor.password_hash)) {
      return res.status(401).type('html').send(`
        <html><body><script>
          history.back();
          alert('Invalid username or password');
        </script></body></html>
      `);
    }

    // Determine platform from client_id
    const platform = detectPlatform(client_id);

    // Find or create connector agent for this platform
    let agent = db.prepare(
      "SELECT id FROM actors WHERE type = 'agent' AND agent_kind = 'connector' AND platform = ? AND deleted_at IS NULL"
    ).get(platform);

    if (!agent) {
      const agentId = genId('agt');
      const agentToken = crypto.randomBytes(32).toString('hex');
      const agentName = `${platform}-connector`;
      db.prepare(
        `INSERT INTO actors (id, type, username, display_name, platform, agent_kind, token_hash, pending_approval, online, created_at, updated_at)
         VALUES (?, 'agent', ?, ?, ?, 'connector', ?, 0, 0, ?, ?)`
      ).run(agentId, agentName, platform, platform, hashToken(agentToken), Date.now(), Date.now());
      agent = { id: agentId };
      console.log(`[oauth] Created connector agent: ${agentName} (${agentId}) for platform ${platform}`);
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    db.prepare(
      `INSERT INTO oauth_codes (code, agent_id, client_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(code, agent.id, client_id, redirect_uri, code_challenge, code_challenge_method || 'S256', scope || 'mcp', resource || '', expiresAt);

    // Redirect back with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  });

  // ── Token endpoint ─────────────────────────────────────────────
  app.post('/oauth/token', urlencodedParser, (req, res) => {
    // Accept both form-urlencoded and JSON
    const params = req.body;

    if (params.grant_type === 'authorization_code') {
      return handleAuthCodeGrant(req, res, params);
    }
    if (params.grant_type === 'refresh_token') {
      return handleRefreshGrant(req, res, params);
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
  });

  function handleAuthCodeGrant(req, res, params) {
    const { code, redirect_uri, code_verifier, client_id } = params;

    if (!code || !code_verifier) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code or code_verifier' });
    }

    // Look up code
    const record = db.prepare('SELECT * FROM oauth_codes WHERE code = ?').get(code);
    if (!record) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
    }

    // Delete code (single use)
    db.prepare('DELETE FROM oauth_codes WHERE code = ?').run(code);

    // Check expiry
    if (Math.floor(Date.now() / 1000) > record.expires_at) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
    }

    // Verify redirect_uri matches
    if (redirect_uri && redirect_uri !== record.redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    }

    // Verify PKCE
    const challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    if (challenge !== record.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }

    // Issue tokens
    const accessToken = jwt.sign(
      { agent_id: record.agent_id, type: 'mcp_access', scope: record.scope || 'mcp' },
      shared.JWT_SECRET,
      { expiresIn: '1h' },
    );
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // Store refresh token
    db.prepare(
      `INSERT INTO oauth_tokens (token_hash, agent_id, client_id, token_type, scope, resource, expires_at)
       VALUES (?, ?, ?, 'refresh', ?, ?, ?)`
    ).run(
      hashToken(refreshToken),
      record.agent_id,
      record.client_id,
      record.scope || 'mcp',
      record.resource || '',
      Math.floor(Date.now() / 1000) + 30 * 86400, // 30 days
    );

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: record.scope || 'mcp',
    });
  }

  function handleRefreshGrant(req, res, params) {
    const { refresh_token } = params;
    if (!refresh_token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token' });
    }

    const hash = hashToken(refresh_token);
    const record = db.prepare("SELECT * FROM oauth_tokens WHERE token_hash = ? AND token_type = 'refresh'").get(hash);
    if (!record) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
    }

    // Check expiry
    if (record.expires_at && Math.floor(Date.now() / 1000) > record.expires_at) {
      db.prepare('DELETE FROM oauth_tokens WHERE token_hash = ?').run(hash);
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token expired' });
    }

    // Rotate refresh token
    db.prepare('DELETE FROM oauth_tokens WHERE token_hash = ?').run(hash);
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    db.prepare(
      `INSERT INTO oauth_tokens (token_hash, agent_id, client_id, token_type, scope, resource, expires_at)
       VALUES (?, ?, ?, 'refresh', ?, ?, ?)`
    ).run(
      hashToken(newRefreshToken),
      record.agent_id,
      record.client_id,
      record.scope || 'mcp',
      record.resource || '',
      Math.floor(Date.now() / 1000) + 30 * 86400,
    );

    const accessToken = jwt.sign(
      { agent_id: record.agent_id, type: 'mcp_access', scope: record.scope || 'mcp' },
      shared.JWT_SECRET,
      { expiresIn: '1h' },
    );

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: record.scope || 'mcp',
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  function detectPlatform(clientId) {
    if (!clientId) return 'unknown';
    const lower = clientId.toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic')) return 'claude.ai';
    if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt';
    return 'mcp-connector';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

