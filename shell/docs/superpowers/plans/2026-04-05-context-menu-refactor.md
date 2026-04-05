# Context Menu Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor right-click context menus across Sidebar, Doc, Table, PPT, and Flowchart editors so every menu item is fully functional.

**Architecture:** Each editor dispatches `show-context-menu` CustomEvent to the global `ContextMenuProvider`. Menu item definitions live in `*-context-menu.ts` files; actual handlers live in the editor component. The refactor updates both the menu item definitions and the handlers together for each editor.

**Tech Stack:** Next.js, React, TypeScript, fabric.js v6 (PPT canvas), @antv/x6 (Flowchart), Baserow API (Table rows)

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/(workspace)/content/page.tsx` | Sidebar: add Open-in-tab, Rename (inline), Change icon; remove Download, Share |
| `src/components/editor/Editor.tsx` | Doc: remove contextmenu preventDefault, remove handler |
| `src/components/editor/doc-context-menu.ts` | Doc: delete file (no longer needed) |
| `src/components/table-editor/table-context-menu.ts` | Table: rewrite menu items |
| `src/components/table-editor/TableEditor.tsx` | Table: wire insert/delete/open-record/comments handlers; editing-cell check |
| `src/components/presentation-editor/SlidePanel.tsx` | PPT: add multi-select state, right-click menu, slide clipboard, keyboard shortcuts |
| `src/components/presentation-editor/PresentationEditor.tsx` | PPT: pass multi-select props to SlidePanel; canvas menu rewrite; add ⌘X cut; fix contextmenu bug |
| `src/components/presentation-editor/ppt-context-menu.ts` | PPT: rewrite canvas object menu + empty-area menu; add slide menu |
| `src/components/diagram-editor/diagram-context-menu.ts` | Diagram: rewrite node menu + empty-area menu; remove edge menu |
| `src/components/diagram-editor/X6DiagramEditor.tsx` | Diagram: wire to-front/to-back/z-index handlers; remove edge contextmenu |

---

## Task 1: Sidebar — Update context menu items + implement Rename inline

**Files:**
- Modify: `src/app/(workspace)/content/page.tsx` (around lines 1722–1762, 1692–1830)

### What to do

1. In the `getContextMenuItems` callback inside `TreeNodeItem` component (~line 1722), replace the items array.
2. Add `renamingNodeId` state to `TreeNodeItem` (~line 1715 area).
3. Render the node title as `<input>` when `renamingNodeId === nodeId`.

- [ ] **Step 1: Add `renamingNodeId` state to `TreeNodeItem`**

In `TreeNodeItem` function, after `const [showIconPicker, setShowIconPicker] = useState(false);` (~line 1715), add:

```tsx
const [isRenaming, setIsRenaming] = useState(false);
const [renameValue, setRenameValue] = useState('');
const renameInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: Rewrite `getContextMenuItems` in `TreeNodeItem`**

Replace lines 1722–1759 (`const getContextMenuItems = useCallback...`) with:

```tsx
const getContextMenuItems = useCallback((): ContextMenuItem[] => [
  ...(!isMobile ? [{
    id: 'open-tab',
    label: 'Open in new tab',
    icon: <ExternalLink className="h-4 w-4" />,
    onClick: () => {
      window.open(`/content?id=${node.type}:${node.rawId}`, '_blank');
    },
  }] : []),
  {
    id: 'rename',
    label: 'Rename',
    icon: <Pencil className="h-4 w-4" />,
    onClick: () => {
      setRenameValue(node.label);
      setIsRenaming(true);
      setTimeout(() => {
        renameInputRef.current?.select();
      }, 30);
    },
  },
  {
    id: 'change-icon',
    label: 'Change icon',
    icon: <Smile className="h-4 w-4" />,
    onClick: () => setShowIconPicker(true),
  },
  {
    id: 'copy-link',
    label: 'Copy link',
    icon: <Link2 className="h-4 w-4" />,
    onClick: () => {
      const link = `${window.location.origin}/content?id=${node.type}:${node.rawId}`;
      navigator.clipboard.writeText(link).catch(() => {});
    },
  },
  {
    id: 'pin',
    label: node.pinned ? 'Unpin' : 'Pin to top',
    icon: node.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
    onClick: () => onTogglePin(nodeId),
  },
  {
    id: 'delete',
    label: 'Move to Trash',
    icon: <Trash2 className="h-4 w-4" />,
    danger: true,
    separator: true,
    onClick: () => onRequestDelete(nodeId),
  },
], [node.pinned, node.rawId, node.type, node.label, nodeId, isMobile, onTogglePin, onRequestDelete]);
```

- [ ] **Step 3: Add `ExternalLink` and `Smile` to the lucide-react import at the top of the file**

Find line 7: `import { FileText, Table2, Plus, ... }` and add `ExternalLink, Smile` to it.

- [ ] **Step 4: Add inline rename commit handler**

After the `handleIconSelect` function (~line 1776), add:

```tsx
const handleRenameCommit = async () => {
  const trimmed = renameValue.trim();
  setIsRenaming(false);
  if (!trimmed || trimmed === node.label) return;
  try {
    await gw.updateContentItem(node.id, { title: trimmed });
  } catch (e) {
    console.error('Rename failed', e);
  }
};
```

- [ ] **Step 5: Render the node title as an input when renaming**

In the JSX where the node label is rendered, find where `{node.label}` is displayed (~line 1879 area). Replace the label span with:

```tsx
{isRenaming ? (
  <input
    ref={renameInputRef}
    className="flex-1 min-w-0 bg-transparent border-b border-sidebar-primary outline-none text-sm font-medium"
    value={renameValue}
    onChange={e => setRenameValue(e.target.value)}
    onBlur={handleRenameCommit}
    onKeyDown={e => {
      if (e.key === 'Enter') { e.preventDefault(); handleRenameCommit(); }
      if (e.key === 'Escape') { e.preventDefault(); setIsRenaming(false); }
    }}
    onClick={e => e.stopPropagation()}
  />
) : (
  <span className="flex-1 min-w-0 truncate">{node.label}</span>
)}
```

(Find the exact `<span>` that renders `node.label` and replace it with this conditional.)

- [ ] **Step 6: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds with no errors related to these files.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/app/\(workspace\)/content/page.tsx && git commit -m "feat(sidebar): update context menu — add open-in-tab, rename, change-icon; remove download/share"
```

---

## Task 2: Doc Editor — Remove custom context menu

**Files:**
- Modify: `src/components/editor/Editor.tsx` (around lines 329–354)
- Keep: `src/components/editor/doc-context-menu.ts` (orphaned but harmless — do not delete to avoid unused-import errors; just remove the import)

### What to do

Remove the `contextmenu` event listener that calls `e.preventDefault()` and shows the custom menu. Also remove the `onTouchStart`/`onTouchEnd` long-press that triggers the menu.

- [ ] **Step 1: Remove contextmenu handler from `Editor.tsx`**

Find the `useEffect` that contains `const onContextMenu = (e: MouseEvent) => {` (~line 329). Delete the entire block including:
- `const onContextMenu = ...`
- `el.addEventListener('contextmenu', onContextMenu);`
- `return () => el.removeEventListener('contextmenu', onContextMenu);`

Also remove the import of `getDocSelectionContextMenuItems` and `getDocEmptyContextMenuItems` from line 19.

- [ ] **Step 2: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/editor/Editor.tsx && git commit -m "feat(doc-editor): remove custom context menu, restore browser default"
```

---

## Task 3: Table Editor — Fix insert/delete handlers + rewrite menu items + editing-cell detection

**Files:**
- Modify: `src/components/table-editor/table-context-menu.ts`
- Modify: `src/components/table-editor/TableEditor.tsx`

### What to do

1. Rewrite `table-context-menu.ts` to expose the new menu items (Insert above/below, Open record, Comments, Delete record).
2. In `TableEditor.tsx` context menu handler (~line 552), detect editing-cell state and skip `preventDefault` when editing.
3. Wire the `table:insert-row-above`, `table:insert-row-below`, `table:open-record`, `table:row-comments`, `table:delete-record` events to actual handlers.

- [ ] **Step 1: Rewrite `table-context-menu.ts`**

Replace the entire `getCellContextMenuItems` function:

```typescript
export function getCellContextMenuItems(rowId: number, rowIdx: number): ContextMenuItem[] {
  return [
    {
      id: 'insert-row-above',
      label: 'Insert row above',
      onClick: () => dispatch('table:insert-row-above', { rowId, rowIdx }),
    },
    {
      id: 'insert-row-below',
      label: 'Insert row below',
      onClick: () => dispatch('table:insert-row-below', { rowId, rowIdx }),
    },
    {
      id: 'open-record',
      label: 'Open record',
      separator: true,
      onClick: () => dispatch('table:open-record', { rowId, rowIdx }),
    },
    {
      id: 'comments',
      label: 'Comments',
      onClick: () => dispatch('table:row-comments', { rowId, rowIdx }),
    },
    {
      id: 'delete-record',
      label: 'Delete record',
      danger: true,
      separator: true,
      onClick: () => dispatch('table:delete-record', { rowId, rowIdx }),
    },
  ];
}
```

(Keep `getHeaderContextMenuItems` unchanged.)

- [ ] **Step 2: Update the `onContextMenu` handler in `TableEditor.tsx` to pass `rowIdx` and detect editing state**

In the `onContextMenu` handler (~line 552), find where it calls `getCellContextMenuItems(rowId, colTitle)` and replace with logic that:
1. Gets the row index from the DOM (`tr.getAttribute('data-row-idx')`) or from `rows.findIndex(r => (r.Id as number) === rowId)`.
2. Skips `preventDefault` if `editingCell?.rowId === rowId` (lets browser handle).

Replace the cell detection block:

```typescript
const td = target.closest('td[data-col-title]') as HTMLElement | null;
const tr = target.closest('tr[data-row-id]') as HTMLElement | null;
if (td && tr) {
  const rowId = Number(tr.getAttribute('data-row-id'));
  const rowIdx = rows.findIndex(r => (r.Id as number) === rowId);
  if (!isNaN(rowId)) {
    // If this cell is actively being edited, let browser handle
    if (editingCell?.rowId === rowId) return;
    e.preventDefault();
    e.stopPropagation();
    showMenu(getCellContextMenuItems(rowId, rowIdx), e.clientX, e.clientY);
    return;
  }
}
```

Do the same for the mobile long-press block (same pattern, find the `td && tr` check inside `longPressTimer = setTimeout`).

Also update the `getCellContextMenuItems` import at the top of the file — the function signature changed (colKey removed, rowIdx added).

- [ ] **Step 3: Add event listeners for the new table events in `TableEditor.tsx`**

After the existing context-menu `useEffect` (around line 660), add a new `useEffect`:

```tsx
useEffect(() => {
  const onInsertAbove = async (e: Event) => {
    const { rowId, rowIdx } = (e as CustomEvent).detail as { rowId: number; rowIdx: number };
    // Baserow insertRow appends to end; we insert and then the refresh will show it at bottom.
    // Degraded: inserts at end, scrolls to new row.
    await handleInsertRow();
  };

  const onInsertBelow = async (e: Event) => {
    await handleInsertRow();
  };

  const onOpenRecord = (e: Event) => {
    const { rowIdx } = (e as CustomEvent).detail as { rowIdx: number };
    if (rowIdx >= 0) {
      setExpandWithComments(false);
      setExpandedRowIdx(rowIdx);
    }
  };

  const onRowComments = (e: Event) => {
    const { rowIdx } = (e as CustomEvent).detail as { rowIdx: number };
    if (rowIdx >= 0) {
      setExpandWithComments(true);
      setExpandedRowIdx(rowIdx);
    }
  };

  const onDeleteRecord = async (e: Event) => {
    const { rowId } = (e as CustomEvent).detail as { rowId: number };
    await handleDeleteRow(rowId);
  };

  window.addEventListener('table:insert-row-above', onInsertAbove);
  window.addEventListener('table:insert-row-below', onInsertBelow);
  window.addEventListener('table:open-record', onOpenRecord);
  window.addEventListener('table:row-comments', onRowComments);
  window.addEventListener('table:delete-record', onDeleteRecord);

  return () => {
    window.removeEventListener('table:insert-row-above', onInsertAbove);
    window.removeEventListener('table:insert-row-below', onInsertBelow);
    window.removeEventListener('table:open-record', onOpenRecord);
    window.removeEventListener('table:row-comments', onRowComments);
    window.removeEventListener('table:delete-record', onDeleteRecord);
  };
}, [handleInsertRow, handleDeleteRow, setExpandedRowIdx, setExpandWithComments, rows]);
```

Note: `handleInsertRow` is the existing function at line ~1043 that calls `br.insertRow`. Use it directly.

- [ ] **Step 4: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/table-editor/table-context-menu.ts src/components/table-editor/TableEditor.tsx && git commit -m "feat(table-editor): fix context menu — wire insert/delete/open-record/comments; skip prevention in edit mode"
```

---

## Task 4: PPT — Rewrite ppt-context-menu.ts

**Files:**
- Modify: `src/components/presentation-editor/ppt-context-menu.ts`

### What to do

Rewrite to provide three exported functions:
1. `getObjectContextMenuItems()` — selected canvas objects
2. `getCanvasContextMenuItems()` — empty canvas area
3. `getSlideContextMenuItems(multiSelect: boolean)` — slide panel

- [ ] **Step 1: Replace `ppt-context-menu.ts` entirely**

```typescript
import type { ContextMenuItem } from '@/lib/hooks/use-context-menu';

function dispatch(eventName: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/** Context menu for a selected object on the PPT canvas */
export function getObjectContextMenuItems(): ContextMenuItem[] {
  return [
    {
      id: 'cut',
      label: 'Cut',
      shortcut: '⌘X',
      onClick: () => dispatch('ppt:cut'),
    },
    {
      id: 'copy',
      label: 'Copy',
      shortcut: '⌘C',
      onClick: () => dispatch('ppt:copy'),
    },
    {
      id: 'paste',
      label: 'Paste',
      shortcut: '⌘V',
      onClick: () => dispatch('ppt:paste'),
    },
    {
      id: 'delete',
      label: 'Delete',
      shortcut: 'Del',
      danger: true,
      separator: true,
      onClick: () => dispatch('ppt:delete-selected'),
    },
    {
      id: 'bring-to-front',
      label: 'Bring to front',
      separator: true,
      onClick: () => dispatch('ppt:bring-to-front'),
    },
    {
      id: 'bring-forward',
      label: 'Bring forward',
      onClick: () => dispatch('ppt:bring-forward'),
    },
    {
      id: 'send-backward',
      label: 'Send backward',
      onClick: () => dispatch('ppt:send-backward'),
    },
    {
      id: 'send-to-back',
      label: 'Send to back',
      onClick: () => dispatch('ppt:send-to-back'),
    },
    {
      id: 'comment',
      label: 'Comment',
      separator: true,
      onClick: () => dispatch('ppt:open-comments'),
    },
  ];
}

/** Context menu for empty canvas area (no object selected) */
export function getCanvasContextMenuItems(): ContextMenuItem[] {
  return [
    {
      id: 'paste',
      label: 'Paste',
      shortcut: '⌘V',
      onClick: () => dispatch('ppt:paste'),
    },
    {
      id: 'background',
      label: 'Background settings',
      separator: true,
      onClick: () => dispatch('ppt:open-background'),
    },
    {
      id: 'comment',
      label: 'Comment',
      onClick: () => dispatch('ppt:open-comments'),
    },
  ];
}

/** Context menu for slide panel thumbnails */
export function getSlideContextMenuItems(multiSelect: boolean): ContextMenuItem[] {
  return [
    {
      id: 'slide-cut',
      label: 'Cut',
      shortcut: '⌘X',
      onClick: () => dispatch('ppt:slide-cut'),
    },
    {
      id: 'slide-copy',
      label: 'Copy',
      shortcut: '⌘C',
      onClick: () => dispatch('ppt:slide-copy'),
    },
    {
      id: 'slide-paste',
      label: 'Paste',
      shortcut: '⌘V',
      onClick: () => dispatch('ppt:slide-paste'),
    },
    {
      id: 'slide-delete',
      label: 'Delete',
      shortcut: 'Del',
      danger: true,
      separator: true,
      onClick: () => dispatch('ppt:slide-delete'),
    },
    {
      id: 'slide-duplicate',
      label: 'Duplicate',
      shortcut: '⌘D',
      onClick: () => dispatch('ppt:slide-duplicate'),
    },
    {
      id: 'slide-background',
      label: 'Background settings',
      separator: true,
      onClick: () => dispatch('ppt:open-background'),
    },
    ...(!multiSelect ? [{
      id: 'slide-comment',
      label: 'Comment',
      onClick: () => dispatch('ppt:open-comments'),
    }] : []),
  ];
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds (unused old exports will cause TypeScript errors only if imported).

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/presentation-editor/ppt-context-menu.ts && git commit -m "feat(ppt): rewrite ppt-context-menu — canvas object/empty/slide panel menus"
```

---

## Task 5: PPT — Rewrite SlidePanel with multi-select + context menu

**Files:**
- Modify: `src/components/presentation-editor/SlidePanel.tsx`

### What to do

Replace the single-select `currentSlideIndex` with a multi-select model. Add right-click context menu. Wire keyboard shortcuts via a `useEffect`.

- [ ] **Step 1: Rewrite `SlidePanel.tsx`**

Replace the entire file with:

```tsx
'use client';

import { Plus, Table2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SlideData, SLIDE_WIDTH, SLIDE_HEIGHT, THUMB_WIDTH } from './types';
import { getSlideContextMenuItems } from './ppt-context-menu';

// ─── Slide Thumbnail ─────────────────────────────────
function SlideThumb({ slide }: { slide: SlideData }) {
  const scale = THUMB_WIDTH / SLIDE_WIDTH;
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: slide.background || '#fff' }}>
      {slide.backgroundImage && (
        <img src={slide.backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {slide.elements.slice(0, 10).map((el, i) => {
        const w = (el.width || 100) * scale * (el.scaleX || 1);
        const h = (el.height || 50) * scale * (el.scaleY || 1);
        const style: React.CSSProperties = {
          position: 'absolute',
          left: (el.left || 0) * scale,
          top: (el.top || 0) * scale,
          width: w,
          height: h,
          overflow: 'hidden',
        };
        if (el.type === 'textbox') {
          const scaledFont = (el.fontSize || 24) * scale;
          if (scaledFont < 6) {
            const barH = Math.max(2, Math.round(scaledFont * 0.8));
            return (
              <div key={i} style={{ ...style }}>
                {(el.text || '').split('\n').slice(0, 3).map((line: string, li: number) => (
                  <div key={li} style={{ height: barH, width: `${Math.min(100, Math.max(20, (line.length / 30) * 100))}%`, backgroundColor: el.fill || '#333', opacity: 0.4, borderRadius: 1, marginBottom: 1 }} />
                ))}
              </div>
            );
          }
          return <div key={i} style={{ ...style, fontSize: scaledFont, lineHeight: '1.2', color: el.fill || '#333' }}>{el.text?.slice(0, 30)}</div>;
        }
        if (el.type === 'rect') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: (el.rx || 0) * scale }} />;
        if (el.type === 'circle') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: '50%' }} />;
        if (el.type === 'triangle') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />;
        if (el.type === 'ellipse') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: '50%' }} />;
        if (el.type === 'shape') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: 4 }} />;
        if (el.type === 'image') return <img key={i} src={el.src} alt="" style={{ ...style, objectFit: 'cover' }} />;
        if (el.type === 'table') return <div key={i} style={{ ...style, backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}><Table2 className="w-full h-full text-muted-foreground/30 p-0.5" /></div>;
        return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0' }} />;
      })}
    </div>
  );
}

// ─── Slide Panel ─────────────────────────────────────
export interface SlidePanelProps {
  slides: SlideData[];
  currentSlideIndex: number;
  selectedIndices: Set<number>;
  onSlideSelect: (index: number) => void;
  onMultiSelect: (indices: Set<number>) => void;
  onAddSlide: () => void;
}

export function SlidePanel({
  slides,
  currentSlideIndex,
  selectedIndices,
  onSlideSelect,
  onMultiSelect,
  onAddSlide,
}: SlidePanelProps) {
  const lastClickedIdx = useRef<number>(currentSlideIndex);

  const handleClick = useCallback((i: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle individual selection
      const next = new Set(selectedIndices);
      if (next.has(i)) {
        next.delete(i);
        if (next.size === 0) next.add(currentSlideIndex);
      } else {
        next.add(i);
      }
      onMultiSelect(next);
      lastClickedIdx.current = i;
    } else if (e.shiftKey && selectedIndices.size > 0) {
      // Range selection from lastClickedIdx to i
      const from = Math.min(lastClickedIdx.current, i);
      const to = Math.max(lastClickedIdx.current, i);
      const next = new Set<number>();
      for (let idx = from; idx <= to; idx++) next.add(idx);
      onMultiSelect(next);
    } else {
      onSlideSelect(i);
      onMultiSelect(new Set([i]));
      lastClickedIdx.current = i;
    }
  }, [selectedIndices, currentSlideIndex, onSlideSelect, onMultiSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    // If right-clicked slide is not already selected, select it
    if (!selectedIndices.has(i)) {
      onSlideSelect(i);
      onMultiSelect(new Set([i]));
    }
    const multiSelect = selectedIndices.size > 1 || (!selectedIndices.has(i) ? false : selectedIndices.size > 1);
    window.dispatchEvent(new CustomEvent('show-context-menu', {
      detail: { items: getSlideContextMenuItems(selectedIndices.size > 1), x: e.clientX, y: e.clientY },
    }));
  }, [selectedIndices, onSlideSelect, onMultiSelect]);

  return (
    <div className="w-[192px] flex-col shrink-0 bg-[#F5F7F5] dark:bg-sidebar hidden md:flex shadow-[0px_0px_20px_0px_rgba(0,0,0,0.02)]">
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onAddSlide}
          className="w-[160px] h-8 flex items-center gap-2 px-3 rounded border border-black/10 dark:border-white/10 bg-white/20 dark:bg-white/10 text-sm font-medium text-black/70 dark:text-white/70 hover:bg-white/40 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Slide
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {slides.map((slide, i) => (
          <button
            key={i}
            onClick={(e) => handleClick(i, e)}
            onContextMenu={(e) => handleContextMenu(e, i)}
            className={cn(
              'w-[160px] rounded border transition-all overflow-hidden',
              selectedIndices.has(i)
                ? 'border-[#2FCC71] border-2'
                : 'border-black/10 dark:border-white/10 hover:border-black/20'
            )}
          >
            <div
              className="w-full rounded-sm overflow-hidden"
              style={{ aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}`, backgroundColor: slide.background || '#fff' }}
            >
              <SlideThumb slide={slide} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds (PresentationEditor may have TypeScript errors due to new props — that's OK for now, will be fixed in Task 6).

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/presentation-editor/SlidePanel.tsx && git commit -m "feat(ppt-slides): add multi-select + context menu to SlidePanel"
```

---

## Task 6: PPT — Update PresentationEditor to wire slide operations + canvas menu + cut + contextmenu fix

**Files:**
- Modify: `src/components/presentation-editor/PresentationEditor.tsx`

### What to do

1. Add `selectedSlideIndices` state.
2. Pass new props to `SlidePanel`.
3. Handle `ppt:slide-cut/copy/paste/delete/duplicate` events.
4. Handle `ppt:open-comments`, `ppt:open-background`, `ppt:bring-to-front`, `ppt:send-to-back` events.
5. Add `ppt:cut` (⌘X) to the existing keyboard handler.
6. Fix contextmenu: use capture phase on `upper-canvas` too.

- [ ] **Step 1: Add `selectedSlideIndices` state and `slideClipboard` ref**

Find `const [showComments, setShowComments] = useState(false);` (~line 156). After it, add:

```tsx
const [selectedSlideIndices, setSelectedSlideIndices] = useState<Set<number>>(new Set([0]));
const slideClipboardRef = useRef<SlideData[]>([]);
```

Import `SlideData` at top if not already imported (check line 1 area: `import { ..., SlideData } from './types';`).

- [ ] **Step 2: Update SlidePanel usage in JSX**

Find `<SlidePanel` in the JSX (~line 1500 area). Update props to:

```tsx
<SlidePanel
  slides={slides}
  currentSlideIndex={currentSlideIndex}
  selectedIndices={selectedSlideIndices}
  onSlideSelect={(i) => {
    setCurrentSlideIndex(i);
    setSelectedSlideIndices(new Set([i]));
  }}
  onMultiSelect={setSelectedSlideIndices}
  onAddSlide={handleAddSlide}
/>
```

- [ ] **Step 3: Add slide operations `useEffect`**

Add a new `useEffect` (after the keyboard shortcuts useEffect ~line 574):

```tsx
useEffect(() => {
  const onSlideCut = () => {
    const indices = Array.from(selectedSlideIndices).sort((a, b) => a - b);
    slideClipboardRef.current = indices.map(i => JSON.parse(JSON.stringify(slides[i])));
    // Delete slides (highest index first to preserve indices)
    const toDelete = [...indices].reverse();
    let newSlides = [...slides];
    toDelete.forEach(i => { newSlides.splice(i, 1); });
    if (newSlides.length === 0) return; // don't delete all
    const newIdx = Math.min(currentSlideIndex, newSlides.length - 1);
    setSlides(newSlides);
    setCurrentSlideIndex(newIdx);
    setSelectedSlideIndices(new Set([newIdx]));
  };

  const onSlideCopy = () => {
    const indices = Array.from(selectedSlideIndices).sort((a, b) => a - b);
    slideClipboardRef.current = indices.map(i => JSON.parse(JSON.stringify(slides[i])));
  };

  const onSlidePaste = () => {
    if (slideClipboardRef.current.length === 0) return;
    const newSlides = [...slides];
    const insertAt = currentSlideIndex + 1;
    const pasted = slideClipboardRef.current.map(s => JSON.parse(JSON.stringify(s)));
    newSlides.splice(insertAt, 0, ...pasted);
    setSlides(newSlides);
    setCurrentSlideIndex(insertAt);
    setSelectedSlideIndices(new Set([insertAt]));
  };

  const onSlideDelete = () => {
    if (slides.length <= 1) return;
    const indices = Array.from(selectedSlideIndices).sort((a, b) => a - b);
    const toDelete = [...indices].reverse();
    let newSlides = [...slides];
    toDelete.forEach(i => { newSlides.splice(i, 1); });
    if (newSlides.length === 0) return;
    const newIdx = Math.min(Math.min(...indices), newSlides.length - 1);
    setSlides(newSlides);
    setCurrentSlideIndex(newIdx);
    setSelectedSlideIndices(new Set([newIdx]));
  };

  const onSlideDuplicate = () => {
    const indices = Array.from(selectedSlideIndices).sort((a, b) => a - b);
    const dupes = indices.map(i => JSON.parse(JSON.stringify(slides[i])));
    const newSlides = [...slides];
    const insertAt = Math.max(...indices) + 1;
    newSlides.splice(insertAt, 0, ...dupes);
    setSlides(newSlides);
    setCurrentSlideIndex(insertAt);
    setSelectedSlideIndices(new Set([insertAt]));
  };

  const onOpenComments = () => { setShowComments(true); setShowHistory(false); };
  const onOpenBackground = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.discardActiveObject();
    canvas?.renderAll();
    // Background settings is shown in the sidebar panel when no object is selected
    // (already handled by the properties panel logic)
  };

  window.addEventListener('ppt:slide-cut', onSlideCut);
  window.addEventListener('ppt:slide-copy', onSlideCopy);
  window.addEventListener('ppt:slide-paste', onSlidePaste);
  window.addEventListener('ppt:slide-delete', onSlideDelete);
  window.addEventListener('ppt:slide-duplicate', onSlideDuplicate);
  window.addEventListener('ppt:open-comments', onOpenComments);
  window.addEventListener('ppt:open-background', onOpenBackground);

  return () => {
    window.removeEventListener('ppt:slide-cut', onSlideCut);
    window.removeEventListener('ppt:slide-copy', onSlideCopy);
    window.removeEventListener('ppt:slide-paste', onSlidePaste);
    window.removeEventListener('ppt:slide-delete', onSlideDelete);
    window.removeEventListener('ppt:slide-duplicate', onSlideDuplicate);
    window.removeEventListener('ppt:open-comments', onOpenComments);
    window.removeEventListener('ppt:open-background', onOpenBackground);
  };
}, [slides, currentSlideIndex, selectedSlideIndices, setSlides, setCurrentSlideIndex]);
```

- [ ] **Step 4: Add canvas ordering handlers (`ppt:bring-to-front`, `ppt:send-to-back`, `ppt:bring-forward`, `ppt:send-backward`)**

The existing `ppt:bring-forward` and `ppt:send-backward` events are already dispatched via keyboard shortcuts but **may not have window listeners**. Check the keyboard shortcut handler (~line 87 in SHORTCUTS array) vs actual window event listeners.

In the existing keyboard shortcuts useEffect or a new one, add listeners for all four ordering events:

```tsx
useEffect(() => {
  const onBringToFront = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.fire('before:modified', { target: obj });
    obj.bringToFront();
    canvas.renderAll();
    canvas.fire('object:modified', { target: obj });
  };
  const onBringForward = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.fire('before:modified', { target: obj });
    obj.bringForward();
    canvas.renderAll();
    canvas.fire('object:modified', { target: obj });
  };
  const onSendBackward = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.fire('before:modified', { target: obj });
    obj.sendBackwards();
    canvas.renderAll();
    canvas.fire('object:modified', { target: obj });
  };
  const onSendToBack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.fire('before:modified', { target: obj });
    obj.sendToBack();
    canvas.renderAll();
    canvas.fire('object:modified', { target: obj });
  };

  window.addEventListener('ppt:bring-to-front', onBringToFront);
  window.addEventListener('ppt:bring-forward', onBringForward);
  window.addEventListener('ppt:send-backward', onSendBackward);
  window.addEventListener('ppt:send-to-back', onSendToBack);
  return () => {
    window.removeEventListener('ppt:bring-to-front', onBringToFront);
    window.removeEventListener('ppt:bring-forward', onBringForward);
    window.removeEventListener('ppt:send-backward', onSendBackward);
    window.removeEventListener('ppt:send-to-back', onSendToBack);
  };
}, []);
```

- [ ] **Step 5: Add `ppt:cut` to the keyboard handler**

In the keyboard `useEffect` (~line 519), inside `onKeyDown`, after the `e.key === 'c'` block, add:

```tsx
} else if (e.key === 'x' && !isFabricTextEditing) {
  // Cmd+X: cut active object
  if (!canvas || !activeObj) return;
  e.preventDefault();
  activeObj.clone().then((cloned: any) => {
    canvas.fire('before:modified', { target: activeObj });
    clipboardRef.current = cloned;
    canvas.remove(activeObj);
    canvas.renderAll();
    canvas.fire('object:modified', { target: cloned });
    console.log('[PPT] Cut object to clipboard');
  }).catch((err: any) => console.error('[PPT] cut clone failed:', err));
}
```

- [ ] **Step 6: Fix contextmenu not triggering — use capture phase on upper-canvas**

Find the contextmenu useEffect (~line 462). Replace:

```tsx
container.addEventListener('contextmenu', onContextMenu);
```

With:

```tsx
container.addEventListener('contextmenu', onContextMenu, true); // capture phase to catch fabric canvas events
```

Also update the `showMenu` function inside that useEffect to use `getObjectContextMenuItems` vs `getCanvasContextMenuItems` based on canvas active object:

```tsx
const showMenu = (x: number, y: number) => {
  const canvas = canvasRef.current;
  const hasSelection = canvas && !!canvas.getActiveObject();
  const items = hasSelection ? getObjectContextMenuItems() : getCanvasContextMenuItems();
  window.dispatchEvent(new CustomEvent('show-context-menu', { detail: { items, x, y } }));
};
```

Also update the import at the top of PresentationEditor.tsx to include the new exports:

```tsx
import { getObjectContextMenuItems, getCanvasContextMenuItems } from './ppt-context-menu';
```

(Remove the old `getObjectContextMenuItems` and `getCanvasContextMenuItems` if they were already imported.)

- [ ] **Step 7: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/presentation-editor/PresentationEditor.tsx && git commit -m "feat(ppt): wire slide operations, canvas ordering, cut, comments; fix contextmenu capture phase"
```

---

## Task 7: Flowchart — Rewrite diagram context menus + wire ordering + comments

**Files:**
- Modify: `src/components/diagram-editor/diagram-context-menu.ts`
- Modify: `src/components/diagram-editor/X6DiagramEditor.tsx`

### What to do

1. Rewrite `diagram-context-menu.ts`: node menu with copy/paste/delete/ordering/comment; empty area with paste/comment; remove edge menu (edges use Delete key only).
2. In `X6DiagramEditor.tsx`: update context menu handler to use multi-select-aware items; add `diagram:to-front/to-back/bring-forward/send-backward` handlers; wire `diagram:open-comments`.

- [ ] **Step 1: Rewrite `diagram-context-menu.ts`**

```typescript
import type { ContextMenuItem } from '@/lib/hooks/use-context-menu';

function dispatch(eventName: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/** Context menu for selected node(s) */
export function getNodeContextMenuItems(multiSelect: boolean): ContextMenuItem[] {
  return [
    {
      id: 'copy',
      label: 'Copy',
      shortcut: '⌘C',
      onClick: () => dispatch('diagram:copy'),
    },
    {
      id: 'paste',
      label: 'Paste',
      shortcut: '⌘V',
      onClick: () => dispatch('diagram:paste'),
    },
    {
      id: 'delete',
      label: 'Delete',
      shortcut: 'Del',
      danger: true,
      separator: true,
      onClick: () => dispatch('diagram:delete-selected'),
    },
    {
      id: 'to-front',
      label: 'Bring to front',
      separator: true,
      onClick: () => dispatch('diagram:to-front'),
    },
    {
      id: 'bring-forward',
      label: 'Bring forward',
      onClick: () => dispatch('diagram:bring-forward'),
    },
    {
      id: 'send-backward',
      label: 'Send backward',
      onClick: () => dispatch('diagram:send-backward'),
    },
    {
      id: 'to-back',
      label: 'Send to back',
      onClick: () => dispatch('diagram:to-back'),
    },
    ...(!multiSelect ? [{
      id: 'comment',
      label: 'Comment',
      separator: true,
      onClick: () => dispatch('diagram:open-comments'),
    }] : []),
  ];
}

/** Context menu for empty canvas area */
export function getCanvasContextMenuItems(): ContextMenuItem[] {
  return [
    {
      id: 'paste',
      label: 'Paste',
      shortcut: '⌘V',
      onClick: () => dispatch('diagram:paste'),
    },
    {
      id: 'comment',
      label: 'Comment',
      separator: true,
      onClick: () => dispatch('diagram:open-comments'),
    },
  ];
}
```

- [ ] **Step 2: Update `X6DiagramEditor.tsx` context menu handler**

In the context menu `useEffect` (~line 1276), update `getMenuItems` to use the new API:

```tsx
const getMenuItems = () => {
  const selected = graph.getSelectedCells();
  const selectedNodes = selected.filter(c => c.isNode());
  if (selectedNodes.length >= 1) {
    return getNodeContextMenuItems(selectedNodes.length > 1);
  }
  // For edges or empty: show canvas menu (no menu for edges per spec)
  return getCanvasContextMenuItems();
};
```

Also update the import at the top of `X6DiagramEditor.tsx`:

```tsx
import { getNodeContextMenuItems, getCanvasContextMenuItems } from './diagram-context-menu';
```

(Remove old `getEdgeContextMenuItems` import.)

- [ ] **Step 3: Add diagram ordering + comments handlers in `X6DiagramEditor.tsx`**

Find the keyboard handler `useEffect` (~line 914) or add a new `useEffect` for these events:

```tsx
useEffect(() => {
  if (!graph) return;

  const onToFront = () => {
    graph.getSelectedCells().filter(c => c.isNode()).forEach(n => n.toFront());
  };
  const onToBack = () => {
    graph.getSelectedCells().filter(c => c.isNode()).forEach(n => n.toBack());
  };
  const onBringForward = () => {
    graph.getSelectedCells().filter(c => c.isNode()).forEach(n => {
      const z = n.getZIndex() ?? 0;
      n.setZIndex(z + 1);
    });
  };
  const onSendBackward = () => {
    graph.getSelectedCells().filter(c => c.isNode()).forEach(n => {
      const z = n.getZIndex() ?? 0;
      n.setZIndex(Math.max(0, z - 1));
    });
  };
  const onOpenComments = () => {
    // X6DiagramEditor receives showComments as prop; dispatch up via callback
    window.dispatchEvent(new CustomEvent('diagram:open-comments-panel'));
  };

  window.addEventListener('diagram:to-front', onToFront);
  window.addEventListener('diagram:to-back', onToBack);
  window.addEventListener('diagram:bring-forward', onBringForward);
  window.addEventListener('diagram:send-backward', onSendBackward);
  window.addEventListener('diagram:open-comments', onOpenComments);

  return () => {
    window.removeEventListener('diagram:to-front', onToFront);
    window.removeEventListener('diagram:to-back', onToBack);
    window.removeEventListener('diagram:bring-forward', onBringForward);
    window.removeEventListener('diagram:send-backward', onSendBackward);
    window.removeEventListener('diagram:open-comments', onOpenComments);
  };
}, [graph]);
```

For the `diagram:open-comments-panel` event: find the parent component that hosts `X6DiagramEditor` and add a `window.addEventListener('diagram:open-comments-panel', ...)` that calls `setShowComments(true)`. Check `src/app/(workspace)/content/page.tsx` or the DiagramEditor wrapper for where `showComments` is controlled.

- [ ] **Step 4: Build check**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/diagram-editor/diagram-context-menu.ts src/components/diagram-editor/X6DiagramEditor.tsx && git commit -m "feat(diagram): rewrite context menus — ordering, comments, remove edge menu"
```

---

## Task 8: Final build verification + pm2 restart

- [ ] **Step 1: Full clean build**

```bash
cd /Users/mac/Documents/asuite/shell && npx next build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or similar. Zero TypeScript errors.

- [ ] **Step 2: Deploy**

```bash
pm2 restart asuite-shell
```

Expected: service restarts cleanly. Check with `pm2 status`.

- [ ] **Step 3: Smoke test in browser**

Open `https://asuite.gridtabs.com` and verify:
1. Sidebar: right-click a file → see 6 items (Open in new tab, Rename, Change icon, Copy link, Pin, Move to Trash)
2. Doc: right-click in editor → browser default menu appears
3. Table: right-click a cell (non-editing) → see 5 items; right-click while typing → browser menu
4. PPT SlidePanel: right-click a slide → see menu; Cmd+Click → multi-select
5. PPT canvas: right-click empty area → 3 items; right-click selected object → 9 items
6. Flowchart: right-click node → 8 items; right-click empty → 2 items

- [ ] **Step 4: Notify moonyaan and thinker**

Send completion message via Telegram and create a Thinker verification task.
