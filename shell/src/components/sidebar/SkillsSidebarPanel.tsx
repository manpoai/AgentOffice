'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import * as gw from '@/lib/api/gateway';
import { useState } from 'react';

const SOURCE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'builtin', label: 'System' },
  { value: 'user', label: 'Custom' },
] as const;

interface SkillsSidebarPanelProps {
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string) => void;
}

export function SkillsSidebarPanel({ selectedSkillId, onSelectSkill }: SkillsSidebarPanelProps) {
  const [sourceFilter, setSourceFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['skills', sourceFilter],
    queryFn: () => gw.listSkills({
      source: sourceFilter || undefined,
      limit: 100,
    }),
  });

  const skills = data?.skills || [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Source filter chips */}
      <div className="px-2 py-1.5 shrink-0">
        <div className="flex gap-1">
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setSourceFilter(f.value)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                sourceFilter === f.value
                  ? 'bg-sidebar-primary/15 text-sidebar-primary'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-foreground/60 hover:text-foreground/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Skills list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-1">
          {isLoading ? (
            <div className="text-xs text-foreground/40 text-center py-4">Loading...</div>
          ) : skills.length === 0 ? (
            <div className="text-xs text-foreground/40 text-center py-4">No skills</div>
          ) : (
            skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => onSelectSkill(skill.id)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-md transition-colors mb-0.5',
                  selectedSkillId === skill.id
                    ? 'bg-sidebar-primary/10 text-sidebar-primary'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <SourceBadge source={skill.source} />
                  <span className="text-sm truncate flex-1">{skill.title}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn(
      'text-[9px] font-medium px-1 py-px rounded shrink-0',
      source === 'builtin'
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    )}>
      {source === 'builtin' ? 'SYS' : 'USR'}
    </span>
  );
}
