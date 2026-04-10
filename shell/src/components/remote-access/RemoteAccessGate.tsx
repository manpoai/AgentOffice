'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  readRemoteAccessConfig,
  startAutomaticPublicUrlSetup,
  updateRemoteAccessCustomDomain,
  writeRemoteAccessConfig,
} from '@/lib/remote-access';

export function RemoteAccessGate() {
  const [config, setConfig] = useState(() => readRemoteAccessConfig());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState(config.publicBaseUrl || '');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [installInfo, setInstallInfo] = useState<{ installCommand: string } | null>(null);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setConfig(detail || readRemoteAccessConfig());
    };
    window.addEventListener('agentoffice-remote-access-change', handleChange as EventListener);
    return () => {
      window.removeEventListener('agentoffice-remote-access-change', handleChange as EventListener);
    };
  }, []);

  // When remote access becomes ready, redirect to the public URL
  useEffect(() => {
    if (config.status === 'ready' && config.publicBaseUrl) {
      const publicOrigin = config.publicBaseUrl.replace(/\/$/, '');
      const currentOrigin = window.location.origin;
      if (publicOrigin !== currentOrigin) {
        window.location.href = publicOrigin + window.location.pathname + window.location.search;
      } else {
        // Already on public URL — just reload to pass the gate
        window.location.reload();
      }
    }
  }, [config.status, config.publicBaseUrl]);

  const handleAutomaticPublicUrl = async () => {
    setLoading(true);
    setError(null);
    setInstallInfo(null);
    try {
      setConfig(writeRemoteAccessConfig({ status: 'configuring', mode: 'public_tunnel', publicBaseUrl: null }));
      const updated = await startAutomaticPublicUrlSetup();
      setConfig(updated);
      if (updated.nextAction === 'install_cloudflared') {
        setInstallInfo({ installCommand: updated.cloudflared?.installCommand || '' });
        setError('cloudflared is not installed. Please install it first. / cloudflared 未安装，请先安装。');
      }
    } catch {
      setConfig(writeRemoteAccessConfig({ status: 'failed', mode: 'public_tunnel', publicBaseUrl: null }));
      setError('Failed to start tunnel. / 隧道启动失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDomain = async () => {
    if (!customUrl || !/^https:\/\//.test(customUrl)) {
      setError('URL must start with https:// / 地址必须以 https:// 开头');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setConfig(writeRemoteAccessConfig({ status: 'configuring', mode: 'public_custom_domain', publicBaseUrl: customUrl.trim() }));
      const updated = await updateRemoteAccessCustomDomain(customUrl.trim());
      setConfig(updated);
      if (updated.status === 'failed') {
        setError('Health check failed. Please check your reverse proxy configuration. / 健康检查未通过，请检查反向代理配置。');
      }
    } catch {
      setConfig(writeRemoteAccessConfig({ status: 'failed', mode: 'public_custom_domain', publicBaseUrl: customUrl.trim() }));
      setError('Failed to verify URL. / 验证地址失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryCheck = async () => {
    if (!config.publicBaseUrl) {
      setError('No URL configured to retry. / 没有已配置的地址可重试。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setConfig(writeRemoteAccessConfig({ status: 'configuring' }));
      const updated = await updateRemoteAccessCustomDomain(config.publicBaseUrl);
      setConfig(updated);
      if (updated.status === 'failed') {
        setError('Health check still failing. / 健康检查仍未通过。');
      }
    } catch {
      setConfig(writeRemoteAccessConfig({ status: 'failed' }));
      setError('Retry failed. / 重试失败。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Remote access setup is incomplete</h1>
          <p className="text-sm text-muted-foreground">
            AgentOffice has started locally, but collaboration is locked until remote access is ready.
          </p>
          <p className="text-sm text-muted-foreground">
            远程访问配置尚未完成。在远程访问就绪前，协作工作区保持锁定。
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background/60 p-4 text-sm space-y-1">
          <div>Status / 当前状态：<span className="font-medium">{config.status}</span></div>
          <div>Mode / 当前模式：<span className="font-medium">{config.mode || 'unset'}</span></div>
          <div className="break-all">Public URL / 公网地址：<span className="font-medium">{config.publicBaseUrl || 'Not configured / 未配置'}</span></div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            {installInfo && (
              <div className="mt-2 rounded-lg bg-muted p-3 text-xs text-foreground font-mono">
                {installInfo.installCommand}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button
            onClick={handleAutomaticPublicUrl}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && config.mode === 'public_tunnel' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting tunnel... / 正在启动隧道...
              </>
            ) : (
              'Set up automatic public URL / 配置自动公网地址'
            )}
          </button>

          {showCustomInput ? (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <label className="text-sm font-medium">Public URL / 公网地址</label>
              <input
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://office.example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCustomDomain}
                  disabled={loading}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && config.mode === 'public_custom_domain' ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    'Verify / 验证'
                  )}
                </button>
                <button
                  onClick={() => setShowCustomInput(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Cancel / 取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              disabled={loading}
              className="rounded-xl border border-border px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              Use custom domain / 使用自定义域名
            </button>
          )}

          {config.publicBaseUrl && (
            <button
              onClick={handleRetryCheck}
              disabled={loading}
              className="rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && !config.mode ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Checking...</>
              ) : (
                'Retry check / 重新检查'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
