'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as gw from '@/lib/api/gateway';
import { Bot, Circle, Clock, MessageSquare, CheckSquare, Pencil, Check, X, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useT } from '@/lib/i18n';
import { useState, useRef, useEffect } from 'react';

export default function ContactsPage() {
  const { t } = useT();
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
              <AgentSection title={t('contacts.online')} icon={Circle} agents={activeAgents} variant="online" />
            )}

            {offlineAgents.length > 0 && (
              <AgentSection title={t('contacts.offline')} icon={Circle} agents={offlineAgents} variant="offline" />
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
    </div>
  );
}

function AgentSection({
  title, icon: Icon, agents, variant,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  agents: gw.Agent[];
  variant: 'online' | 'offline' | 'warning';
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
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: gw.Agent }) {
  const { t } = useT();
  const statusColor = agent.online ? 'bg-green-500' : 'bg-muted-foreground';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(agent.display_name || agent.name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editing]);

  const mutation = useMutation({
    mutationFn: (fields: { display_name?: string; avatar_url?: string }) =>
      gw.updateAgentProfile(agent.name, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setEditing(false);
    },
  });

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      // Upload avatar file if changed
      if (avatarFile) {
        await gw.uploadAgentAvatar(agent.name, avatarFile);
      }
      // Update display name if changed
      const fields: { display_name?: string } = {};
      if (editName !== (agent.display_name || agent.name)) fields.display_name = editName;
      if (Object.keys(fields).length > 0) {
        await gw.updateAgentProfile(agent.name, fields);
      }
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setEditName(agent.display_name || agent.name);
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative group">
          {agent.avatar_url && !editing ? (
            <img
              src={agent.avatar_url}
              alt={agent.display_name || agent.name}
              className="w-9 h-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-sidebar-primary" />
            </div>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit"
            >
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            /* Edit mode */
            <div className="space-y-1.5">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</label>
                <input
                  ref={nameInputRef}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-sm font-medium bg-muted border border-border rounded px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-sidebar-primary"
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Avatar</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-muted border border-border border-dashed text-xs text-muted-foreground hover:bg-accent/30 transition-colors"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>{avatarFile ? avatarFile.name : 'Choose image...'}</span>
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleSave}
                  disabled={uploading}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-sidebar-primary text-white hover:opacity-90"
                >
                  <Check className="h-3 w-3" />
                  {uploading ? '...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:bg-accent/50"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  {agent.display_name || agent.name}
                </span>
                <span className={cn('w-2 h-2 rounded-full shrink-0', statusColor)} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{agent.name}</p>
              {agent.type && (
                <p className="text-xs text-muted-foreground mt-1">{agent.type}</p>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(ts: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('time.daysAgo', { n: days });
}
