'use client';
import { useEffect } from 'react';
import { CommandPalette } from './CommandPalette';
import { ShortcutHelpPanel } from './shared/ShortcutHelpPanel';
import { ContextMenuProvider } from './shared/ContextMenuProvider';
import { AgentTerminalPanel } from './AgentTerminalPanel';
import { registerGlobalShortcuts } from '@/lib/keyboard';

export function AppShell({ children }: { children: React.ReactNode }) {
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

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

        {isElectron && (
          <AgentTerminalPanel />
        )}
      </div>

      <CommandPalette />
      <ShortcutHelpPanel />
      <ContextMenuProvider />
    </div>
  );
}
