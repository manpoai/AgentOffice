'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as gw from '@/lib/api/gateway';
import { resolveAvatarUrl } from '@/lib/api/gateway';
import { Users, Bot, Circle, Clock, MessageSquare, CheckSquare, Pencil, Camera, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useT } from '@/lib/i18n';
import { formatRelativeTime } from '@/lib/utils/time';
import { useState, useRef } from 'react';
import { showError } from '@/lib/utils/error';

export default function ContactsPage() {
  const { t } = useT();
  const [editingAgent, setEditingAgent] = useState<gw.Agent | null>(null);
  const { data: agents, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: gw.listAgents,
    refetchInterval: 10_000,
  });

  const activeAgents = agents?.filter(a => a.online) || [];
  const offlineAgents = agents?.filter(a => !a.online) || [];

  return (
    <div className="flex h-full overflow-hidden flex-col md:flex-row">
      {/* Agent list */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">{t('contacts.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {agents ? `${agents.length} ${t('contacts.count')}` : t('contacts.loading')}
          </p>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-6">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('contacts.loading')}</p>
            )}

            {error && (
              <p className="text-sm text-destructive text-center py-8">
                {t('contacts.loadFailed')}: {(error as Error).message}
              </p>
            )}

            {activeAgents.length > 0 && (
              <AgentSection title={t('contacts.online')} icon={Circle} agents={activeAgents} variant="online" onEdit={setEditingAgent} />
            )}

            {offlineAgents.length > 0 && (
              <AgentSection title={t('contacts.offline')} icon={Circle} agents={offlineAgents} variant="offline" onEdit={setEditingAgent} />
            )}

            {agents && agents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bot className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm">{t('contacts.noAgents')}</p>
                <p className="text-xs mt-1">{t('contacts.registerHint')}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {editingAgent && (
        <EditAgentModal agent={editingAgent} onClose={() => setEditingAgent(null)} />
      )}
    </div>
  );
}

function AgentSection({
  title, icon: Icon, agents, variant, onEdit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  agents: gw.Agent[];
  variant: 'online' | 'offline' | 'warning';
  onEdit: (agent: gw.Agent) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-3 w-3', {
          'text-green-500 fill-green-500': variant === 'online',
          'text-muted-foreground': variant === 'offline',
          'text-yellow-500': variant === 'warning',
        })} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title} ({agents.length})
        </span>
      </div>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map(agent => (
          <AgentCard key={agent.name} agent={agent} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, onEdit }: { agent: gw.Agent; onEdit: (agent: gw.Agent) => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const statusColor = agent.online ? 'bg-green-500' : 'bg-muted-foreground';
  const router = useRouter();
  const avatarUrl = resolveAvatarUrl(agent.avatar_url);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(agent.display_name || agent.name);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await gw.adminUploadAgentAvatar(agent.agent_id, file);
      qc.invalidateQueries({ queryKey: ['agents'] });
    } catch (err) {
      showError(t('contacts.changeAvatar'), err);
    } finally {
      setUploading(false);
    }
  }

  async function handleNameSave() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === (agent.display_name || agent.name)) {
      setEditingName(false);
      return;
    }
    try {
      await gw.adminUpdateAgent(agent.agent_id, { display_name: trimmed });
      qc.invalidateQueries({ queryKey: ['agents'] });
    } catch (err) {
      showError(t('contacts.editAgent'), err);
    }
    setEditingName(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar with hover upload */}
        <div
          className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer"
          onClick={() => avatarInputRef.current?.click()}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Bot className="h-4 w-4 text-sidebar-primary" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            {uploading ? (
              <span className="text-white text-[10px]">...</span>
            ) : (
              <Camera className="h-3.5 w-3.5 text-white" />
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                className="text-sm font-medium text-foreground bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') { setEditingName(false); setNameValue(agent.display_name || agent.name); } }}
                onBlur={handleNameSave}
                autoFocus
              />
            ) : (
              <span className="text-sm font-medium text-foreground truncate">
                {agent.display_name || agent.name}
              </span>
            )}
            <span className={cn('w-2 h-2 rounded-full shrink-0', statusColor)} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{agent.name}</p>
          {agent.platform && (
            <p className="text-xs text-muted-foreground mt-1">{agent.platform}</p>
          )}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {agent.capabilities.slice(0, 4).map(cap => (
                <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{cap}</span>
              ))}
              {agent.capabilities.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{agent.capabilities.length - 4}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {agent.last_seen_at != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1">
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(agent.last_seen_at, t)}</span>
              </div>
            )}
            <button
              onClick={() => router.push('/im')}
              className="p-1 text-muted-foreground hover:text-sidebar-primary transition-colors"
              title={t('contacts.sendMessage')}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => router.push('/tasks')}
              className="p-1 text-muted-foreground hover:text-sidebar-primary transition-colors"
              title={t('contacts.assignTask')}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setEditingName(true); setNameValue(agent.display_name || agent.name); }}
              className="p-1 text-muted-foreground hover:text-sidebar-primary transition-colors"
              title={t('contacts.editAgent')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// EditAgentModal removed — inline editing is now built into AgentCard
