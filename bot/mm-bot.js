#!/usr/bin/env node
// Mattermost Bot — listens via WebSocket, replies when @mentioned
// Usage: MM_TOKEN=xxx MM_URL=http://localhost:8065 node mm-bot.js

const WebSocket = require('ws');
const http = require('http');
const https = require('https');

const MM_URL = process.env.MM_URL || 'http://localhost:8065';
const MM_TOKEN = process.env.MM_TOKEN;
const BOT_NAME = process.env.BOT_NAME || 'bot';

if (!MM_TOKEN) {
  console.error('MM_TOKEN is required');
  process.exit(1);
}

// Simple HTTP helper (no dependencies needed)
function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MM_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${MM_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get bot's own user info
  const me = await apiCall('GET', '/api/v4/users/me');
  console.log(`Bot: ${me.username} (${me.id})`);

  // Connect WebSocket
  const wsUrl = MM_URL.replace(/^http/, 'ws') + '/api/v4/websocket';
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    // Authenticate
    ws.send(JSON.stringify({
      seq: 1,
      action: 'authentication_challenge',
      data: { token: MM_TOKEN },
    }));
    console.log(`[${BOT_NAME}] Connected to Mattermost WebSocket`);
  });

  ws.on('message', async (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.event === 'posted') {
      const post = JSON.parse(msg.data.post);

      // Skip own messages
      if (post.user_id === me.id) return;

      // Check if mentioned or DM
      const isDM = msg.data.channel_type === 'D';
      const isMentioned = post.message && post.message.includes(`@${me.username}`);

      if (isDM || isMentioned) {
        const text = post.message.replace(`@${me.username}`, '').trim();
        console.log(`[${BOT_NAME}] Received: "${text}" from ${post.user_id} in ${post.channel_id}`);

        // Echo reply for now — this is where agent logic plugs in
        const reply = `[${BOT_NAME}] 收到: "${text}"\n\n（这是自动回复，后续会接入真正的 Agent 处理逻辑）`;

        await apiCall('POST', '/api/v4/posts', {
          channel_id: post.channel_id,
          message: reply,
          root_id: post.root_id || post.id,
        });
        console.log(`[${BOT_NAME}] Replied in ${post.channel_id}`);
      }
    }
  });

  ws.on('close', (code) => {
    console.log(`[${BOT_NAME}] WebSocket closed (${code}), reconnecting in 3s...`);
    setTimeout(main, 3000);
  });

  ws.on('error', (err) => {
    console.error(`[${BOT_NAME}] WebSocket error:`, err.message);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
