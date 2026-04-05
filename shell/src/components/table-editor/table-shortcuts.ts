import type { ShortcutDef } from '@/lib/keyboard/types';
import { getT } from '@/lib/i18n';

/**
 * Table editor context shortcuts.
 * Handlers dispatch custom events that TableEditor listens for.
 */
function dispatch(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName));
}

export function buildTableShortcuts(): ShortcutDef[] {
  const t = getT();
  return [
    {
      id: 'table-enter',
      key: 'Enter',
      handler: () => dispatch('table:edit-cell'),
      label: t('shortcuts.table.editCell'),
      category: 'Table',
      priority: 5,
    },
    {
      id: 'table-escape',
      key: 'Escape',
      handler: () => dispatch('table:exit-edit'),
      label: t('shortcuts.table.exitEdit'),
      category: 'Table',
      priority: 5,
    },
    {
      id: 'table-tab',
      key: 'Tab',
      handler: (e) => { e.preventDefault(); dispatch('table:next-cell'); },
      label: t('shortcuts.table.nextCell'),
      category: 'Table',
      priority: 5,
    },
    {
      id: 'table-shift-tab',
      key: 'Tab',
      modifiers: { shift: true },
      handler: (e) => { e.preventDefault(); dispatch('table:prev-cell'); },
      label: t('shortcuts.table.prevCell'),
      category: 'Table',
      priority: 6,
    },
    {
      id: 'table-delete-row',
      key: 'Delete',
      modifiers: { meta: true },
      handler: () => dispatch('table:delete-row'),
      label: t('shortcuts.table.deleteRow'),
      category: 'Table',
      priority: 5,
    },
  ];
}

export const TABLE_SHORTCUTS: ShortcutDef[] = buildTableShortcuts();
