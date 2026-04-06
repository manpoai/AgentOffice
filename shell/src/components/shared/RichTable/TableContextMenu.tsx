'use client';

import { buildActionMap } from '@/actions/types';
import { richTableActions } from '@/actions/rich-table.actions';
import { toContextMenuItems } from '@/surfaces/bridge';
import { richTableSurfaces } from '@/surfaces/rich-table.surfaces';
import type { RichTableActions, TableContextMenuContext } from './types';
import { useT } from '@/lib/i18n';

export function useTableContextMenu(actions: RichTableActions | null) {
  const { t } = useT();
  if (!actions) return null;

  const actionMap = buildActionMap(richTableActions);

  return (context: TableContextMenuContext) =>
    toContextMenuItems(
      context.type === 'header' ? richTableSurfaces.headerMenu : richTableSurfaces.cellMenu,
      actionMap,
      {
        rowIndex: context.rowIndex,
        colIndex: context.colIndex,
        isHeader: context.type === 'header',
        copy: () => document.execCommand('copy'),
        paste: () => document.execCommand('paste'),
        addRowBefore: actions.addRowBefore,
        addRowAfter: actions.addRowAfter,
        addColumnBefore: actions.addColumnBefore,
        addColumnAfter: actions.addColumnAfter,
        mergeCells: actions.mergeCells,
        splitCell: actions.splitCell,
        sort: actions.sort,
        deleteRow: actions.deleteRow,
        deleteColumn: actions.deleteColumn,
      },
      t,
    ).map(item => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      shortcut: item.shortcut,
      action: item.onClick,
      danger: item.danger,
      separator: item.separator,
    }));
}
