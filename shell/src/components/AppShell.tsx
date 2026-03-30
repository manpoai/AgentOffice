'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommandPalette } from './CommandPalette';
import { ShortcutHelpPanel } from './shared/ShortcutHelpPanel';
import { ContextMenuProvider } from './shared/ContextMenuProvider';
import { registerGlobalShortcuts } from '@/lib/keyboard';

const NAV_ITEMS = [
  { id: 'content', path: '/content', label: 'Docs', Icon: FileText },
  { id: 'contacts', path: '/contacts', label: 'Contacts', Icon: Users },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Register global keyboard shortcuts once
  useEffect(() => {
    const unregister = registerGlobalShortcuts();
    return unregister;
  }, []);

  const activeModule = NAV_ITEMS.find(n => pathname.startsWith(n.path))?.id ?? 'content';

  return (
    <div className="flex h-screen w-screen flex-col md:flex-row bg-background text-foreground">
      {/* Desktop: no sidebar — the content page provides its own unified sidebar */}

      {/* Main content area — fills remaining space */}
      <main className="flex-1 overflow-hidden min-h-0">
        {children}
      </main>

      {/* Global command palette (Cmd+K) */}
      <CommandPalette />

      {/* Keyboard shortcut help panel */}
      <ShortcutHelpPanel />

      {/* Global context menu (right-click / long-press) */}
      <ContextMenuProvider />

      {/* Mobile bottom tab bar — visible only on mobile */}
      <nav className="flex md:hidden items-center justify-around border-t border-border px-1 shrink-0 bg-sidebar"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.map(item => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 px-3 min-w-[64px] transition-colors',
                isActive
                  ? 'text-sidebar-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.Icon className={cn('h-5 w-5', isActive ? 'opacity-80' : 'opacity-50')} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
