'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import * as gw from '@/lib/api/gateway';
import { resolveAvatarUrl } from '@/lib/api/gateway';

interface MemorySidebarPanelProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

export function MemorySidebarPanel({ selectedAgentId, onSelectAgent }: MemorySidebarPanelProps) {
  const { data: agentsSummary, isLoading } = useQuery({
    queryKey: ['memory-agents-summary'],
    queryFn: gw.getMemoryAgentsSummary,
  });

  const agents = agentsSummary?.agents || [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 shrink-0">
        <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">Agents</span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-1">
          {isLoading ? (
            <div className="text-xs text-foreground/40 text-center py-4">Loading...</div>
          ) : agents.length === 0 ? (
            <div className="text-xs text-foreground/40 text-center py-4">No agents with memories</div>
          ) : (
            agents.map(a => (
              <button
                key={a.agent_id}
                onClick={() => onSelectAgent(a.agent_id)}
                className={cn(
                  'w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors mb-0.5',
                  selectedAgentId === a.agent_id
                    ? 'bg-sidebar-primary/10 text-sidebar-primary'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                )}
              >
                <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0 border border-black/10">
                  {a.avatar_url ? (
                    <img src={resolveAvatarUrl(a.avatar_url) || ''} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {(a.display_name || a.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{a.display_name || a.username}</div>
                  <div className="text-[10px] text-foreground/40">{a.memory_count} memories</div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
