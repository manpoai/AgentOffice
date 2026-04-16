'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import * as gw from '@/lib/api/gateway';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { BottomSheet } from '@/components/shared/BottomSheet';

const PLATFORM_LABELS: Record<string, string> = {
  zylos: 'Zylos',
  openclaw: 'OpenClaw',
  'claude-code': 'Claude Code',
  codex: 'Codex CLI',
  'gemini-cli': 'Gemini CLI',
};

function platformLabel(name: string) {
  return PLATFORM_LABELS[name] || name;
}

function PlatformLogo({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const [imgSrc, setImgSrc] = useState(`/icons/platform-${name}.png`);
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';

  if (failed) {
    return (
      <div className={cn(sizeClass, 'rounded-xl bg-sidebar-primary/10 flex items-center justify-center text-sidebar-primary font-bold text-lg')}>
        {(PLATFORM_LABELS[name] || name).charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={imgSrc}
      alt={name}
      className={cn(sizeClass, 'rounded-xl object-cover')}
      onError={() => {
        if (imgSrc.endsWith('.png')) {
          setImgSrc(`/icons/platform-${name}.jpg`);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

interface ConnectAgentsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectAgentsOverlay({ open, onClose }: ConnectAgentsOverlayProps) {
  const { t } = useT();
  const isMobile = useIsMobile();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  const { data: platformsData } = useQuery({
    queryKey: ['admin-platforms'],
    queryFn: gw.listPlatforms,
    staleTime: 60_000,
  });
  const platforms = platformsData?.platforms || ['openclaw', 'zylos'];

  // Reset state when overlay opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedPlatform(null);
      setPromptText('');
      setCopied(false);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleSelectPlatform(p: string) {
    setSelectedPlatform(p);
    setLoadingPrompt(true);
    setCopied(false);
    try {
      const data = await gw.getOnboardingPrompt(p);
      setPromptText(data.prompt);
    } catch {
      setPromptText('Failed to load prompt.');
    }
    setLoadingPrompt(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={selectedPlatform ? undefined : t('toolbar.connectAgents')} initialHeight="full">
        <div className="flex flex-col h-full">
          {selectedPlatform && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
              <button onClick={() => { setSelectedPlatform(null); setPromptText(''); setCopied(false); }} className="p-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{platformLabel(selectedPlatform)}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {!selectedPlatform ? (
              <div className="grid grid-cols-2 gap-3">
                {platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSelectPlatform(p)}
                    className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border hover:border-sidebar-primary hover:bg-sidebar-primary/5 transition-all"
                  >
                    <PlatformLogo name={p} />
                    <span className="text-sm font-medium">{platformLabel(p)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">{t('actions.sendToAgent')}</p>
                  {!loadingPrompt && promptText && (
                    <button
                      onClick={handleCopy}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
                        copied ? 'bg-green-500 text-white' : 'bg-sidebar-primary text-white hover:opacity-90'
                      )}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? t('actions.copied') : t('actions.copyPrompt')}
                    </button>
                  )}
                </div>
                {loadingPrompt ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-sidebar-primary/30 border-t-sidebar-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <pre className="text-xs text-foreground/80 bg-black/[0.03] dark:bg-white/[0.05] rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed border border-border">
                    {promptText}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              {selectedPlatform && (
                <button
                  onClick={() => { setSelectedPlatform(null); setPromptText(''); setCopied(false); }}
                  className="p-1 -ml-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.1] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 text-foreground/60" />
                </button>
              )}
              <h2 className="text-base font-semibold text-foreground">
                {selectedPlatform ? platformLabel(selectedPlatform) : t('toolbar.connectAgents')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.1] transition-colors"
            >
              <X className="h-4 w-4 text-foreground/60" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!selectedPlatform ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSelectPlatform(p)}
                    className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border hover:border-sidebar-primary hover:bg-sidebar-primary/5 transition-all hover:shadow-sm"
                  >
                    <PlatformLogo name={p} />
                    <span className="text-sm font-medium">{platformLabel(p)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">{t('actions.sendToAgent')}</p>
                  {!loadingPrompt && promptText && (
                    <button
                      onClick={handleCopy}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
                        copied
                          ? 'bg-green-500 text-white'
                          : 'bg-sidebar-primary text-white hover:opacity-90'
                      )}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? t('actions.copied') : t('actions.copyPrompt')}
                    </button>
                  )}
                </div>
                {loadingPrompt ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-sidebar-primary/30 border-t-sidebar-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <pre className="text-xs text-foreground/80 bg-black/[0.03] dark:bg-white/[0.05] rounded-lg p-4 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[50vh] border border-border">
                    {promptText}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
