'use client';

import { useState, useCallback } from 'react';
import { ContentSidebar } from '@/components/ContentSidebar';
import type { SidebarTab } from '@/components/SidebarTopNav';

const SIDEBAR_WIDTH_KEY = 'aose-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;

function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, value));
}

interface WorkspacePageWrapperProps {
  routeTab: SidebarTab;
  routeSelectedTaskId?: string | null;
  routeSelectedSkillId?: string | null;
  routeSelectedMemoryAgentId?: string | null;
  children: React.ReactNode;
}

export function WorkspacePageWrapper({
  routeTab,
  routeSelectedTaskId,
  routeSelectedSkillId,
  routeSelectedMemoryAgentId,
  children,
}: WorkspacePageWrapperProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aose-sidebar-collapsed') === 'true';
    }
    return false;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (saved) return clampSidebarWidth(parseInt(saved, 10));
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [docListVisible, setDocListVisible] = useState(true);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('aose-sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    const next = clampSidebarWidth(width);
    setSidebarWidth(next);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
  }, []);

  return (
    <div className="flex h-full overflow-hidden flex-col md:flex-row relative bg-sidebar">
      <ContentSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        width={sidebarWidth}
        onWidthChange={handleSidebarWidthChange}
        visible={docListVisible}
        onToggleTrash={() => {}}
        onOpenChangePassword={() => {}}
        showNewMenu={false}
        onShowNewMenuChange={() => {}}
        creating={false}
        onCreateByType={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        routeTab={routeTab}
        routeSelectedTaskId={routeSelectedTaskId}
        routeSelectedSkillId={routeSelectedSkillId}
        routeSelectedMemoryAgentId={routeSelectedMemoryAgentId}
      >
        <></>
      </ContentSidebar>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {children}
      </div>
    </div>
  );
}
