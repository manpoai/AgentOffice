'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import * as gw from '@/lib/api/gateway';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, Plus, ChevronDown, Pencil, Trash2, Check, X } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/time';

interface MemoryDetailPanelProps {
  selectedAgentId: string | null;
  docListVisible: boolean;
  onToggleDocList: () => void;
}

export function MemoryDetailPanel({ selectedAgentId, docListVisible, onToggleDocList }: MemoryDetailPanelProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['memories', selectedAgentId],
    queryFn: () => gw.listMemories({
      agent_id: selectedAgentId || undefined,
      limit: 200,
    }),
    enabled: !!selectedAgentId,
  });

  const memories = data?.memories || [];

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await gw.createMemory({
        title: newTitle.trim(),
        content: newContent.trim(),
        agent_id: selectedAgentId || undefined,
      });
      setCreating(false);
      setNewTitle('');
      setNewContent('');
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory-agents-summary'] });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (memoryId: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      await gw.updateMemory(memoryId, { title: editTitle.trim(), content: editContent.trim() });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memoryId: string) => {
    if (!confirm('Delete this memory?')) return;
    await gw.deleteMemory(memoryId);
    if (expandedId === memoryId) setExpandedId(null);
    queryClient.invalidateQueries({ queryKey: ['memories'] });
    queryClient.invalidateQueries({ queryKey: ['memory-agents-summary'] });
  };

  if (!selectedAgentId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
        <p className="text-sm">Select an agent from the sidebar</p>
        <p className="text-xs text-foreground/40">to view and manage their memories</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0">
        {!docListVisible && (
          <button onClick={onToggleDocList} className="mr-2 p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="text-sm font-semibold flex-1">Memory</h2>
        <button
          onClick={() => { setCreating(true); setNewTitle(''); setNewContent(''); }}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sidebar-primary hover:bg-sidebar-primary/10 rounded-md transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-2 max-w-2xl mx-auto">
          {/* Inline create form */}
          {creating && (
            <div className="rounded-lg border border-sidebar-primary/30 bg-background p-4">
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
          )}

          {isLoading ? (
            <div className="text-xs text-foreground/40 text-center py-8">Loading...</div>
          ) : memories.length === 0 && !creating ? (
            <div className="text-xs text-foreground/40 text-center py-8">No memories for this agent</div>
          ) : (
            memories.map(memory => {
              const isExpanded = expandedId === memory.id;
              const isEditing = editingId === memory.id;

              return (
                <div key={memory.id} className="rounded-lg border border-border/50 bg-background overflow-hidden">
                  {/* Memory row header — always visible */}
                  <button
                    onClick={() => {
                      if (isEditing) return;
                      setExpandedId(isExpanded ? null : memory.id);
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 text-foreground/30 shrink-0 transition-transform', isExpanded && 'rotate-0', !isExpanded && '-rotate-90')} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{memory.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-px rounded',
                          memory.source === 'agent'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        )}>
                          {memory.source === 'agent' ? 'Agent' : 'Human'}
                        </span>
                        <span className="text-[10px] text-foreground/40">{formatRelativeTime(memory.updated_at)}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/30">
                      {isEditing ? (
                        <div className="pt-3">
                          <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="w-full text-sm font-medium bg-transparent outline-none border-b border-border/50 pb-1 mb-2"
                          />
                          <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={5}
                            className="w-full text-sm bg-transparent outline-none resize-y text-foreground/70 mb-3"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(memory.id)}
                              disabled={saving}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-sidebar-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs text-foreground/60 rounded-md hover:bg-accent"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/70 mb-3">{memory.content}</pre>
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingId(memory.id); setEditTitle(memory.title); setEditContent(memory.content); }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-foreground/50 hover:text-foreground rounded-md hover:bg-accent transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(memory.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-foreground/50 hover:text-red-500 rounded-md hover:bg-accent transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
