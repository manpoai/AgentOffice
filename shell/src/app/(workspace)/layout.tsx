'use client';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { RemoteAccessGate } from '@/components/remote-access/RemoteAccessGate';
import { fetchRemoteAccessConfig, readRemoteAccessConfig } from '@/lib/remote-access';
import { useEffect, useState } from 'react';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { actor, loading } = useAuth();
  const [remoteAccess, setRemoteAccess] = useState(() => readRemoteAccessConfig());
  const [remoteAccessResolved, setRemoteAccessResolved] = useState(false);

  useEffect(() => {
    if (!loading && actor) {
      fetchRemoteAccessConfig()
        .then((config) => {
          setRemoteAccess(config);
          setRemoteAccessResolved(true);
        })
        .catch(() => {
          const fallback = readRemoteAccessConfig();
          setRemoteAccess(fallback);
          setRemoteAccessResolved(fallback.status === 'ready');
        });
    }
  }, [loading, actor]);

  useEffect(() => {
    if (!loading && !actor) {
      window.location.href = '/login';
    }
  }, [loading, actor]);

  if (loading || (actor && !remoteAccessResolved)) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#aaa' }}>
        Loading...
      </div>
    );
  }

  if (!actor) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#aaa' }}>
        Loading...
      </div>
    );
  }

  if (remoteAccess.status !== 'ready') {
    return <RemoteAccessGate />;
  }

  return <AppShell>{children}</AppShell>;
}
