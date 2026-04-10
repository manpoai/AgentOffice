'use client';

import { gwAuthHeaders } from '@/lib/api/gateway';

export type RemoteAccessStatus = 'not_ready' | 'configuring' | 'ready' | 'failed';
export type RemoteAccessMode = 'public_tunnel' | 'public_custom_domain' | null;

export type RemoteAccessConfig = {
  status: RemoteAccessStatus;
  mode: RemoteAccessMode;
  publicBaseUrl: string | null;
};

const STORAGE_KEY = 'agentoffice-remote-access';
const DEFAULT_REMOTE_ACCESS_CONFIG: RemoteAccessConfig = {
  status: 'not_ready',
  mode: 'public_tunnel',
  publicBaseUrl: null,
};

function normalizeRemoteAccessConfig(parsed: Partial<RemoteAccessConfig> | null | undefined): RemoteAccessConfig {
  return {
    status: parsed?.status ?? DEFAULT_REMOTE_ACCESS_CONFIG.status,
    mode: parsed?.mode ?? DEFAULT_REMOTE_ACCESS_CONFIG.mode,
    publicBaseUrl: parsed?.publicBaseUrl ?? DEFAULT_REMOTE_ACCESS_CONFIG.publicBaseUrl,
  };
}

export function readRemoteAccessConfig(): RemoteAccessConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_REMOTE_ACCESS_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REMOTE_ACCESS_CONFIG;
    return normalizeRemoteAccessConfig(JSON.parse(raw) as Partial<RemoteAccessConfig>);
  } catch {
    return DEFAULT_REMOTE_ACCESS_CONFIG;
  }
}

export function writeRemoteAccessConfig(next: Partial<RemoteAccessConfig>): RemoteAccessConfig {
  const merged = normalizeRemoteAccessConfig({ ...readRemoteAccessConfig(), ...next });
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('agentoffice-remote-access-change', { detail: merged }));
  }
  return merged;
}

export async function fetchRemoteAccessConfig(): Promise<RemoteAccessConfig> {
  const res = await fetch('/api/gateway/auth/remote-access', {
    headers: gwAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Remote access config: ${res.status}`);
  }
  const data = normalizeRemoteAccessConfig(await res.json());
  return writeRemoteAccessConfig(data);
}

export async function updateRemoteAccessCustomDomain(publicBaseUrl: string): Promise<RemoteAccessConfig> {
  const res = await fetch('/api/gateway/auth/remote-access', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...gwAuthHeaders(),
    },
    body: JSON.stringify({ publicBaseUrl }),
  });
  if (!res.ok) {
    throw new Error(`Update remote access config: ${res.status}`);
  }
  const data = normalizeRemoteAccessConfig(await res.json());
  return writeRemoteAccessConfig(data);
}

/**
 * Returns the public origin for constructing external-facing URLs (copy link, share, etc.).
 * Prefers configured publicBaseUrl, falls back to window.location.origin.
 */
export function getPublicOrigin(): string {
  if (typeof window === 'undefined') return '';
  const config = readRemoteAccessConfig();
  if (config.publicBaseUrl) {
    return config.publicBaseUrl.replace(/\/$/, '');
  }
  return window.location.origin;
}

export async function startAutomaticPublicUrlSetup(): Promise<RemoteAccessConfig & { nextAction?: string; cloudflared?: { installed: boolean; installCommand: string } }> {
  const res = await fetch('/api/gateway/auth/remote-access', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...gwAuthHeaders(),
    },
    body: JSON.stringify({ mode: 'public_tunnel' }),
  });
  if (!res.ok) {
    throw new Error(`Start automatic public URL setup: ${res.status}`);
  }
  const data = await res.json();
  writeRemoteAccessConfig(data);
  return data;
}
