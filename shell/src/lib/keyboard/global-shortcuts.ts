import { KeyboardManager, type ShortcutRegistration } from './KeyboardManager';
import { getT } from '@/lib/i18n';

function dispatch(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName));
}

function buildGlobalShortcuts(): ShortcutRegistration[] {
  const t = getT();
  return [
    {
      id: 'global-cmd-k',
      key: 'k',
      modifiers: { meta: true },
      handler: () => dispatch('open-command-palette'),
      label: t('shortcuts.globalKeys.openSearch'),
      category: 'Global',
      priority: 10,
    },
    {
      id: 'global-cmd-n',
      key: 'n',
      modifiers: { meta: true },
      handler: () => dispatch('create-new-item'),
      label: t('shortcuts.globalKeys.createNew'),
      category: 'Global',
      priority: 10,
    },
    {
      id: 'global-cmd-s',
      key: 's',
      modifiers: { meta: true },
      handler: () => dispatch('save-current'),
      label: t('shortcuts.globalKeys.save'),
      category: 'Global',
      priority: 10,
    },
    {
      id: 'global-cmd-z',
      key: 'z',
      modifiers: { meta: true },
      handler: () => dispatch('undo'),
      label: t('shortcuts.globalKeys.undo'),
      category: 'Global',
      priority: 5,
    },
    {
      id: 'global-cmd-shift-z',
      key: 'z',
      modifiers: { meta: true, shift: true },
      handler: () => dispatch('redo'),
      label: t('shortcuts.globalKeys.redo'),
      category: 'Global',
      priority: 6,
    },
    {
      id: 'global-cmd-backslash',
      key: '\\',
      modifiers: { meta: true },
      handler: () => dispatch('toggle-sidebar'),
      label: t('shortcuts.globalKeys.toggleSidebar'),
      category: 'Global',
      priority: 10,
    },
    {
      id: 'global-help',
      key: '?',
      handler: () => dispatch('toggle-shortcut-help'),
      label: t('shortcuts.globalKeys.showShortcuts'),
      category: 'Global',
      priority: 0,
    },
  ];
}

let registered = false;

/**
 * Register all global shortcuts. Safe to call multiple times — only registers once.
 */
export function registerGlobalShortcuts(): () => void {
  if (registered) return () => {};
  registered = true;

  const manager = KeyboardManager.getInstance();
  const unregister = manager.registerGlobal(buildGlobalShortcuts());

  return () => {
    unregister();
    registered = false;
  };
}
