'use client';

import { cn } from '@/lib/utils';

interface TasksSidebarPanelProps {}

export function TasksSidebarPanel({}: TasksSidebarPanelProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 shrink-0">
        <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">Projects</span>
      </div>
      <div className="px-2 py-1">
        <button
          className={cn(
            'w-full text-left px-2 py-1.5 rounded-md transition-colors',
            'bg-sidebar-primary/10 text-sidebar-primary'
          )}
        >
          <span className="text-sm font-medium">All Tasks</span>
        </button>
      </div>
    </div>
  );
}
