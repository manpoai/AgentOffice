import { Copy, ClipboardPaste, Plus, Merge, SplitSquareHorizontal, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { ActionDef } from './types';

export interface RichTableCtx {
  rowIndex: number;
  colIndex: number;
  isHeader: boolean;
  copy: () => void;
  paste: () => void;
  addRowBefore: (index?: number) => void;
  addRowAfter: (index?: number) => void;
  addColumnBefore: (index?: number) => void;
  addColumnAfter: (index?: number) => void;
  mergeCells: () => void;
  splitCell: () => void;
  sort: (columnIndex: number, direction: 'asc' | 'desc') => void;
  deleteRow: () => void;
  deleteColumn: () => void;
}

export const richTableActions: ActionDef<RichTableCtx>[] = [
  { id: 'rich-table-copy', label: t => t('actions.copy'), icon: Copy, group: 'clipboard', execute: ctx => ctx.copy() },
  { id: 'rich-table-paste', label: t => t('actions.paste'), icon: ClipboardPaste, group: 'clipboard', execute: ctx => ctx.paste() },
  { id: 'rich-table-insert-row-above', label: t => t('actions.insertAbove'), icon: Plus, group: 'row', execute: ctx => ctx.addRowBefore(ctx.rowIndex) },
  { id: 'rich-table-insert-row-below', label: t => t('actions.insertBelow'), icon: Plus, group: 'row', execute: ctx => ctx.addRowAfter(ctx.rowIndex) },
  { id: 'rich-table-insert-column-left', label: t => t('actions.insertBefore'), icon: Plus, group: 'column', execute: ctx => ctx.addColumnBefore(ctx.colIndex) },
  { id: 'rich-table-insert-column-right', label: t => t('actions.insertAfter'), icon: Plus, group: 'column', execute: ctx => ctx.addColumnAfter(ctx.colIndex) },
  { id: 'rich-table-merge-cells', label: t => t('actions.mergeCells'), icon: Merge, group: 'merge', execute: ctx => ctx.mergeCells() },
  { id: 'rich-table-split-cell', label: t => t('actions.splitCell'), icon: SplitSquareHorizontal, group: 'merge', execute: ctx => ctx.splitCell() },
  { id: 'rich-table-sort-asc', label: t => t('actions.sortAscending'), icon: ArrowUp, group: 'sort', execute: ctx => ctx.sort(ctx.colIndex, 'asc') },
  { id: 'rich-table-sort-desc', label: t => t('actions.sortDescending'), icon: ArrowDown, group: 'sort', execute: ctx => ctx.sort(ctx.colIndex, 'desc') },
  { id: 'rich-table-delete-row', label: t => t('actions.deleteRow'), icon: Trash2, group: 'danger', danger: true, execute: ctx => ctx.deleteRow() },
  { id: 'rich-table-delete-column', label: t => t('actions.deleteColumn'), icon: Trash2, group: 'danger', danger: true, execute: ctx => ctx.deleteColumn() },
];
