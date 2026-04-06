import type { SurfaceConfig } from './types';

export const tableSurfaces = {
  /** Cell right-click */
  cellMenu: [
    'table-open-record',
    'table-row-comments',
    '---',
    'table-delete-record',
  ] as SurfaceConfig,

  /** Column header right-click / more menu */
  headerMenu: [
    'table-edit-field',
    'table-duplicate-field',
    '---',
    'table-insert-column-left',
    'table-insert-column-right',
    '---',
    'table-freeze-up-to',
    'table-unfreeze-all',
    'table-toggle-group-by',
    '---',
    'table-sort-asc',
    'table-sort-desc',
    '---',
    'table-hide-column',
    '---',
    'table-delete-column',
  ] as SurfaceConfig,
};
