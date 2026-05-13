'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const SOURCE_GROUPS = [
  { value: '', label: 'All' },
  { value: 'builtin', label: 'System' },
  { value: 'user', label: 'Custom' },
] as const;

export function SkillsSidebarPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSource = searchParams.get('source') || '';

  const handleSelect = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('id');
    if (value) {
      params.set('source', value);
    } else {
      params.delete('source');
    }
    const qs = params.toString();
    router.push(qs ? `/skills?${qs}` : '/skills');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 shrink-0">
        <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">Filter</span>
      </div>
      <div className="px-2 py-1">
        {SOURCE_GROUPS.map(g => (
          <button
            key={g.value}
            onClick={() => handleSelect(g.value)}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-md transition-colors mb-0.5',
              activeSource === g.value
                ? 'bg-sidebar-primary/10 text-sidebar-primary'
                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground/70'
            )}
          >
            <span className="text-sm font-medium">{g.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
