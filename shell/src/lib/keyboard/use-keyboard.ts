import { useEffect, useRef } from 'react';
import { KeyboardManager, type ShortcutRegistration } from './KeyboardManager';

/**
 * Register keyboard shortcuts for a context.
 * Shortcuts are unregistered when the component unmounts or deps change.
 */
export function useKeyboardShortcuts(
  context: string,
  shortcuts: ShortcutRegistration[],
  deps: unknown[] = [],
): void {
  const managerRef = useRef<KeyboardManager | null>(null);

  useEffect(() => {
    const manager = KeyboardManager.getInstance();
    managerRef.current = manager;

    const unregisters = shortcuts.map((s) => manager.register(context, s));

    return () => {
      unregisters.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, ...deps]);
}

/**
 * Set the active keyboard context while this component is mounted.
 * Clears the context on unmount.
 */
export function useKeyboardContext(context: string): void {
  useEffect(() => {
    const manager = KeyboardManager.getInstance();
    manager.setContext(context);
    return () => {
      manager.setContext(null);
    };
  }, [context]);
}
