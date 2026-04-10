/**
 * Table interaction plugin for ProseMirror.
 *
 * Provides Outline-style table controls:
 * - Left sidebar bar with row controls and row insertion dots
 * - Top bar with column controls and column insertion dots
 * - Column context menu (toggle header, insert, move, merge, delete)
 * - Row context menu (insert, move, delete)
 * - Cell selection toolbar (formatting, headings, merge/unmerge, link)
 * - Single cell focus: only shows bars, no floating toolbar
 */
import { Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { Fragment, type Node as PmNode } from 'prosemirror-model';
import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import {
  addRow,
  addColumn,
  deleteRow,
  deleteColumn,
  CellSelection,
  TableMap,
  mergeCells,
  splitCell,
  toggleHeaderRow,
  toggleHeaderColumn,
  findTable,
} from 'prosemirror-tables';
import { getT } from '@/lib/i18n';
import { PALETTES } from '@/actions/color-palettes';

export const tableMenuKey = new PluginKey('tableMenu');

/** Clamp a dropdown's position so it stays within the viewport */
function clampDropdownPosition(el: HTMLElement, parentRect: DOMRect) {
  // After the element is appended, check if it overflows viewport
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      const newLeft = Math.max(0, (parseFloat(el.style.left) || 0) - (rect.right - window.innerWidth + 8));
      el.style.left = `${newLeft}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      const newTop = Math.max(0, (parseFloat(el.style.top) || 0) - (rect.bottom - window.innerHeight + 8));
      el.style.top = `${newTop}px`;
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────

/** Find the table node and metadata from the current selection */
function findTableInfo(state: EditorState): {
  tableNode: PmNode;
  tablePos: number;
  tableStart: number;
  map: TableMap;
  cursorRow: number;
  cursorCol: number;
} | null {
  const { $from } = state.selection;
  const found = findTable($from);
  if (!found) return null;

  const tableNode = found.node;
  const tablePos = found.pos;
  const tableStart = found.start;
  const map = TableMap.get(tableNode);

  // Find cell position relative to table
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      const cellPos = $from.before(d);
      const cellOffset = cellPos - tableStart;
      const cellIndex = map.map.indexOf(cellOffset);
      if (cellIndex === -1) return { tableNode, tablePos, tableStart, map, cursorRow: 0, cursorCol: 0 };
      const cursorRow = Math.floor(cellIndex / map.width);
      const cursorCol = cellIndex % map.width;
      return { tableNode, tablePos, tableStart, map, cursorRow, cursorCol };
    }
  }
  return null;
}

/** Check if the current selection is a CellSelection */
function isCellSelection(state: EditorState): boolean {
  return state.selection instanceof CellSelection;
}

/** Check if cursor is inside a table */
function isInTableCheck(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return true;
  }
  return false;
}

// ── CSS class prefix ─────────────────────────────────────────────
const P = 'tm'; // table-menu prefix

// ── DOM element creation helpers ─────────────────────────────────

function el(tag: string, cls?: string, attrs?: Record<string, string>): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  e.contentEditable = 'false';
  return e;
}

function btn(text: string, title: string, onClick: (e: MouseEvent) => void, cls?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls || `${P}-menu-item`;
  b.textContent = text;
  b.title = title;
  b.contentEditable = 'false';
  b.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(e);
  });
  return b;
}

// ── Plugin ───────────────────────────────────────────────────────

export interface TableToolbarInfo {
  anchor: { top: number; left: number; width: number };
  view: EditorView;
  isCellSelection: boolean;
  isFullRow: boolean;
  isFullCol: boolean;
}

export function tableMenuPlugin(onCellToolbar?: (info: TableToolbarInfo | null) => void): Plugin {
  let container: HTMLElement | null = null;
  let topBar: HTMLElement | null = null;
  let leftBar: HTMLElement | null = null;
  let contextMenu: HTMLElement | null = null;
  let cellToolbar: HTMLElement | null = null;
  let currentView: EditorView | null = null;
  let isActive = false;

  // Track which column/row menu is open
  let openMenuType: 'col' | 'row' | null = null;
  let openMenuIndex: number = -1;

  function getContainer(view: EditorView): HTMLElement {
    if (!container) {
      container = el('div', `${P}-container`);
      container.contentEditable = 'false';
      // Append to editor mount (parent of .ProseMirror)
      const mount = view.dom.parentElement;
      if (mount) mount.appendChild(container);
    }
    return container;
  }

  /**
   * Detect CSS scale factor applied to any ancestor (e.g. `transform: scale(zoom)`).
   * Compares getBoundingClientRect (screen pixels) to offsetWidth (layout pixels).
   * Returns 1 when no transform is applied.
   */
  function getScale(mount: HTMLElement): number {
    const ow = mount.offsetWidth;
    if (!ow) return 1;
    const bw = mount.getBoundingClientRect().width;
    return bw / ow || 1;
  }

  function destroyAll() {
    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }
    container = null;
    topBar = null;
    leftBar = null;
    contextMenu = null;
    cellToolbar = null;
    isActive = false;
    openMenuType = null;
    openMenuIndex = -1;
    lastBarTablePos = -1;
    lastBarTableSize = -1;
  }

  function hideAll() {
    if (container) container.style.display = 'none';
    isActive = false;
    closeContextMenu();
    closeCellToolbar();
    lastBarTablePos = -1;
    lastBarTableSize = -1;
  }

  function closeContextMenu() {
    if (contextMenu && contextMenu.parentElement) {
      contextMenu.parentElement.removeChild(contextMenu);
    }
    contextMenu = null;
    openMenuType = null;
    openMenuIndex = -1;
    // Also close color picker
    if (colorPicker && colorPicker.parentElement) {
      colorPicker.parentElement.removeChild(colorPicker);
    }
    colorPicker = null;
  }

  function closeCellToolbar() {
    if (onCellToolbar) {
      onCellToolbar(null);
    }
    if (cellToolbar && cellToolbar.parentElement) {
      cellToolbar.parentElement.removeChild(cellToolbar);
    }
    cellToolbar = null;
    // Also close color picker and alignment dropdown if open
    if (colorPicker && colorPicker.parentElement) {
      colorPicker.parentElement.removeChild(colorPicker);
    }
    colorPicker = null;
    if (alignDropdown && alignDropdown.parentElement) {
      alignDropdown.parentElement.removeChild(alignDropdown);
    }
    alignDropdown = null;
  }

  let alignDropdown: HTMLElement | null = null;

  /** Insert row at a specific index using low-level addRow */
  function insertRowAt(view: EditorView, rowIndex: number) {
    const info = findTableInfo(view.state);
    if (!info) return;
    const rect = {
      map: info.map,
      tableStart: info.tableStart,
      table: info.tableNode,
      left: 0, top: 0, right: info.map.width, bottom: info.map.height,
    };
    const tr = addRow(view.state.tr, rect, rowIndex);
    view.dispatch(tr);
  }

  /** Insert column at a specific index using low-level addColumn */
  function insertColAt(view: EditorView, colIndex: number) {
    const info = findTableInfo(view.state);
    if (!info) return;
    const rect = {
      map: info.map,
      tableStart: info.tableStart,
      table: info.tableNode,
      left: 0, top: 0, right: info.map.width, bottom: info.map.height,
    };
    const tr = addColumn(view.state.tr, rect, colIndex);
    view.dispatch(tr);
  }

  /** Select entire row by creating a CellSelection */
  function selectRow(view: EditorView, rowIndex: number) {
    const info = findTableInfo(view.state);
    if (!info) return;
    const { map, tableStart } = info;
    const anchorCellPos = tableStart + map.map[rowIndex * map.width];
    const headCellPos = tableStart + map.map[rowIndex * map.width + (map.width - 1)];
    const $anchor = view.state.doc.resolve(anchorCellPos);
    const $head = view.state.doc.resolve(headCellPos);
    const sel = CellSelection.create(view.state.doc, $anchor.pos, $head.pos);
    view.dispatch(view.state.tr.setSelection(sel));
  }

  /** Select entire column by creating a CellSelection */
  function selectCol(view: EditorView, colIndex: number) {
    const info = findTableInfo(view.state);
    if (!info) return;
    const { map, tableStart } = info;
    const anchorCellPos = tableStart + map.map[colIndex];
    const headCellPos = tableStart + map.map[(map.height - 1) * map.width + colIndex];
    const $anchor = view.state.doc.resolve(anchorCellPos);
    const $head = view.state.doc.resolve(headCellPos);
    const sel = CellSelection.create(view.state.doc, $anchor.pos, $head.pos);
    view.dispatch(view.state.tr.setSelection(sel));
  }

  // ── Top bar (column controls) ──────────────────────────────────

  function buildTopBar(view: EditorView, info: NonNullable<ReturnType<typeof findTableInfo>>, tableDOM: HTMLElement, parentRect: DOMRect) {
    const tableRect = tableDOM.getBoundingClientRect();
    const mount = view.dom.parentElement;
    const s = mount ? getScale(mount) : 1;
    const { map } = info;

    if (!topBar) {
      topBar = el('div', `${P}-top-bar`);
      getContainer(view).appendChild(topBar);
    }
    topBar.innerHTML = '';

    // Position the top bar above the table — use absolute positioning for children
    topBar.style.left = `${(tableRect.left - parentRect.left) / s}px`;
    topBar.style.top = `${(tableRect.top - parentRect.top) / s - 16}px`;
    topBar.style.width = `${tableRect.width / s}px`;
    topBar.style.display = 'block';
    topBar.style.position = 'absolute';
    topBar.style.height = '14px';

    // Get cell left offsets and widths from actual DOM cells in first row
    const firstRowCells = tableDOM.querySelector('tr');
    const cellRects: { left: number; width: number }[] = [];
    if (firstRowCells) {
      const cells = firstRowCells.querySelectorAll('th, td');
      cells.forEach((cell) => {
        const r = (cell as HTMLElement).getBoundingClientRect();
        cellRects.push({ left: (r.left - tableRect.left) / s, width: r.width / s });
      });
    }

    // Fallback if cells don't match map width
    if (cellRects.length === 0) {
      const evenWidth = tableRect.width / s / map.width;
      for (let i = 0; i < map.width; i++) cellRects.push({ left: i * evenWidth, width: evenWidth });
    }

    for (let col = 0; col < cellRects.length; col++) {
      const cr = cellRects[col];

      // Column section — positioned exactly over the cell
      const section = el('div', `${P}-col-section`);
      section.style.position = 'absolute';
      section.style.left = `${cr.left}px`;
      section.style.width = `${cr.width}px`;
      section.style.top = '0';
      section.style.height = '100%';
      section.dataset.col = String(col);
      section.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectCol(view, col);
        // update() will detect CellSelection and show unified toolbar
      });
      topBar.appendChild(section);

      // Insertion dot at the left boundary of each column
      const dot = el('div', `${P}-insert-dot ${P}-insert-dot-col`);
      dot.style.position = 'absolute';
      dot.style.left = `${cr.left - 5}px`;
      dot.style.top = '0';
      dot.dataset.col = String(col);
      dot.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertColAt(view, col);
      });
      topBar.appendChild(dot);
    }

    // Insertion dot at the right edge (after last column)
    if (cellRects.length > 0) {
      const last = cellRects[cellRects.length - 1];
      const dotAfter = el('div', `${P}-insert-dot ${P}-insert-dot-col`);
      dotAfter.style.position = 'absolute';
      dotAfter.style.left = `${last.left + last.width - 5}px`;
      dotAfter.style.top = '0';
      dotAfter.dataset.col = String(cellRects.length);
      dotAfter.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertColAt(view, cellRects.length);
      });
      topBar.appendChild(dotAfter);
    }
  }

  // ── Left bar (row controls) ────────────────────────────────────

  function buildLeftBar(view: EditorView, info: NonNullable<ReturnType<typeof findTableInfo>>, tableDOM: HTMLElement, parentRect: DOMRect) {
    const tableRect = tableDOM.getBoundingClientRect();
    const mount = view.dom.parentElement;
    const s = mount ? getScale(mount) : 1;
    const { map } = info;

    if (!leftBar) {
      leftBar = el('div', `${P}-left-bar`);
      getContainer(view).appendChild(leftBar);
    }
    leftBar.innerHTML = '';

    // Position the left bar to the left of the table — use absolute positioning for children
    leftBar.style.left = `${(tableRect.left - parentRect.left) / s - 16}px`;
    leftBar.style.top = `${(tableRect.top - parentRect.top) / s}px`;
    leftBar.style.height = `${tableRect.height / s}px`;
    leftBar.style.width = '14px';
    leftBar.style.display = 'block';
    leftBar.style.position = 'absolute';

    // Get row top offsets and heights from actual DOM rows
    const rows = tableDOM.querySelectorAll('tr');
    const rowRects: { top: number; height: number }[] = [];
    rows.forEach((row) => {
      const r = row.getBoundingClientRect();
      rowRects.push({ top: (r.top - tableRect.top) / s, height: r.height / s });
    });

    for (let row = 0; row < rowRects.length; row++) {
      const rr = rowRects[row];

      // Row section — positioned exactly beside the row
      const section = el('div', `${P}-row-section`);
      section.style.position = 'absolute';
      section.style.top = `${rr.top}px`;
      section.style.height = `${rr.height}px`;
      section.style.left = '0';
      section.style.width = '100%';
      section.dataset.row = String(row);
      section.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectRow(view, row);
        // update() will detect CellSelection and show unified toolbar
      });
      leftBar.appendChild(section);

      // Insertion dot at the top boundary of each row
      const dot = el('div', `${P}-insert-dot ${P}-insert-dot-row`);
      dot.style.position = 'absolute';
      dot.style.top = `${rr.top - 5}px`;
      dot.style.left = '0';
      dot.dataset.row = String(row);
      dot.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertRowAt(view, row);
      });
      leftBar.appendChild(dot);
    }

    // Insertion dot at the bottom edge (after last row)
    if (rowRects.length > 0) {
      const last = rowRects[rowRects.length - 1];
      const dotAfter = el('div', `${P}-insert-dot ${P}-insert-dot-row`);
      dotAfter.style.position = 'absolute';
      dotAfter.style.top = `${last.top + last.height - 5}px`;
      dotAfter.style.left = '0';
      dotAfter.dataset.row = String(rowRects.length);
      dotAfter.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        insertRowAt(view, rowRects.length);
      });
      leftBar.appendChild(dotAfter);
    }
  }

  // ── Column context menu ────────────────────────────────────────

  /** SVG icon helper */
  function svgIcon(paths: string, size = 16): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  const icons = {
    alignLeft: svgIcon('<line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>'),
    alignCenter: svgIcon('<line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/>'),
    alignRight: svgIcon('<line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>'),
    sortAsc: svgIcon('<path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/>'),
    sortDesc: svgIcon('<path d="M11 5h4"/><path d="M11 9h7"/><path d="M11 13h10"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/>'),
    color: svgIcon('<circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="14.5" r="2.5"/><circle cx="8.5" cy="14.5" r="2.5"/>', 16),
    more: svgIcon('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'),
    insertBefore: svgIcon('<path d="M12 5V19"/><path d="M5 12H19"/>', 14),
    insertAfter: svgIcon('<path d="M12 5V19"/><path d="M5 12H19"/>', 14),
    moveLeft: svgIcon('<path d="M15 18l-6-6 6-6"/>', 14),
    moveRight: svgIcon('<path d="M9 18l6-6-6-6"/>', 14),
    moveUp: svgIcon('<path d="M18 15l-6-6-6 6"/>', 14),
    moveDown: svgIcon('<path d="M6 9l6 6 6-6"/>', 14),
    trash: svgIcon('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', 14),
    header: svgIcon('<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h8"/>', 14),
    merge: svgIcon('<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 2v20"/><path d="M15 2v20"/><path d="M2 12h20"/>', 14),
  };

  /** Create an icon button for the toolbar */
  function iconBtn(iconHtml: string, title: string, onClick: () => void, extraCls?: string): HTMLElement {
    const b = document.createElement('button');
    b.className = `${P}-icon-btn${extraCls ? ' ' + extraCls : ''}`;
    b.innerHTML = iconHtml;
    b.title = title;
    b.contentEditable = 'false';
    b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  /** A separator between icon groups */
  function iconSep(): HTMLElement {
    const s = document.createElement('div');
    s.className = `${P}-icon-sep`;
    return s;
  }

  // ── Cell background color picker ──────────────────────────────

  let colorPicker: HTMLElement | null = null;

  function showCellColorPicker(view: EditorView, anchor: HTMLElement) {
    if (colorPicker && colorPicker.parentElement) {
      colorPicker.parentElement.removeChild(colorPicker);
      colorPicker = null;
      return; // toggle off
    }

    const colors = PALETTES.cellBackground.map(c => ({ label: c.name, css: c.value }));

    colorPicker = el('div', `${P}-color-picker`);
    colorPicker.style.position = 'absolute';
    colorPicker.style.background = 'hsl(var(--card, 0 0% 100%))';
    colorPicker.style.border = '1px solid hsl(var(--border, 0 0% 90%))';
    colorPicker.style.borderRadius = '8px';
    colorPicker.style.padding = '6px';
    colorPicker.style.display = 'grid';
    colorPicker.style.gridTemplateColumns = 'repeat(3, 1fr)';
    colorPicker.style.gap = '4px';
    colorPicker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    colorPicker.style.zIndex = '999';

    for (const color of colors) {
      const swatch = el('div', `${P}-color-swatch`);
      swatch.style.width = '24px';
      swatch.style.height = '24px';
      swatch.style.borderRadius = '4px';
      swatch.style.cursor = 'pointer';
      swatch.style.border = '1px solid rgba(0,0,0,0.1)';
      swatch.style.background = color.css || 'white';
      swatch.title = color.label;
      if (!color.css) {
        // "None" — show a diagonal line
        swatch.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><line x1="2" y1="22" x2="22" y2="2" stroke="red" stroke-width="1.5"/></svg>';
        swatch.style.display = 'flex';
        swatch.style.alignItems = 'center';
        swatch.style.justifyContent = 'center';
      }
      swatch.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyCellBackground(view, color.css);
        if (colorPicker && colorPicker.parentElement) {
          colorPicker.parentElement.removeChild(colorPicker);
          colorPicker = null;
        }
      });
      colorPicker.appendChild(swatch);
    }

    // Position below the anchor button
    const mount = view.dom.parentElement;
    if (!mount) return;
    const anchorRect = anchor.getBoundingClientRect();
    const parentRect = mount.getBoundingClientRect();
    colorPicker.style.left = `${anchorRect.left - parentRect.left}px`;
    colorPicker.style.top = `${anchorRect.bottom - parentRect.top + 4}px`;
    getContainer(view).appendChild(colorPicker);
    clampDropdownPosition(colorPicker, parentRect);
  }

  function applyCellBackground(view: EditorView, color: string) {
    const sel = view.state.selection;
    if (!(sel instanceof CellSelection)) return;
    const tr = view.state.tr;
    sel.forEachCell((_cell, pos) => {
      const node = tr.doc.nodeAt(pos);
      if (!node) return;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, background: color || null });
    });
    view.dispatch(tr);
  }

  // ── Detect if CellSelection covers full row(s) or column(s) ──

  function isFullRowSelection(view: EditorView): boolean {
    const sel = view.state.selection;
    if (!(sel instanceof CellSelection)) return false;
    const info = findTableInfo(view.state);
    if (!info) return false;
    // Check if all cells in each selected row are selected
    const selectedPositions = new Set<number>();
    sel.forEachCell((_cell, pos) => { selectedPositions.add(pos - info.tableStart); });
    // Group by row
    for (let row = 0; row < info.map.height; row++) {
      let rowHasSelected = false;
      let rowAllSelected = true;
      for (let col = 0; col < info.map.width; col++) {
        const cellOffset = info.map.map[row * info.map.width + col];
        if (selectedPositions.has(cellOffset)) rowHasSelected = true;
        else rowAllSelected = false;
      }
      if (rowHasSelected && !rowAllSelected) return false;
    }
    return true;
  }

  function isFullColSelection(view: EditorView): boolean {
    const sel = view.state.selection;
    if (!(sel instanceof CellSelection)) return false;
    const info = findTableInfo(view.state);
    if (!info) return false;
    const selectedPositions = new Set<number>();
    sel.forEachCell((_cell, pos) => { selectedPositions.add(pos - info.tableStart); });
    for (let col = 0; col < info.map.width; col++) {
      let colHasSelected = false;
      let colAllSelected = true;
      for (let row = 0; row < info.map.height; row++) {
        const cellOffset = info.map.map[row * info.map.width + col];
        if (selectedPositions.has(cellOffset)) colHasSelected = true;
        else colAllSelected = false;
      }
      if (colHasSelected && !colAllSelected) return false;
    }
    return true;
  }

  // ── Block operation helpers ──

  /** Apply a command to each cell in a CellSelection by temporarily setting TextSelection */
  function applyCommandPerCell(view: EditorView, command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean) {
    const sel = view.state.selection;
    if (sel instanceof CellSelection) {
      // Collect cell positions first (before any mutations)
      const cellPositions: number[] = [];
      sel.forEachCell((_cell, pos) => { cellPositions.push(pos); });
      for (const cellPos of cellPositions) {
        const cell = view.state.doc.nodeAt(cellPos);
        if (!cell) continue;
        // Create a selection spanning all content inside the cell
        const from = cellPos + 1;
        const to = cellPos + cell.nodeSize - 1;
        // Use Selection.findFrom which safely handles block content (cells have block+ content model)
        const $from = view.state.doc.resolve(from);
        const safeSel = Selection.findFrom($from, 1, true);
        const textSel = safeSel || Selection.near($from);
        const tempState = view.state.apply(view.state.tr.setSelection(textSel));
        command(tempState, (tr) => {
          // Apply steps from the temp transaction to the real view
          for (let i = 0; i < tr.steps.length; i++) {
            const step = tr.steps[i];
            const result = view.state.tr.step(step);
          }
          view.dispatch(view.state.tr);
        });
      }
    } else {
      command(view.state, view.dispatch);
    }
  }

  /** Toggle blockquote on selection or cells */
  function toggleBlockquoteOnSelection(view: EditorView) {
    const sel = view.state.selection;
    if (sel instanceof CellSelection) {
      // For CellSelection, wrap/unwrap content in each cell
      const cellPositions: number[] = [];
      sel.forEachCell((_cell, pos) => { cellPositions.push(pos); });
      const schema = view.state.schema;
      const bqType = schema.nodes.blockquote;
      if (!bqType) return;

      // Check if first cell's content is already a blockquote to decide toggle direction
      const firstCell = view.state.doc.nodeAt(cellPositions[0]);
      const isWrapped = firstCell?.firstChild?.type === bqType;

      const tr = view.state.tr;
      // Process cells in reverse order to keep positions stable
      for (let i = cellPositions.length - 1; i >= 0; i--) {
        const cellPos = cellPositions[i];
        const cell = tr.doc.nodeAt(cellPos);
        if (!cell) continue;
        const innerFrom = cellPos + 1;

        if (isWrapped) {
          // Unwrap: replace blockquote with its content
          const firstChild = cell.firstChild;
          if (firstChild?.type === bqType) {
            tr.replaceWith(innerFrom, innerFrom + firstChild.nodeSize, firstChild.content);
          }
        } else {
          // Wrap: wrap all cell content in blockquote
          const content = cell.content;
          const bq = bqType.create(null, content);
          tr.replaceWith(innerFrom, innerFrom + content.size, bq);
        }
      }
      view.dispatch(tr);
    } else {
      // Single cell text selection — use standard commands
      const schema = view.state.schema;
      const bqType = schema.nodes.blockquote;
      // Check if already in blockquote
      const { $from } = view.state.selection;
      let inBq = false;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === bqType) { inBq = true; break; }
      }
      if (inBq) {
        lift(view.state, view.dispatch);
      } else {
        wrapIn(bqType)(view.state, view.dispatch);
      }
    }
  }

  /** Toggle list on selection or cells */
  function toggleListOnSelection(view: EditorView, listTypeName: string) {
    const schema = view.state.schema;
    const listType = schema.nodes[listTypeName];
    if (!listType) return;

    const sel = view.state.selection;
    if (sel instanceof CellSelection) {
      // For CellSelection, wrap content in each cell
      const cellPositions: number[] = [];
      sel.forEachCell((_cell, pos) => { cellPositions.push(pos); });

      const itemType = listTypeName === 'checkbox_list' ? schema.nodes.checkbox_item : schema.nodes.list_item;

      // Check if first cell already has this list type
      const firstCell = view.state.doc.nodeAt(cellPositions[0]);
      const isWrapped = firstCell?.firstChild?.type === listType;

      const tr = view.state.tr;
      for (let i = cellPositions.length - 1; i >= 0; i--) {
        const cellPos = cellPositions[i];
        const cell = tr.doc.nodeAt(cellPos);
        if (!cell) continue;
        const innerFrom = cellPos + 1;

        if (isWrapped) {
          // Unwrap: replace list with its items' content
          const firstChild = cell.firstChild;
          if (firstChild?.type === listType) {
            const paras: any[] = [];
            firstChild.forEach((item: any) => {
              item.forEach((child: any) => { paras.push(child); });
            });
            tr.replaceWith(innerFrom, innerFrom + firstChild.nodeSize, paras);
          }
        } else {
          // Wrap: wrap each paragraph in a list item, then wrap all in the list
          const items: any[] = [];
          cell.forEach((child: any) => {
            const attrs = listTypeName === 'checkbox_list' ? { checked: false } : null;
            items.push(itemType.create(attrs, child));
          });
          const list = listType.create(null, items);
          tr.replaceWith(innerFrom, innerFrom + cell.content.size, list);
        }
      }
      view.dispatch(tr);
    } else {
      // Single cell text selection — find the containing cell and manually toggle
      const { $from } = view.state.selection;
      const LIST_TYPES = new Set(['bullet_list', 'ordered_list', 'checkbox_list']);

      // Find the cell containing the selection
      let cellPos = -1;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
          cellPos = $from.before(d);
          break;
        }
      }

      if (cellPos >= 0) {
        // Inside a table cell — use manual wrap/unwrap
        const cell = view.state.doc.nodeAt(cellPos);
        if (!cell) return;
        const innerFrom = cellPos + 1;
        const itemType = listTypeName === 'checkbox_list' ? schema.nodes.checkbox_item : schema.nodes.list_item;

        // Check if content is already wrapped in this list type
        const isWrapped = cell.firstChild?.type === listType;

        const tr = view.state.tr;
        if (isWrapped) {
          // Unwrap: replace list with its items' content
          const firstChild = cell.firstChild;
          if (firstChild) {
            const paras: any[] = [];
            firstChild.forEach((item: any) => {
              item.forEach((child: any) => { paras.push(child); });
            });
            tr.replaceWith(innerFrom, innerFrom + firstChild.nodeSize, paras);
          }
        } else {
          // Unwrap existing different list type first
          let contentToWrap = cell.content;
          if (cell.firstChild && LIST_TYPES.has(cell.firstChild.type.name)) {
            const paras: any[] = [];
            cell.firstChild.forEach((item: any) => {
              item.forEach((child: any) => { paras.push(child); });
            });
            contentToWrap = Fragment.from(paras);
          }
          // Wrap each block in a list item
          const items: any[] = [];
          contentToWrap.forEach((child: any) => {
            const attrs = listTypeName === 'checkbox_list' ? { checked: false } : null;
            items.push(itemType.create(attrs, child));
          });
          const list = listType.create(null, items);
          tr.replaceWith(innerFrom, innerFrom + cell.content.size, list);
        }
        view.dispatch(tr);
      } else {
        // Not in a table — use standard commands
        let inSameList = false;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (LIST_TYPES.has(node.type.name)) {
            inSameList = node.type === listType;
            break;
          }
        }
        if (inSameList) {
          const itemType2 = listTypeName === 'checkbox_list' ? schema.nodes.checkbox_item : schema.nodes.list_item;
          liftListItem(itemType2)(view.state, view.dispatch);
        } else {
          wrapInList(listType)(view.state, view.dispatch);
        }
      }
    }
  }

  // ── Heading helper (used by toolbar and dropdown) ──
  function setHeadingOnSelection(view: EditorView, level: number) {
    const sel = view.state.selection;
    const isCellSel = sel instanceof CellSelection;
    const headingType = view.state.schema.nodes.heading;
    const paraType = view.state.schema.nodes.paragraph;
    if (!headingType) return;
    if (isCellSel) {
      const { tr } = view.state;
      (sel as any).forEachCell((cell: any, pos: number) => {
        cell.forEach((child: any, offset: number) => {
          if (child.type === paraType || child.type === headingType) {
            const childPos = pos + 1 + offset;
            if (child.type === headingType && child.attrs.level === level) {
              tr.setNodeMarkup(childPos, paraType);
            } else {
              tr.setNodeMarkup(childPos, headingType, { level });
            }
          }
        });
      });
      view.dispatch(tr);
    } else {
      const { $from } = view.state.selection;
      const parent = $from.parent;
      const pos = $from.before($from.depth);
      const { tr } = view.state;
      if (parent.type === headingType && parent.attrs.level === level) {
        tr.setNodeMarkup(pos, paraType);
      } else if (parent.type === paraType || parent.type === headingType) {
        tr.setNodeMarkup(pos, headingType, { level });
      }
      view.dispatch(tr);
    }
  }

  // ── Unified cell/table toolbar ─────────────────────────────────

  function showCellToolbar(view: EditorView) {
    closeCellToolbar();
    closeContextMenu();

    const sel = view.state.selection;
    const isCellSel = sel instanceof CellSelection;

    // If React callback is provided, emit toolbar info instead of building DOM
    if (onCellToolbar) {
      const isRow = isCellSel ? isFullRowSelection(view) : false;
      const isCol = isCellSel ? isFullColSelection(view) : false;

      if (isCellSel) {
        let minTop = Infinity;
        let minLeft = Infinity;
        let maxRight = -Infinity;
        (sel as any).forEachCell((_cell: any, pos: number) => {
          const dom = view.nodeDOM(pos);
          if (dom && dom instanceof HTMLElement) {
            const r = dom.getBoundingClientRect();
            if (r.top < minTop) minTop = r.top;
            if (r.left < minLeft) minLeft = r.left;
            if (r.right > maxRight) maxRight = r.right;
          }
        });
        if (minTop === Infinity) return;
        onCellToolbar({
          anchor: { top: minTop, left: minLeft, width: maxRight - minLeft },
          view,
          isCellSelection: true,
          isFullRow: isRow,
          isFullCol: isCol,
        });
      } else {
        const coords = view.coordsAtPos(view.state.selection.from);
        const endCoords = view.coordsAtPos(view.state.selection.to);
        onCellToolbar({
          anchor: { top: coords.top, left: coords.left, width: endCoords.left - coords.left || 200 },
          view,
          isCellSelection: false,
          isFullRow: false,
          isFullCol: false,
        });
      }
      return;
    }
  }

  // ── Mouse tracking for selection stability ──
  let isMouseDragging = false;
  const onTMMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't set dragging flag for clicks inside our own UI (toolbar buttons, dropdowns)
    if (container && container.contains(target)) return;
    isMouseDragging = true;
  };
  const onTMMouseUp = () => {
    if (!isMouseDragging) return; // was a click on our UI, not a drag
    isMouseDragging = false;
    if (currentView) update(currentView);
  };
  document.addEventListener('mousedown', onTMMouseDown);
  document.addEventListener('mouseup', onTMMouseUp);

  // ── Main update ────────────────────────────────────────────────

  function update(view: EditorView) {
    currentView = view;
    const state = view.state;

    // If a dropdown (alignment, heading, list, color picker) is open, don't rebuild
    // — rebuilding would destroy the dropdown
    const hasOpenDropdown = !!(alignDropdown || colorPicker);

    // If multi-cell selection, show unified toolbar
    if (isCellSelection(state)) {
      const info = findTableInfo(state);
      if (info) {
        showBars(view, info);
      }
      if (hasOpenDropdown) return; // preserve open dropdown
      if (!isMouseDragging) showCellToolbar(view);
      else closeCellToolbar();
      return;
    }

    // If single cell in table
    if (isInTableCheck(state)) {
      const info = findTableInfo(state);
      if (info) {
        showBars(view, info);
        if (hasOpenDropdown) return; // preserve open dropdown
        // If text is selected inside a cell, show unified toolbar (only after mouse released)
        const { from, to, empty } = state.selection;
        if (!empty && from !== to && !isMouseDragging) {
          showCellToolbar(view);
        } else {
          closeCellToolbar();
        }
        return;
      }
    }

    // Not in table
    hideAll();
  }

  // Track which table the bars were last built for to avoid unnecessary rebuilds
  let lastBarTablePos = -1;
  let lastBarTableSize = -1;

  function showBars(view: EditorView, info: NonNullable<ReturnType<typeof findTableInfo>>) {
    const mount = view.dom.parentElement;
    if (!mount) return;

    const tableDOM = view.nodeDOM(info.tablePos) as HTMLElement | null;
    if (!tableDOM) return;

    const c = getContainer(view);
    c.style.display = 'block';
    isActive = true;

    // Only rebuild bars if the table structure changed (different position or size)
    const tableSize = info.tableNode.nodeSize;
    if (lastBarTablePos === info.tablePos && lastBarTableSize === tableSize && topBar && leftBar) {
      // Just reposition existing bars without rebuilding
      const parentRect = mount.getBoundingClientRect();
      const tableRect = tableDOM.getBoundingClientRect();
      const s = getScale(mount);
      topBar.style.left = `${(tableRect.left - parentRect.left) / s}px`;
      topBar.style.top = `${(tableRect.top - parentRect.top) / s - 16}px`;
      topBar.style.width = `${tableRect.width / s}px`;
      leftBar.style.left = `${(tableRect.left - parentRect.left) / s - 16}px`;
      leftBar.style.top = `${(tableRect.top - parentRect.top) / s}px`;
      leftBar.style.height = `${tableRect.height / s}px`;
      return;
    }

    lastBarTablePos = info.tablePos;
    lastBarTableSize = tableSize;

    const parentRect = mount.getBoundingClientRect();
    buildTopBar(view, info, tableDOM, parentRect);
    buildLeftBar(view, info, tableDOM, parentRect);
  }

  // Document click handler to close menus
  function onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Don't close anything if click is inside our own container (toolbar, dropdown, etc.)
    if (container && container.contains(target)) return;
    if (contextMenu && contextMenu.contains(target)) return;
    if (colorPicker && colorPicker.contains(target)) return;
    if (alignDropdown && alignDropdown.contains(target)) return;
    if (!contextMenu && !colorPicker && !alignDropdown && !cellToolbar) return;
    closeContextMenu();
    closeCellToolbar();
  }

  return new Plugin({
    key: tableMenuKey,
    view(editorView) {
      currentView = editorView;
      document.addEventListener('mousedown', onDocumentClick, true);

      return {
        update(view) {
          update(view);
        },
        destroy() {
          document.removeEventListener('mousedown', onDocumentClick, true);
          document.removeEventListener('mousedown', onTMMouseDown);
          document.removeEventListener('mouseup', onTMMouseUp);
          destroyAll();
        },
      };
    },
  });
}
