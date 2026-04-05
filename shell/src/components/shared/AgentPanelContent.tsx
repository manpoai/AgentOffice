'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Copy, X, Check, Key, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import * as gw from '@/lib/api/gateway';

export interface AgentPanelContentProps {
  variant: 'popover' | 'bottomsheet';
  allAgents: Awaited<ReturnType<typeof gw.listAllAgents>> | undefined;
  onboardingPromptText?: string;
}

export function AgentPanelContent({ variant, allAgents, onboardingPromptText = '' }: AgentPanelContentProps) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [resetTokenConfirmId, setResetTokenConfirmId] = useState<string | null>(null);
  const [resetTokenResult, setResetTokenResult] = useState<{ agentId: string; token: string } | null>(null);

  const isPopover = variant === 'popover';

  // In bottomsheet mode, only show connected (non-pending) agents
  const connected = allAgents?.filter(a => !a.pending_approval) || [];
  const pending = allAgents?.filter(a => a.pending_approval) || [];

  if (variant === 'bottomsheet') {
    if (!allAgents || connected.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Bot className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t('sidebar.noAgents')}</p>
        </div>
      );
    }
    return (
      <>
        {connected.map(agent => (
          <div key={agent.agent_id || agent.name} className="flex items-center gap-3 py-3">
            <div className="w-12 h-12 rounded-full bg-muted overflow-hidden shrink-0 border border-black/10 relative">
              {agent.avatar_url ? (
                <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Bot className="h-5 w-5 text-sidebar-primary" />
                </div>
              )}
              <div className={cn(
                'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-card',
                agent.online ? 'bg-green-500' : 'bg-gray-300'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-base font-medium text-foreground truncate block">{agent.display_name || agent.name}</span>
              <span className="text-sm text-muted-foreground">{agent.name}</span>
            </div>
          </div>
        ))}
      </>
    );
  }

  // Popover variant — full panel with Add Agent, pending, connected
  return (
    <div className="p-4">
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
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-card
                            border border-black/10 dark:border-border rounded-lg
                            shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)] p-3 w-[360px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">
                  {t('actions.sendToAgent')}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(onboardingPromptText)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-sidebar-primary
                             hover:bg-sidebar-primary/10 rounded transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {t('actions.copyPrompt')}
                </button>
              </div>
              <pre className="text-[11px] text-muted-foreground bg-black/[0.03] dark:bg-white/[0.05]
                              rounded p-2 max-h-[300px] overflow-y-auto whitespace-pre-wrap
                              font-mono leading-relaxed">
                {onboardingPromptText}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* Pending Approved section */}
      {pending.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-foreground/50 mb-2">{t('sidebar.pendingApproved')}</p>
          {pending.map(agent => (
            <div key={agent.agent_id || agent.name} className="flex items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-muted overflow-hidden shrink-0 border border-black/10">
                {agent.avatar_url ? (
                  <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Bot className="h-5 w-5 text-sidebar-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">{agent.display_name || agent.name}</span>
                </div>
                <span className="text-xs text-foreground/50">{agent.name}</span>
              </div>
              <button
                onClick={async () => {
                  try { /* reject not implemented yet */ } catch {}
                }}
                className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors"
              >
                <X className="h-4 w-4 text-red-500" />
              </button>
              <button
                onClick={async () => {
                  try {
                    await gw.approveAgent(agent.agent_id || agent.name);
                    queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
                  } catch {}
                }}
                className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0 hover:opacity-90 transition-colors"
              >
                <Check className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connected section */}
      {connected.length === 0 && pending.length === 0 && (!allAgents || allAgents.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Bot className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-xs">{t('sidebar.noAgents')}</p>
        </div>
      ) : connected.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-foreground/50 mb-2">{t('sidebar.connected')}</p>
          {connected.map(agent => (
            <div key={agent.agent_id || agent.name} className="flex items-center gap-3 py-2 group rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] px-2 -mx-2 transition-colors">
              <div className="w-12 h-12 rounded-full bg-muted overflow-hidden shrink-0 border border-black/10 relative">
                {agent.avatar_url ? (
                  <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Bot className="h-5 w-5 text-sidebar-primary" />
                  </div>
                )}
                <div className={cn(
                  'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-card',
                  agent.online ? 'bg-green-500' : 'bg-gray-300'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">{agent.display_name || agent.name}</span>
                </div>
                <span className="text-xs text-foreground/50">{agent.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-black/[0.05]">
                  <Pencil className="h-3.5 w-3.5 text-foreground/40" />
                </button>
                <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-black/[0.05]">
                  <Trash2 className="h-3.5 w-3.5 text-foreground/40" />
                </button>
                {resetTokenConfirmId === (agent.agent_id || agent.name) ? (
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[10px] text-foreground/60">{t('actions.resetTokenConfirm')}</span>
                    <button
                      onClick={async () => {
                        try {
                          const result = await gw.resetAgentToken(agent.agent_id || agent.name);
                          setResetTokenResult({ agentId: agent.agent_id || agent.name, token: result.token });
                        } catch {}
                        setResetTokenConfirmId(null);
                      }}
                      className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors shrink-0"
                    >
                      {t('common.confirm')}
                    </button>
                    <button
                      onClick={() => setResetTokenConfirmId(null)}
                      className="px-1.5 py-0.5 text-[10px] font-medium text-foreground/60 bg-black/[0.05] rounded hover:bg-black/[0.1] transition-colors shrink-0"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setResetTokenConfirmId(agent.agent_id || agent.name)}
                    className="w-8 h-8 rounded flex items-center justify-center hover:bg-black/[0.05] text-[10px] text-foreground/40"
                    title={t('actions.resetToken')}
                  >
                    <Key className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* New token display (inline) */}
      {resetTokenResult && (
        <div className="mt-3 border border-amber-200 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
            {t('actions.newTokenWarning')}
          </p>
          <div className="flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.05] rounded p-2">
            <code className="text-xs font-mono flex-1 break-all">{resetTokenResult.token}</code>
            <button
              onClick={() => navigator.clipboard.writeText(resetTokenResult.token)}
              className="shrink-0 p-1 rounded hover:bg-black/[0.08] transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => setResetTokenResult(null)}
            className="mt-2 w-full py-1 text-xs font-medium text-sidebar-primary hover:underline"
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
}
