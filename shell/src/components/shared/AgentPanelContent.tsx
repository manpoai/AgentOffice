'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Copy, X, Check, Key, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import * as gw from '@/lib/api/gateway';

export interface AgentPanelContentProps {
  variant: 'popover' | 'bottomsheet';
}

export function AgentPanelContent({ variant }: AgentPanelContentProps) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [resetTokenConfirmId, setResetTokenConfirmId] = useState<string | null>(null);
  const [resetTokenResult, setResetTokenResult] = useState<{ agentId: string; token: string } | null>(null);

  // Agents data — fetched internally
  const { data: allAgents } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: gw.listAllAgents,
    refetchInterval: 10_000,
  });

  // Onboarding prompt — fetched internally, URL replaced once
  const [promptText, setPromptText] = useState('');
  useEffect(() => {
    if (promptText) return;
    const url = window.location.origin;
    gw.getAgentSkills()
      .then(d => {
        setPromptText((d.onboarding_prompt || '').replace(/\{ASUITE_URL\}/g, url));
      })
      .catch(() => {});
  }, []);

  const isCompact = variant === 'bottomsheet';
  const styles = {
    wrapper:     isCompact ? 'px-4 pb-4' : 'p-4',
    avatar:      isCompact ? 'w-10 h-10' : 'w-12 h-12',
    avatarIcon:  isCompact ? 'h-4 w-4'  : 'h-5 w-5',
    promptWidth: isCompact ? 'w-[320px]' : 'w-[360px]',
    promptMaxH:  isCompact ? 'max-h-[200px]' : 'max-h-[300px]',
    connectedPy: isCompact ? 'py-3' : 'py-2',
    pendingMb:   isCompact ? 'mb-3' : 'mb-4',
  };

  const connected = allAgents?.filter(a => !a.pending_approval) || [];
  const pending   = allAgents?.filter(a => a.pending_approval)  || [];

  return (
    <div className={styles.wrapper}>
      {/* Header: Add Agent + Onboarding Prompt */}
      <div className="flex items-center justify-between mb-3 relative">
        <h3 className="text-sm font-medium text-foreground">{t('actions.agentMembers')}</h3>
        <button
          onClick={() => setShowOnboardingPrompt(v => !v)}
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-sidebar-primary hover:bg-sidebar-primary/10 rounded transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t('actions.addAgent')}
        </button>
        {showOnboardingPrompt && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowOnboardingPrompt(false)} />
            <div className={cn('absolute right-0 top-full mt-1 z-50 bg-white dark:bg-card border border-black/10 dark:border-border rounded-lg shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)] p-3', styles.promptWidth)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">{t('actions.sendToAgent')}</span>
                <button onClick={() => navigator.clipboard.writeText(promptText)} className="flex items-center gap-1 px-2 py-0.5 text-xs text-sidebar-primary hover:bg-sidebar-primary/10 rounded transition-colors">
                  <Copy className="h-3 w-3" />{t('actions.copyPrompt')}
                </button>
              </div>
              <pre className={cn('text-[11px] text-muted-foreground bg-black/[0.03] dark:bg-white/[0.05] rounded p-2 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed', styles.promptMaxH)}>
                {promptText}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className={styles.pendingMb}>
          <p className="text-xs font-medium text-foreground/50 mb-2">{t('sidebar.pendingApproved')}</p>
          {pending.map(agent => (
            <div key={agent.agent_id || agent.name} className="flex items-center gap-3 py-2">
              <div className={cn(styles.avatar, 'rounded-full bg-muted overflow-hidden shrink-0 border border-black/10')}>
                {agent.avatar_url
                  ? <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Bot className={cn(styles.avatarIcon, 'text-sidebar-primary')} /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{agent.display_name || agent.name}</span>
                <span className="text-xs text-foreground/50">{agent.name}</span>
              </div>
              {/* Reject — desktop only (hover meaningless on touch) */}
              {!isCompact && (
                <button onClick={async () => { try { /* reject not implemented */ } catch {} }} className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors">
                  <X className="h-4 w-4 text-red-500" />
                </button>
              )}
              <button
                onClick={async () => { try { await gw.approveAgent(agent.agent_id || agent.name); queryClient.invalidateQueries({ queryKey: ['admin-agents'] }); } catch {} }}
                className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0 hover:opacity-90 transition-colors"
              >
                <Check className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connected */}
      {connected.length === 0 && pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Bot className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t('sidebar.noAgents')}</p>
        </div>
      ) : connected.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-foreground/50 mb-2">{t('sidebar.connected')}</p>
          {connected.map(agent => (
            <div key={agent.agent_id || agent.name} className={cn('flex items-center gap-3 group rounded-lg transition-colors', styles.connectedPy, !isCompact && 'hover:bg-black/[0.05] dark:hover:bg-white/[0.05] px-2 -mx-2')}>
              <div className={cn(styles.avatar, 'rounded-full bg-muted overflow-hidden shrink-0 border border-black/10 relative')}>
                {agent.avatar_url
                  ? <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Bot className={cn(styles.avatarIcon, 'text-sidebar-primary')} /></div>}
                <div className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-card', agent.online ? 'bg-green-500' : 'bg-gray-300')} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{agent.display_name || agent.name}</span>
                <span className="text-xs text-foreground/50">{agent.name}</span>
              </div>
              {/* Hover actions — desktop only */}
              {!isCompact && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-black/[0.05]"><Pencil className="h-3.5 w-3.5 text-foreground/40" /></button>
                  <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-black/[0.05]"><Trash2 className="h-3.5 w-3.5 text-foreground/40" /></button>
                  {resetTokenConfirmId === (agent.agent_id || agent.name) ? (
                    <div className="flex items-center gap-1 ml-1">
                      <span className="text-[10px] text-foreground/60">{t('actions.resetTokenConfirm')}</span>
                      <button onClick={async () => { try { const r = await gw.resetAgentToken(agent.agent_id || agent.name); setResetTokenResult({ agentId: agent.agent_id || agent.name, token: r.token }); } catch {} setResetTokenConfirmId(null); }} className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors shrink-0">{t('common.confirm')}</button>
                      <button onClick={() => setResetTokenConfirmId(null)} className="px-1.5 py-0.5 text-[10px] font-medium text-foreground/60 bg-black/[0.05] rounded hover:bg-black/[0.1] transition-colors shrink-0">{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setResetTokenConfirmId(agent.agent_id || agent.name)} className="w-8 h-8 rounded flex items-center justify-center hover:bg-black/[0.05] text-[10px] text-foreground/40" title={t('actions.resetToken')}>
                      <Key className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* New token display */}
      {resetTokenResult && (
        <div className="mt-3 border border-amber-200 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">{t('actions.newTokenWarning')}</p>
          <div className="flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.05] rounded p-2">
            <code className="text-xs font-mono flex-1 break-all">{resetTokenResult.token}</code>
            <button onClick={() => navigator.clipboard.writeText(resetTokenResult.token)} className="shrink-0 p-1 rounded hover:bg-black/[0.08] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
          </div>
          <button onClick={() => setResetTokenResult(null)} className="mt-2 w-full py-1 text-xs font-medium text-sidebar-primary hover:underline">{t('common.close')}</button>
        </div>
      )}
    </div>
  );
}
