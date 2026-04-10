/**
 * Cloudflared tunnel process manager.
 * Used by gateway as fallback when CLI setup was skipped/failed.
 */
import { spawn, spawnSync } from 'child_process';
import { readAgentOfficeConfig, writeAgentOfficeConfig } from './config.js';

let tunnelChild = null;
let tunnelState = { state: 'idle', publicUrl: null, error: null };

function writePublicUrlToConfig(publicUrl) {
  try {
    const config = readAgentOfficeConfig() || {};
    if (!config.remoteAccess) config.remoteAccess = {};
    config.remoteAccess.status = 'ready';
    config.remoteAccess.mode = 'public_tunnel';
    config.remoteAccess.publicBaseUrl = publicUrl;
    writeAgentOfficeConfig(config);
  } catch (e) {
    console.error('[tunnel] Failed to write config:', e.message);
  }
}

function clearPublicUrlFromConfig() {
  try {
    const config = readAgentOfficeConfig();
    if (!config?.remoteAccess) return;
    // Only clear if it was set by public_tunnel (don't touch custom_domain)
    if (config.remoteAccess.mode !== 'public_tunnel') return;
    config.remoteAccess.status = 'not_ready';
    delete config.remoteAccess.publicBaseUrl;
    writeAgentOfficeConfig(config);
  } catch (e) {
    console.error('[tunnel] Failed to clear config:', e.message);
  }
}

export function detectCloudflared() {
  const result = spawnSync('cloudflared', ['--version'], { encoding: 'utf8' });
  const installed = result.status === 0;
  return {
    installed,
    version: installed ? (result.stdout || result.stderr || '').trim() : null,
    installCommand: process.platform === 'darwin'
      ? 'brew install cloudflared'
      : 'Install cloudflared from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
  };
}

export async function startTunnel(targetUrl) {
  if (tunnelChild) {
    throw new Error('Tunnel already running');
  }

  tunnelState = { state: 'starting', publicUrl: null, error: null };

  const child = spawn('cloudflared', ['tunnel', '--url', targetUrl], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      tunnelState = { state: 'failed', publicUrl: null, error: 'Tunnel startup timed out (30s)' };
      tunnelChild = null;
      reject(new Error('Tunnel startup timed out (30s)'));
    }, 30000);

    let output = '';
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        tunnelChild = child;
        tunnelState = { state: 'running', publicUrl: match[0], error: null };
        writePublicUrlToConfig(match[0]);
        resolve({ publicUrl: match[0] });
      }
    };
    child.stderr.on('data', onData);
    child.stdout.on('data', onData);

    child.on('exit', (code) => {
      clearTimeout(timeout);
      tunnelChild = null;
      if (tunnelState.state === 'starting') {
        tunnelState = { state: 'failed', publicUrl: null, error: `cloudflared exited with code ${code}` };
        reject(new Error(`cloudflared exited with code ${code}`));
      } else {
        tunnelState = { state: 'idle', publicUrl: null, error: `Tunnel exited (code ${code})` };
        clearPublicUrlFromConfig();
      }
    });
  });
}

export function stopTunnel() {
  if (tunnelChild) {
    tunnelChild.kill('SIGTERM');
    tunnelChild = null;
    tunnelState = { state: 'idle', publicUrl: null, error: null };
    clearPublicUrlFromConfig();
  }
}

export function getTunnelStatus() {
  return { ...tunnelState };
}
