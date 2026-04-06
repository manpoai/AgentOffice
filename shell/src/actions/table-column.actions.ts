import { ArrowUp, ArrowDown, EyeOff, Trash2, Pencil, Copy, ArrowLeftFromLine, ArrowRightFromLine, Snowflake, Group } from 'lucide-react';
import type { ActionDef } from './types';

export interface TableColumnCtx {
  colKey: string;
  grouped?: boolean;
  freezeEnabled?: boolean;
  sortColumn: (colKey: string, dir: 'asc' | 'desc') => void;
  hideColumn: (colKey: string) => void;
  deleteColumn: (colKey: string) => void;
  editField: (colKey: string) => void;
  duplicateField: (colKey: string) => void;
  insertLeft: (colKey: string) => void;
  insertRight: (colKey: string) => void;
  freezeUpTo: (colKey: string) => void;
  unfreezeAll: () => void;
  toggleGroupBy: (colKey: string) => void;
}

export const tableColumnActions: ActionDef<TableColumnCtx>[] = [
  {
    id: 'table-edit-field',
    label: t => t('actions.editField'),
    icon: Pencil,
    group: 'field',
    execute: ctx => ctx.editField(ctx.colKey),
  },
  {
    id: 'table-duplicate-field',
    label: t => t('actions.duplicateField'),
    icon: Copy,
    group: 'field',
    execute: ctx => ctx.duplicateField(ctx.colKey),
  },
  {
    id: 'table-insert-column-left',
    label: t => t('actions.insertColumnLeft'),
    icon: ArrowLeftFromLine,
    group: 'insert',
    execute: ctx => ctx.insertLeft(ctx.colKey),
  },
  {
    id: 'table-insert-column-right',
    label: t => t('actions.insertColumnRight'),
    icon: ArrowRightFromLine,
    group: 'insert',
    execute: ctx => ctx.insertRight(ctx.colKey),
  },
  {
    id: 'table-freeze-up-to',
    label: t => t('actions.freezeUpTo'),
    icon: Snowflake,
    group: 'view',
    execute: ctx => ctx.freezeUpTo(ctx.colKey),
  },
  {
    id: 'table-unfreeze-all',
    label: t => t('actions.unfreezeAll'),
    icon: Snowflake,
    group: 'view',
    execute: ctx => ctx.unfreezeAll(),
  },
  {
    id: 'table-toggle-group-by',
    label: (t, ctx) => ctx?.grouped ? t('actions.removeGroupBy') : t('actions.groupBy'),
    icon: Group,
    group: 'view',
    execute: ctx => ctx.toggleGroupBy(ctx.colKey),
  },
  {
    id: 'table-sort-asc',
    label: t => t('actions.sortAscending'),
    icon: ArrowUp,
    group: 'sort',
    execute: ctx => ctx.sortColumn(ctx.colKey, 'asc'),
  },
  {
    id: 'table-sort-desc',
    label: t => t('actions.sortDescending'),
    icon: ArrowDown,
    group: 'sort',
    execute: ctx => ctx.sortColumn(ctx.colKey, 'desc'),
  },
  {
    id: 'table-hide-column',
    label: t => t('actions.hideColumn'),
    icon: EyeOff,
    group: 'column',
    execute: ctx => ctx.hideColumn(ctx.colKey),
  },
  {
    id: 'table-delete-column',
    label: t => t('actions.deleteColumn'),
    icon: Trash2,
    danger: true,
    group: 'danger',
    execute: ctx => ctx.deleteColumn(ctx.colKey),
  },
];
