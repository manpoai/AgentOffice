# Sidebar Terminal + Top Bar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the terminal from the bottom panel into the sidebar, add top navigation bar with files/tasks/skills/memory/notifications tabs, support light/dark terminal themes.

**Architecture:** Sidebar restructured: top nav icons → profile → search → document tree → [drag handle] → terminal → agent bar. Bottom AgentTerminalPanel removed. New components for top nav, agent bar, sidebar terminal, and empty tab placeholders. Web/Electron share layout; terminal features Electron-only.

**Tech Stack:** Next.js, xterm.js, next-themes, Tailwind CSS, Electron IPC

---

### Task 1: Update sidebar width default to 280px

**Files:**
- Modify: `shell/src/app/(workspace)/content/page.tsx:116`
- Modify: `shell/src/components/ContentSidebar.tsx:217`

- [ ] **Step 1: Change DEFAULT_SIDEBAR_WIDTH**

In `shell/src/app/(workspace)/content/page.tsx`, change line 116:

```typescript
const DEFAULT_SIDEBAR_WIDTH = 280;
```

- [ ] **Step 2: Change double-click reset width**

In `shell/src/components/ContentSidebar.tsx`, change the `handleDoubleClick` function (line 217):

```typescript
const handleDoubleClick = () => {
  onWidthChange(280);
};
```

- [ ] **Step 3: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add shell/src/app/\(workspace\)/content/page.tsx shell/src/components/ContentSidebar.tsx
git commit -m "feat: update sidebar default width to 280px"
```

---

### Task 2: Create SidebarTopNav component

**Files:**
- Create: `shell/src/components/SidebarTopNav.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { FileText, ClipboardCheck, Users, MessageSquare, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import * as gw from '@/lib/api/gateway';

export type SidebarTab = 'files' | 'tasks' | 'skills' | 'memory';

interface SidebarTopNavProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onNotificationsClick: () => void;
  onSettingsClick: () => void;
  unreadCount: number;
}

const TABS: { id: SidebarTab; icon: typeof FileText }[] = [
  { id: 'files', icon: FileText },
  { id: 'tasks', icon: ClipboardCheck },
  { id: 'skills', icon: Users },
  { id: 'memory', icon: MessageSquare },
];

export function SidebarTopNav({ activeTab, onTabChange, onNotificationsClick, onSettingsClick, unreadCount }: SidebarTopNavProps) {
  return (
    <div className="flex items-center justify-center gap-1 px-2 pt-10 pb-1 shrink-0">
      {TABS.map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'p-2 rounded-lg transition-colors',
            activeTab === id
              ? 'bg-sidebar-primary/10 text-sidebar-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          )}
          title={id.charAt(0).toUpperCase() + id.slice(1)}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
      <button
        onClick={onNotificationsClick}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors relative"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[9px] font-medium flex items-center justify-center px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={onSettingsClick}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add shell/src/components/SidebarTopNav.tsx
git commit -m "feat: add SidebarTopNav component with 5 icon tabs"
```

---

### Task 3: Create EmptyTabPage placeholder component

**Files:**
- Create: `shell/src/components/EmptyTabPage.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ClipboardCheck, Users, MessageSquare } from 'lucide-react';
import type { SidebarTab } from './SidebarTopNav';

const TAB_META: Record<Exclude<SidebarTab, 'files'>, { icon: typeof ClipboardCheck; label: string }> = {
  tasks: { icon: ClipboardCheck, label: 'Tasks' },
  skills: { icon: Users, label: 'Skills' },
  memory: { icon: MessageSquare, label: 'Memory' },
};

export function EmptyTabPage({ tab }: { tab: Exclude<SidebarTab, 'files'> }) {
  const { icon: Icon, label } = TAB_META[tab];
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-4">
      <Icon className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm font-medium opacity-50">{label}</p>
      <p className="text-xs opacity-30 mt-1">Coming soon</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add shell/src/components/EmptyTabPage.tsx
git commit -m "feat: add EmptyTabPage placeholder for tasks/skills/memory"
```

---

### Task 4: Create SidebarAgentBar component

**Files:**
- Create: `shell/src/components/SidebarAgentBar.tsx`

This component renders agent avatars at the bottom of the sidebar with an `@ Agents` button that absorbs overflow count.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { AtSign, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { resolveAvatarUrl } from '@/lib/api/gateway';

interface Agent {
  id: number;
  name: string;
  display_name?: string;
  avatar_url?: string;
  platform: string;
  status: string;
}

interface SidebarAgentBarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentName: string) => void;
  onDeselectAgent: () => void;
  onOpenAgentsPanel: () => void;
  isElectron: boolean;
}

export function SidebarAgentBar({
  agents,
  selectedAgentId,
  onSelectAgent,
  onDeselectAgent,
  onOpenAgentsPanel,
  isElectron,
}: SidebarAgentBarProps) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(agents.length);

  useEffect(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const avatarSize = 36; // 32px avatar + 4px gap
    const agentsButtonWidth = 100;
    const available = containerWidth - agentsButtonWidth;
    const count = Math.max(0, Math.floor(available / avatarSize));
    setVisibleCount(count);
  }, [agents.length]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const avatarSize = 36;
      const agentsButtonWidth = 100;
      const available = containerWidth - agentsButtonWidth;
      setVisibleCount(Math.max(0, Math.floor(available / avatarSize)));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const visibleAgents = agents.slice(0, visibleCount);
  const overflowCount = Math.max(0, agents.length - visibleCount);

  return (
    <div ref={containerRef} className="flex items-center gap-1 px-2 py-2 shrink-0 border-t border-border">
      {visibleAgents.map((agent) => {
        const isSelected = selectedAgentId === agent.name;
        return (
          <button
            key={agent.name}
            onClick={() => {
              if (!isElectron) return;
              if (isSelected) {
                onDeselectAgent();
              } else {
                onSelectAgent(agent.name);
              }
            }}
            className={cn(
              'w-8 h-8 rounded-full overflow-hidden shrink-0 border-2 transition-colors',
              isSelected ? 'border-sidebar-primary' : 'border-transparent hover:border-sidebar-primary/30',
              !isElectron && 'cursor-default'
            )}
            title={agent.display_name || agent.name}
          >
            {resolveAvatarUrl(agent.avatar_url) ? (
              <img src={resolveAvatarUrl(agent.avatar_url)!} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                {(agent.display_name || agent.name).charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        );
      })}

      <button
        onClick={onOpenAgentsPanel}
        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors"
        style={{
          backgroundColor: 'hsl(var(--sidebar-primary))',
          color: 'hsl(var(--sidebar-primary-foreground))',
        }}
      >
        <AtSign className="h-3.5 w-3.5" />
        {t('toolbar.agents')}
        {overflowCount > 0 && (
          <span className="ml-0.5">({overflowCount})</span>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add shell/src/components/SidebarAgentBar.tsx
git commit -m "feat: add SidebarAgentBar with avatar overflow + Agents button"
```

---

### Task 5: Create SidebarTerminal component

**Files:**
- Create: `shell/src/components/SidebarTerminal.tsx`

This component wraps the terminal area in the sidebar: drag handle for vertical resize + AgentTerminalTab instances for each agent.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentTerminalTab, ensureGlobalListener, resetGlobalListener } from './AgentTerminalTab';

interface AgentTerminal {
  agentId: string;
  agentName: string;
  platform: string;
  status: 'running' | 'exited' | 'connecting';
}

interface SidebarTerminalProps {
  agents: AgentTerminal[];
  selectedAgentId: string | null;
  terminalHeight: number;
  onTerminalHeightChange: (h: number) => void;
  onAgentExit: (agentId: string) => void;
}

export function SidebarTerminal({
  agents,
  selectedAgentId,
  terminalHeight,
  onTerminalHeightChange,
  onAgentExit,
}: SidebarTerminalProps) {
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    ensureGlobalListener();

    api.onTerminalExit((agentId: string) => {
      onAgentExit(agentId);
    });

    return () => {
      api.removeTerminalListeners();
      resetGlobalListener();
    };
  }, [onAgentExit]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: terminalHeight };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - ev.clientY;
      const newHeight = Math.min(Math.max(resizeRef.current.startHeight + delta, 120), window.innerHeight * 0.5);
      onTerminalHeightChange(newHeight);
    };

    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight, onTerminalHeightChange]);

  if (!selectedAgentId) return null;

  return (
    <div className="flex flex-col shrink-0" style={{ height: terminalHeight }}>
      <div
        className="h-1 cursor-row-resize hover:bg-sidebar-primary/30 transition-colors shrink-0"
        onMouseDown={onResizeMouseDown}
      />
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
        {agents.map(agent => (
          <AgentTerminalTab
            key={agent.agentId}
            agentId={agent.agentId}
            isActive={selectedAgentId === agent.agentId}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add shell/src/components/SidebarTerminal.tsx
git commit -m "feat: add SidebarTerminal with vertical resize and multi-agent support"
```

---

### Task 6: Add light/dark theme support to AgentTerminalTab

**Files:**
- Modify: `shell/src/components/AgentTerminalTab.tsx`

- [ ] **Step 1: Add theme prop and theme presets**

At the top of `AgentTerminalTab.tsx`, add theme presets after the imports:

```typescript
const TERMINAL_THEMES = {
  light: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    cursor: '#333333',
    selectionBackground: '#d0d0d0',
    selectionForeground: '#1a1a1a',
  },
  dark: {
    background: '#1a1a2e',
    foreground: '#e0e0e0',
    cursor: '#ffffff',
    selectionBackground: '#3a3a5e',
  },
};
```

- [ ] **Step 2: Add colorTheme prop to component interface and usage**

Update the interface:

```typescript
interface AgentTerminalTabProps {
  agentId: string;
  isActive: boolean;
  welcomeMessage?: string;
  colorTheme?: 'light' | 'dark';
}
```

Update the function signature:

```typescript
export function AgentTerminalTab({ agentId, isActive, welcomeMessage, colorTheme = 'dark' }: AgentTerminalTabProps) {
```

- [ ] **Step 3: Use theme preset in Terminal constructor**

Replace the hardcoded theme object in `new Terminal({...})`:

```typescript
const terminal = new Terminal({
  fontSize: 13,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  cursorBlink: true,
  theme: TERMINAL_THEMES[colorTheme],
});
```

- [ ] **Step 4: Add effect to update theme dynamically when colorTheme changes**

Add a new useEffect after the existing ones:

```typescript
useEffect(() => {
  if (terminalRef.current) {
    terminalRef.current.options.theme = TERMINAL_THEMES[colorTheme];
  }
}, [colorTheme]);
```

- [ ] **Step 5: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add shell/src/components/AgentTerminalTab.tsx
git commit -m "feat: add light/dark theme support to AgentTerminalTab"
```

---

### Task 7: Integrate everything into ContentSidebar

**Files:**
- Modify: `shell/src/components/ContentSidebar.tsx`

This is the main integration task. The sidebar's vertical layout changes to:
1. Top nav icons (SidebarTopNav) — includes settings button that opens profile dropdown
2. Search bar
3. Tab content: Files = document tree | others = EmptyTabPage
4. Terminal area (SidebarTerminal, Electron only)
5. Agent bar (SidebarAgentBar)

The profile row (avatar + username) is removed from the sidebar surface — its dropdown is now accessed via the settings gear icon in the top nav.

- [ ] **Step 1: Add imports**

Add at the top of ContentSidebar.tsx:

```typescript
import { SidebarTopNav, type SidebarTab } from './SidebarTopNav';
import { EmptyTabPage } from './EmptyTabPage';
import { SidebarAgentBar } from './SidebarAgentBar';
import { SidebarTerminal } from './SidebarTerminal';
import { useTheme } from 'next-themes';
```

Note: `useTheme` is already imported. Only add the new component imports.

- [ ] **Step 2: Add state variables**

Inside the component function, add:

```typescript
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;
const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('aose-sidebar-tab') as SidebarTab) || 'files';
  }
  return 'files';
});
const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('aose-sidebar-selected-agent');
  }
  return null;
});
const [terminalHeight, setTerminalHeight] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('aose-sidebar-terminal-height');
    return saved ? parseInt(saved, 10) : 200;
  }
  return 200;
});
const [terminalAgents, setTerminalAgents] = useState<Array<{
  agentId: string; agentName: string; platform: string; status: 'running' | 'exited' | 'connecting';
}>>([]);
```

- [ ] **Step 3: Add persistence effects**

```typescript
useEffect(() => {
  localStorage.setItem('aose-sidebar-tab', activeSidebarTab);
}, [activeSidebarTab]);

useEffect(() => {
  if (selectedAgentId) {
    localStorage.setItem('aose-sidebar-selected-agent', selectedAgentId);
  } else {
    localStorage.removeItem('aose-sidebar-selected-agent');
  }
}, [selectedAgentId]);

useEffect(() => {
  localStorage.setItem('aose-sidebar-terminal-height', String(terminalHeight));
}, [terminalHeight]);
```

- [ ] **Step 4: Load terminal agents on mount (Electron only)**

```typescript
useEffect(() => {
  const api = (window as any).electronAPI;
  if (!api) return;
  api.listLocalAgents().then((agents: any[]) => {
    if (agents.length > 0) {
      setTerminalAgents(agents.map(a => ({
        agentId: a.agentName,
        agentName: a.agentName,
        platform: a.platform,
        status: 'running' as const,
      })));
    }
  });
}, []);
```

- [ ] **Step 5: Restructure the expanded sidebar JSX**

Replace the current sidebar content (between the `!collapsed ?` branch opening and `</div>` before ScrollArea) with the new layout order. The key structural change is:

1. Remove the agents/message button section (lines 543-609 in current file)
2. Add `SidebarTopNav` at the top (after profile row, before search)
3. Wrap document tree in conditional: only show when `activeSidebarTab === 'files'`
4. Show `EmptyTabPage` for other tabs
5. Add `SidebarTerminal` before `SidebarAgentBar`
6. Add `SidebarAgentBar` at the bottom, replacing the logo area
7. Move the notification dropdown trigger to SidebarTopNav's bell icon

The expanded sidebar content order becomes:

```
SidebarTopNav (top nav icons + bell + settings gear)
Search bar (existing)
--- if activeSidebarTab === 'files' ---
  ScrollArea with document tree (existing children)
--- else ---
  EmptyTabPage
--- endif ---
SidebarTerminal (Electron only, if selectedAgentId)
SidebarAgentBar (bottom)
```

Remove:
- The profile row (lines 279-474) — dropdown now triggered by settings icon in SidebarTopNav
- The agents/message button section (lines 543-609) — replaced by SidebarAgentBar
- The bottom logo section (lines 748-785) — replaced by SidebarAgentBar

Keep the profile dropdown JSX but change its trigger: instead of the avatar button, it opens from `onSettingsClick` callback passed to SidebarTopNav.

- [ ] **Step 6: Pass colorTheme to SidebarTerminal → AgentTerminalTab**

In SidebarTerminal, pass the theme down. Update SidebarTerminal to accept and forward `colorTheme` prop. In ContentSidebar, get theme from `useTheme()`:

```typescript
const { theme: currentTheme } = useTheme();
const terminalColorTheme = currentTheme === 'dark' ? 'dark' : 'light';
```

Pass to SidebarTerminal which passes to AgentTerminalTab.

- [ ] **Step 7: Wire up agent selection handlers**

```typescript
const handleSelectAgent = useCallback((agentName: string) => {
  setSelectedAgentId(agentName);
  const existing = terminalAgents.find(a => a.agentId === agentName);
  if (!existing) {
    setTerminalAgents(prev => [...prev, {
      agentId: agentName,
      agentName: agentName,
      platform: 'unknown',
      status: 'running' as const,
    }]);
  }
  setTimeout(() => window.dispatchEvent(new Event('terminal:refit')), 100);
}, [terminalAgents]);

const handleDeselectAgent = useCallback(() => {
  setSelectedAgentId(null);
}, []);

const handleAgentExit = useCallback((agentId: string) => {
  setTerminalAgents(prev => prev.map(a =>
    a.agentId === agentId ? { ...a, status: 'exited' as const } : a
  ));
}, []);
```

- [ ] **Step 8: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add shell/src/components/ContentSidebar.tsx
git commit -m "feat: integrate top nav, terminal, and agent bar into sidebar"
```

---

### Task 8: Remove AgentTerminalPanel from AppShell

**Files:**
- Modify: `shell/src/components/AppShell.tsx`

- [ ] **Step 1: Remove AgentTerminalPanel import and usage**

In `AppShell.tsx`:
- Remove the import: `import { AgentTerminalPanel } from './AgentTerminalPanel';`
- Remove the conditional rendering block:
  ```tsx
  {isElectron && (
    <AgentTerminalPanel />
  )}
  ```
- Remove the `isElectron` constant if no longer needed (check if anything else uses it)

The simplified AppShell becomes:

```tsx
'use client';
import { useEffect } from 'react';
import { CommandPalette } from './CommandPalette';
import { ShortcutHelpPanel } from './shared/ShortcutHelpPanel';
import { ContextMenuProvider } from './shared/ContextMenuProvider';
import { registerGlobalShortcuts } from '@/lib/keyboard';

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unregister = registerGlobalShortcuts();
    return unregister;
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col md:flex-row bg-background text-foreground">
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <main className="flex-1 overflow-hidden min-h-0">
          {children}
        </main>
      </div>

      <CommandPalette />
      <ShortcutHelpPanel />
      <ContextMenuProvider />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add shell/src/components/AppShell.tsx
git commit -m "feat: remove AgentTerminalPanel from AppShell (moved to sidebar)"
```

---

### Task 9: Expose addTab for ConnectAgentsOverlay compatibility

**Files:**
- Modify: `shell/src/components/ContentSidebar.tsx`

The `ConnectAgentsOverlay` and the provisioning flow currently use `(window as any).__aoseTerminalPanel.addTab()` to create terminal tabs. This needs to work with the new sidebar terminal.

- [ ] **Step 1: Expose addTab on window**

In ContentSidebar, add an effect that exposes the agent add function:

```typescript
useEffect(() => {
  (window as any).__aoseTerminalPanel = {
    addTab: (agent: { agentId: string; agentName: string; platform: string; welcomeMessage?: string }) => {
      setTerminalAgents(prev => {
        if (prev.find(a => a.agentId === agent.agentId)) return prev;
        return [...prev, { ...agent, status: 'running' as const }];
      });
      setSelectedAgentId(agent.agentId);
      setTimeout(() => window.dispatchEvent(new Event('terminal:refit')), 100);
    },
  };
  return () => { delete (window as any).__aoseTerminalPanel; };
}, []);
```

- [ ] **Step 2: Verify build**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add shell/src/components/ContentSidebar.tsx
git commit -m "feat: expose terminal addTab for ConnectAgentsOverlay compatibility"
```

---

### Task 10: Handle collapsed sidebar state

**Files:**
- Modify: `shell/src/components/ContentSidebar.tsx`

- [ ] **Step 1: Update collapsed sidebar icons**

In the collapsed sidebar section (the `else` branch of `!collapsed ?`), keep the existing collapsed icons (plus, search, agents, message) but also add the top nav icons in collapsed form. The collapsed sidebar should show:
- Plus (create)
- Search
- Top nav tab icons (files, tasks, skills, memory — small)
- Agents (@)
- Notifications (bell)

This is the existing collapsed mode but with the tab icons included. The tab icons toggle `activeSidebarTab` so when the user expands the sidebar it shows the right tab.

- [ ] **Step 2: Verify build and test in browser**

Run: `cd shell && npx next build 2>&1 | tail -5`
Expected: Build succeeds

Start dev server and test:
- Sidebar expanded: top nav → profile → search → tree/empty → terminal → agent bar
- Sidebar collapsed: icon column, clicking tab icon then expanding shows correct tab
- Click agent avatar: terminal expands, drag handle works
- Click same avatar again: terminal collapses
- Light/dark theme toggle: terminal theme changes
- Web mode (no electronAPI): no terminal, avatars non-interactive

- [ ] **Step 3: Commit**

```bash
git add shell/src/components/ContentSidebar.tsx
git commit -m "feat: handle collapsed sidebar with top nav tab icons"
```

---

### Task 11: Build static export and verify

**Files:**
- No new files

- [ ] **Step 1: Build static export for Electron**

```bash
cd shell
BUILD_MODE=app npx next build 2>&1 | tail -10
```

Expected: Build succeeds with static export

- [ ] **Step 2: Verify the built output**

```bash
ls shell-dist/index.html
```

Expected: File exists

- [ ] **Step 3: Commit any build-related fixes**

If any fixes were needed during the build, commit them.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: sidebar terminal + top bar redesign complete"
```
