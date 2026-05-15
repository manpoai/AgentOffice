'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import * as gw from '@/lib/api/gateway';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, Plus, Trash2, Link2, Pencil, Check, X } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/time';
import { getPublicOrigin } from '@/lib/remote-access';

interface MemoryDetailPanelProps {
  selectedAgentId: string | null;
  selectedMemoryId: string | null;
  onSelectMemory: (id: string | null) => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}

export function MemoryDetailPanel({ selectedAgentId, selectedMemoryId, onSelectMemory, docListVisible, onToggleDocList }: MemoryDetailPanelProps) {
  if (!selectedAgentId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
        <p className="text-sm">Select an agent from the sidebar</p>
        <p className="text-xs text-foreground/40">to view and manage their memories</p>
      </div>
    );
  }

  if (selectedMemoryId) {
    return (
      <MemoryDetailView
        agentId={selectedAgentId}
        memoryId={selectedMemoryId}
        onBack={() => onSelectMemory(null)}
        docListVisible={docListVisible}
        onToggleDocList={onToggleDocList}
      />
    );
  }

  return (
    <MemoryGridView
      agentId={selectedAgentId}
      onSelectMemory={onSelectMemory}
      docListVisible={docListVisible}
      onToggleDocList={onToggleDocList}
    />
  );
}

function MemoryGridView({ agentId, onSelectMemory, docListVisible, onToggleDocList }: {
  agentId: string;
  onSelectMemory: (id: string) => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (e: React.MouseEvent, memoryId: string) => {
    e.stopPropagation();
    const origin = getPublicOrigin() || window.location.origin;
    const url = new URL('/memory', origin);
    url.searchParams.set('id', agentId);
    url.searchParams.set('mem', memoryId);
    navigator.clipboard.writeText(url.toString());
    setCopiedId(memoryId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['memories', agentId],
    queryFn: () => gw.listMemories({ agent_id: agentId, limit: 200 }),
  });

  const memories = data?.memories || [];

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const res = await gw.createMemory({
        title: newTitle.trim(),
        content: newContent.trim(),
        agent_id: agentId,
      });
      setCreating(false);
      setNewTitle('');
      setNewContent('');
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory-agents-summary'] });
      onSelectMemory(res.memory_id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0">
        {!docListVisible && (
          <button onClick={onToggleDocList} className="mr-2 p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="text-sm font-semibold flex-1">Memory</h2>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {creating ? (
            <div className="rounded-lg border border-sidebar-primary/30 bg-background p-4 mb-4 max-w-2xl mx-auto">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Memory title..."
                className="w-full text-sm font-medium bg-transparent outline-none mb-2"
              />
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Memory content..."
                rows={3}
                className="w-full text-sm bg-transparent outline-none resize-y text-foreground/70 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={saving || !newTitle.trim() || !newContent.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-sidebar-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-foreground/60 rounded-md hover:bg-accent">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <button
              onClick={() => { setCreating(true); setNewTitle(''); setNewContent(''); }}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border/50 hover:border-sidebar-primary/40 text-foreground/40 hover:text-sidebar-primary transition-colors min-h-[140px]"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium">New Memory</span>
            </button>

            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border/50 p-4 min-h-[140px]">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))
            ) : (
              memories.map(memory => (
                <div
                  key={memory.id}
                  onClick={() => onSelectMemory(memory.id)}
                  className="text-left p-4 rounded-lg border border-border/50 bg-background hover:border-border hover:shadow-sm transition-all min-h-[140px] flex flex-col cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <SourceBadge source={memory.source} />
                    <span className="text-sm font-medium truncate flex-1">{memory.title}</span>
                  </div>
                  <p className="text-xs text-foreground/50 line-clamp-5 leading-relaxed flex-1">
                    {memory.content}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-foreground/30">{formatRelativeTime(memory.updated_at)}</span>
                    <button
                      onClick={(e) => handleCopyLink(e, memory.id)}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-foreground/40 hover:text-foreground rounded hover:bg-accent transition-colors"
                    >
                      <Link2 className="h-3 w-3" />
                      {copiedId === memory.id ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function MemoryDetailView({ agentId, memoryId, onBack, docListVisible, onToggleDocList }: {
  agentId: string;
  memoryId: string;
  onBack: () => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: memory } = useQuery({
    queryKey: ['memory', memoryId],
    queryFn: () => gw.getMemory(memoryId),
  });

  const handleStartEdit = useCallback(() => {
    if (!memory) return;
    setEditTitle(memory.title);
    setEditContent(memory.content);
    setEditing(true);
  }, [memory]);

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      await gw.updateMemory(memoryId, { title: editTitle.trim(), content: editContent.trim() });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['memory', memoryId] });
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this memory?')) return;
    await gw.deleteMemory(memoryId);
    queryClient.invalidateQueries({ queryKey: ['memories'] });
    queryClient.invalidateQueries({ queryKey: ['memory-agents-summary'] });
    onBack();
  };

  const handleCopyLink = () => {
    const origin = getPublicOrigin() || window.location.origin;
    const url = new URL('/memory', origin);
    url.searchParams.set('id', agentId);
    url.searchParams.set('mem', memoryId);
    navigator.clipboard.writeText(url.toString());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!memory) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)]">
        <div className="text-sm text-foreground/40">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0">
        {!docListVisible && (
          <button onClick={onToggleDocList} className="mr-2 p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <button onClick={onBack} className="mr-2 p-1 rounded hover:bg-accent text-foreground/60 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <SourceBadge source={memory.source} />
        <span className="text-xs text-foreground/30 mx-1.5">{saving ? 'Saving...' : ''}</span>
        <div className="flex-1" />
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-foreground/60 hover:text-foreground rounded-md hover:bg-accent transition-colors"
        >
          <Link2 className="h-3.5 w-3.5" />
          {linkCopied ? 'Copied!' : 'Copy Link'}
        </button>
        {!editing && (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-foreground/60 hover:text-foreground rounded-md hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-foreground/50 hover:text-red-500 rounded-md hover:bg-accent transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 pt-6 pb-2 max-w-3xl mx-auto w-full">
          {editing ? (
            <>
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="text-2xl font-bold w-full bg-transparent outline-none mb-4"
                placeholder="Memory title..."
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={12}
                className="w-full text-sm bg-transparent outline-none resize-y text-foreground/70 leading-relaxed mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editTitle.trim() || !editContent.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-sidebar-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-foreground/60 rounded-md hover:bg-accent"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">{memory.title}</h1>
              <div className="flex items-center gap-2 mb-6 text-xs text-foreground/40">
                <span>{formatRelativeTime(memory.updated_at)}</span>
                {memory.tags.length > 0 && (
                  <>
                    <span>·</span>
                    {memory.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-px rounded bg-accent text-foreground/60">{tag}</span>
                    ))}
                  </>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/70">{memory.content}</pre>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn(
      'text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0',
      source === 'agent'
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    )}>
      {source === 'agent' ? 'AGENT' : 'HUMAN'}
    </span>
  );
}
