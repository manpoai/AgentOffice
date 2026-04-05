# Menu Data Layer Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all menu/toolbar data sources by introducing a shared Actions layer and Surfaces layer, eliminating duplicated operation logic across context menus, toolbars, and keyboard shortcuts.

**Architecture:** Two new directories: `src/actions/` (one file per entity type, each operation defined once with label/icon/execute) and `src/surfaces/` (surface configs mapping action IDs to UI surfaces). A bridge module converts `ActionDef + SurfaceConfig + ctx` into `ContextMenuItem[]` or `ToolbarItem[]`. Existing rendering layers (FloatingToolbar, ContextMenuProvider, ContentTopBar) remain unchanged.

**Tech Stack:** TypeScript, React, Lucide React icons, Fabric.js v6 (for PPT), AntV X6 (for Diagram), existing `ContextMenuItem` / `ContentMenuItem` / `ToolbarItem` interfaces.

**Spec document:** `doc_e19145e55d5dc307` — "菜单数据层统一架构 — 实施方案"

**Important API note:** Fabric.js v6 renamed layer-order methods from `obj.bringToFront()` to `canvas.bringObjectToFront(obj)` etc. All PPT actions must use the v6 API.

---

## File Map

### New files (create)
| Path | Responsibility |
|------|---------------|
| `src/actions/types.ts` | ActionDef, ToggleActionDef, DropdownActionDef, ColorActionDef types |
| `src/actions/entity-names.ts` | ENTITY_NAMES registry (doc/table/slides/diagram/agent) |
| `src/actions/color-palettes.ts` | PALETTES registry (text/fill/border/bg/highlight color sets) |
| `src/surfaces/types.ts` | SurfaceConfig type |
| `src/surfaces/bridge.ts` | toContextMenuItems(), toContentMenuItems(), toToolbarItems() |
| `src/actions/content-item.actions.ts` | Sidebar file node operations |
| `src/surfaces/content-item.surfaces.ts` | Sidebar contextMenu, moreButton, topBarMore surface configs |
| `src/actions/ppt-object.actions.ts` | PPT canvas object operations |
| `src/actions/ppt-slide.actions.ts` | PPT slide thumbnail operations |
| `src/surfaces/ppt.surfaces.ts` | PPT canvasEmpty, canvasObject, slideSingle, slideMulti surface configs |
| `src/actions/diagram-node.actions.ts` | Diagram node operations |
| `src/surfaces/diagram.surfaces.ts` | Diagram nodeMenu, canvasMenu surface configs |
| `src/actions/table-row.actions.ts` | Table row operations |
| `src/actions/table-column.actions.ts` | Table column operations |
| `src/surfaces/table.surfaces.ts` | Table cellMenu, headerMenu surface configs |

### Modified files
| Path | Change |
|------|--------|
| `src/lib/i18n/locales/en.json` | Add `entities.*` and `actions.*` keys |
| `src/lib/i18n/locales/zh.json` | Same keys in Chinese |
| `src/app/(workspace)/content/page.tsx` | Sidebar TreeNode: replace inline `getContextMenuItems` with bridge call |
| `src/components/shared/ContentTopBar.tsx` | No change to component — menuItems callers change |
| `src/components/presentation-editor/PresentationEditor.tsx` | Replace ppt:* event dispatch/listen with direct action.execute |
| `src/components/presentation-editor/ppt-context-menu.ts` | **Delete** |
| `src/components/diagram-editor/X6DiagramEditor.tsx` | Replace diagram:copy/paste/delete event listeners with direct calls |
| `src/components/diagram-editor/diagram-context-menu.ts` | **Delete** |
| `src/components/table-editor/TableEditor.tsx` | Replace table context menu with bridge call |
| `src/components/table-editor/table-context-menu.ts` | **Delete** |

---

## Phase 1: Infrastructure + Naming

### Task 1: Action type definitions

**Files:**
- Create: `src/actions/types.ts`

- [ ] **Step 1: Create `src/actions/types.ts`**

```typescript
import type { LucideIcon } from 'lucide-react';

export type Platform = 'desktop' | 'mobile' | 'all';

export type TFunc = (key: string, params?: Record<string, string | number>) => string;

export interface ActionDef<TCtx = unknown> {
  id: string;
  label: (t: TFunc, ctx?: TCtx) => string;
  icon?: LucideIcon | ((ctx?: TCtx) => LucideIcon);
  iconNode?: React.ReactNode;
  shortcut?: string;
  platform?: Platform;
  danger?: boolean;
  group?: string;
  execute: (ctx: TCtx) => void | Promise<void>;
}

export interface ToggleActionDef<TCtx = unknown> extends ActionDef<TCtx> {
  type: 'toggle';
  isActive: (ctx: TCtx) => boolean;
}

export interface DropdownActionDef<TCtx = unknown> extends ActionDef<TCtx> {
  type: 'dropdown';
  options: { value: string; label: string; icon?: LucideIcon }[];
  getValue: (ctx: TCtx) => string;
}

export interface ColorActionDef<TCtx = unknown> extends ActionDef<TCtx> {
  type: 'color';
  paletteKey: string;
  clearable?: boolean;
  getValue: (ctx: TCtx) => string;
}

export type AnyActionDef<TCtx = unknown> =
  | ActionDef<TCtx>
  | ToggleActionDef<TCtx>
  | DropdownActionDef<TCtx>
  | ColorActionDef<TCtx>;

export type ActionMap<TCtx = unknown> = Record<string, AnyActionDef<TCtx>>;

/** Build a lookup map from an array of actions */
export function buildActionMap<TCtx>(actions: AnyActionDef<TCtx>[]): ActionMap<TCtx> {
  return Object.fromEntries(actions.map(a => [a.id, a]));
}
```

- [ ] **Step 2: Create `src/surfaces/types.ts`**

```typescript
/** Ordered list of action IDs for a UI surface. '---' inserts a separator. */
export type SurfaceConfig = (string | '---')[];
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite/shell
git add src/actions/types.ts src/surfaces/types.ts
git commit -m "feat(actions): add ActionDef and SurfaceConfig type definitions"
```

---

### Task 2: Entity names registry + i18n

**Files:**
- Create: `src/actions/entity-names.ts`
- Modify: `src/lib/i18n/locales/en.json`
- Modify: `src/lib/i18n/locales/zh.json`

- [ ] **Step 1: Create `src/actions/entity-names.ts`**

```typescript
import { FileText, Table2, Presentation, GitBranch, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface EntityNameDef {
  singular: string;
  singularKey: string;
  createLabelKey: string;
  icon: LucideIcon;
  type: string;
}

export const ENTITY_NAMES: Record<string, EntityNameDef> = {
  doc: {
    singular: 'Doc',
    singularKey: 'entities.doc',
    createLabelKey: 'actions.newDoc',
    icon: FileText,
    type: 'doc',
  },
  table: {
    singular: 'Table',
    singularKey: 'entities.table',
    createLabelKey: 'actions.newTable',
    icon: Table2,
    type: 'table',
  },
  presentation: {
    singular: 'Slides',
    singularKey: 'entities.slides',
    createLabelKey: 'actions.newSlides',
    icon: Presentation,
    type: 'presentation',
  },
  diagram: {
    singular: 'Flowchart',
    singularKey: 'entities.flowchart',
    createLabelKey: 'actions.newFlowchart',
    icon: GitBranch,
    type: 'diagram',
  },
  agent: {
    singular: 'Agent',
    singularKey: 'entities.agent',
    createLabelKey: 'actions.newAgent',
    icon: Users,
    type: 'agent',
  },
};

export const CREATABLE_TYPES = ['doc', 'table', 'presentation', 'diagram'] as const;
export type CreatableType = typeof CREATABLE_TYPES[number];
```

- [ ] **Step 2: Add i18n keys to `en.json`**

In `src/lib/i18n/locales/en.json`, add a new top-level `"entities"` key and an `"actions"` key (or merge into existing `"actions"` if it exists). Add these entries:

```json
"entities": {
  "doc": "Doc",
  "table": "Table",
  "slides": "Slides",
  "flowchart": "Flowchart",
  "agent": "Agent"
},
"actions": {
  "newDoc": "New Doc",
  "newTable": "New Table",
  "newSlides": "New Slides",
  "newFlowchart": "New Flowchart",
  "newAgent": "New Agent",
  "openNewTab": "Open in new tab",
  "rename": "Rename",
  "changeIcon": "Change icon",
  "copyLink": "Copy link",
  "pin": "Pin to top",
  "unpin": "Unpin",
  "moveToTrash": "Move to Trash",
  "cut": "Cut",
  "copy": "Copy",
  "paste": "Paste",
  "delete": "Delete",
  "bringToFront": "Bring to front",
  "bringForward": "Bring forward",
  "sendBackward": "Send backward",
  "sendToBack": "Send to back",
  "comment": "Comment",
  "background": "Background settings",
  "openRecord": "Open record",
  "rowComments": "Comments",
  "deleteRecord": "Delete record",
  "sortAscending": "Sort ascending",
  "sortDescending": "Sort descending",
  "hideColumn": "Hide column",
  "deleteColumn": "Delete column"
}
```

- [ ] **Step 3: Add same keys to `zh.json`**

```json
"entities": {
  "doc": "文档",
  "table": "表格",
  "slides": "幻灯片",
  "flowchart": "流程图",
  "agent": "Agent"
},
"actions": {
  "newDoc": "新建文档",
  "newTable": "新建表格",
  "newSlides": "新建幻灯片",
  "newFlowchart": "新建流程图",
  "newAgent": "新建 Agent",
  "openNewTab": "在新标签页打开",
  "rename": "重命名",
  "changeIcon": "更改图标",
  "copyLink": "复制链接",
  "pin": "置顶",
  "unpin": "取消置顶",
  "moveToTrash": "移至回收站",
  "cut": "剪切",
  "copy": "复制",
  "paste": "粘贴",
  "delete": "删除",
  "bringToFront": "置于顶层",
  "bringForward": "上移一层",
  "sendBackward": "下移一层",
  "sendToBack": "置于底层",
  "comment": "评论",
  "background": "背景设置",
  "openRecord": "打开记录",
  "rowComments": "评论",
  "deleteRecord": "删除记录",
  "sortAscending": "升序排序",
  "sortDescending": "降序排序",
  "hideColumn": "隐藏列",
  "deleteColumn": "删除列"
}
```

- [ ] **Step 4: Build to verify no compile errors**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/actions/entity-names.ts src/lib/i18n/locales/en.json src/lib/i18n/locales/zh.json
git commit -m "feat(actions): add entity names registry and i18n keys"
```

---

### Task 3: Color palettes registry

**Files:**
- Create: `src/actions/color-palettes.ts`

- [ ] **Step 1: Create `src/actions/color-palettes.ts`**

Check what colors currently exist in `src/components/shared/FloatingToolbar/presets.ts` first:
```bash
grep -A 20 "fillColor\|textColor\|borderColor\|colors:" /Users/mac/Documents/asuite/shell/src/components/shared/FloatingToolbar/presets.ts | head -60
```

Then create the file with those colors unified:

```typescript
export interface ColorDef {
  name: string;
  value: string;
}

export const PALETTES: Record<string, ColorDef[]> = {
  /** Text color — PPT text, diagram node text */
  text: [
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#374151' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Light Gray', value: '#9ca3af' },
    { name: 'White', value: '#ffffff' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
  ],
  /** Fill/background color — PPT objects, diagram nodes */
  fill: [
    { name: 'White', value: '#ffffff' },
    { name: 'Light Blue', value: '#dbeafe' },
    { name: 'Light Green', value: '#dcfce7' },
    { name: 'Light Yellow', value: '#fef9c3' },
    { name: 'Light Red', value: '#fee2e2' },
    { name: 'Light Purple', value: '#f3e8ff' },
    { name: 'Light Gray', value: '#f3f4f6' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Dark', value: '#1f2937' },
  ],
  /** Border/stroke color */
  border: [
    { name: 'Dark Gray', value: '#374151' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Light Gray', value: '#d1d5db' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'None', value: 'transparent' },
  ],
  /** Slide/page background */
  background: [
    { name: 'White', value: '#ffffff' },
    { name: 'Off White', value: '#f8fafc' },
    { name: 'Light Blue', value: '#eff6ff' },
    { name: 'Light Green', value: '#f0fdf4' },
    { name: 'Light Yellow', value: '#fefce8' },
    { name: 'Dark', value: '#1e293b' },
    { name: 'Black', value: '#000000' },
  ],
};
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/color-palettes.ts
git commit -m "feat(actions): add unified color palettes registry"
```

---

### Task 4: Bridge functions

**Files:**
- Create: `src/surfaces/bridge.ts`

- [ ] **Step 1: Create `src/surfaces/bridge.ts`**

```typescript
import React from 'react';
import type { AnyActionDef, ActionMap, TFunc } from '@/actions/types';
import type { SurfaceConfig } from './types';
import type { ContextMenuItem } from '@/lib/hooks/use-context-menu';
import type { ContentMenuItem } from '@/components/shared/ContentTopBar';
import type { ToolbarItem } from '@/components/shared/FloatingToolbar/types';
import { PALETTES } from '@/actions/color-palettes';

function resolveIcon<TCtx>(action: AnyActionDef<TCtx>, ctx: TCtx): React.ReactNode {
  if (!action.icon) return action.iconNode ?? null;
  const Icon = typeof action.icon === 'function' ? action.icon(ctx) : action.icon;
  return React.createElement(Icon, { className: 'h-4 w-4' });
}

function resolveLabel<TCtx>(action: AnyActionDef<TCtx>, t: TFunc, ctx: TCtx): string {
  return action.label(t, ctx);
}

/**
 * Convert a surface config + action map into ContextMenuItem[] for ContextMenuProvider.
 * Used by: PPT canvas, Diagram canvas, Table right-click.
 */
export function toContextMenuItems<TCtx>(
  surface: SurfaceConfig,
  actions: ActionMap<TCtx>,
  ctx: TCtx,
  t: TFunc,
  isMobile = false,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  for (let i = 0; i < surface.length; i++) {
    const entry = surface[i];
    if (entry === '---') {
      if (items.length > 0) items[items.length - 1].separator = true;
      continue;
    }
    const action = actions[entry];
    if (!action) continue;
    if (action.platform === 'desktop' && isMobile) continue;
    if (action.platform === 'mobile' && !isMobile) continue;

    items.push({
      id: action.id,
      label: resolveLabel(action, t, ctx),
      icon: resolveIcon(action, ctx),
      shortcut: action.shortcut,
      danger: action.danger,
      onClick: () => action.execute(ctx),
    });
  }

  return items;
}

/**
 * Convert a surface config + action map into ContentMenuItem[] for ContentTopBar.
 * Used by: Sidebar tree node right-click, ContentTopBar ⋯ menu.
 */
export function toContentMenuItems<TCtx>(
  surface: SurfaceConfig,
  actions: ActionMap<TCtx>,
  ctx: TCtx,
  t: TFunc,
  isMobile = false,
): ContentMenuItem[] {
  const items: ContentMenuItem[] = [];

  for (const entry of surface) {
    if (entry === '---') {
      if (items.length > 0) items[items.length - 1].separator = true;
      continue;
    }
    const action = actions[entry];
    if (!action) continue;
    if (action.platform === 'desktop' && isMobile) continue;
    if (action.platform === 'mobile' && !isMobile) continue;

    const Icon = typeof action.icon === 'function' ? action.icon(ctx) : action.icon;
    if (!Icon) continue; // ContentMenuItem requires a component icon

    items.push({
      icon: Icon,
      label: resolveLabel(action, t, ctx),
      onClick: () => action.execute(ctx),
      danger: action.danger,
      shortcut: action.shortcut,
    });
  }

  return items;
}

/**
 * Convert a surface config + action map into ToolbarItem[] for FloatingToolbar.
 * Used by: PPT floating toolbar, Diagram floating toolbar.
 */
export function toToolbarItems<TCtx>(
  surface: SurfaceConfig,
  actions: ActionMap<TCtx>,
  ctx: TCtx,
  t: TFunc,
): ToolbarItem[] {
  const items: ToolbarItem[] = [];

  for (const entry of surface) {
    if (entry === '---') continue; // toolbar uses groups, not separators
    const action = actions[entry];
    if (!action) continue;

    const base = {
      key: action.id,
      icon: resolveIcon(action, ctx),
      label: resolveLabel(action, t, ctx),
      group: action.group ?? 'default',
    };

    if ('type' in action && action.type === 'toggle') {
      items.push({ ...base, type: 'toggle' });
    } else if ('type' in action && action.type === 'dropdown') {
      items.push({ ...base, type: 'dropdown', options: action.options });
    } else if ('type' in action && action.type === 'color') {
      items.push({
        ...base,
        type: 'color',
        colors: PALETTES[action.paletteKey] ?? [],
        colorClearable: action.clearable,
      });
    } else {
      items.push({ ...base, type: 'action' });
    }
  }

  return items;
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/surfaces/bridge.ts
git commit -m "feat(surfaces): add bridge functions (toContextMenuItems, toContentMenuItems, toToolbarItems)"
```

---

## Phase 2: Content Item Actions (Sidebar)

### Task 5: Content item actions + surface config

**Files:**
- Create: `src/actions/content-item.actions.ts`
- Create: `src/surfaces/content-item.surfaces.ts`

- [ ] **Step 1: Create `src/actions/content-item.actions.ts`**

```typescript
import { ExternalLink, Pencil, Smile, Link2, Pin, PinOff, Trash2 } from 'lucide-react';
import type { ActionDef } from './types';

export interface ContentItemCtx {
  id: string;
  type: string;
  title: string;
  pinned: boolean;
  url: string;
  startRename: () => void;
  openIconPicker: () => void;
  togglePin: () => void;
  deleteItem: () => void;
}

export const contentItemActions: ActionDef<ContentItemCtx>[] = [
  {
    id: 'open-new-tab',
    label: t => t('actions.openNewTab'),
    icon: ExternalLink,
    platform: 'desktop',
    group: 'navigate',
    execute: ctx => window.open(ctx.url, '_blank'),
  },
  {
    id: 'rename',
    label: t => t('actions.rename'),
    icon: Pencil,
    group: 'edit',
    execute: ctx => ctx.startRename(),
  },
  {
    id: 'change-icon',
    label: t => t('actions.changeIcon'),
    icon: Smile,
    group: 'edit',
    execute: ctx => ctx.openIconPicker(),
  },
  {
    id: 'copy-link',
    label: t => t('actions.copyLink'),
    icon: Link2,
    shortcut: '⌘⇧L',
    group: 'share',
    execute: ctx => navigator.clipboard.writeText(ctx.url).catch(() => {}),
  },
  {
    id: 'pin',
    label: (t, ctx) => ctx?.pinned ? t('actions.unpin') : t('actions.pin'),
    icon: (ctx) => ctx?.pinned ? PinOff : Pin,
    group: 'share',
    execute: ctx => ctx.togglePin(),
  },
  {
    id: 'delete',
    label: t => t('actions.moveToTrash'),
    icon: Trash2,
    danger: true,
    group: 'danger',
    execute: ctx => ctx.deleteItem(),
  },
];
```

- [ ] **Step 2: Create `src/surfaces/content-item.surfaces.ts`**

```typescript
import type { SurfaceConfig } from './types';

export const contentItemSurfaces = {
  /** Sidebar tree node right-click menu */
  contextMenu: [
    'open-new-tab',
    'rename',
    'change-icon',
    'copy-link',
    'pin',
    '---',
    'delete',
  ] as SurfaceConfig,

  /** ContentTopBar ⋯ menu */
  topBarMore: [
    'copy-link',
    'pin',
    '---',
    'delete',
  ] as SurfaceConfig,
};
```

- [ ] **Step 3: Build to verify**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/content-item.actions.ts src/surfaces/content-item.surfaces.ts
git commit -m "feat(actions): add content-item actions and surface configs"
```

---

### Task 6: Migrate sidebar TreeNode context menu

**Files:**
- Modify: `src/app/(workspace)/content/page.tsx`

The `TreeNodeContent` component (around line 1726) has an inline `getContextMenuItems` function. Replace it with a bridge call.

- [ ] **Step 1: Add imports to `content/page.tsx`**

Add near the top of the file (after existing imports):

```typescript
import { contentItemActions, type ContentItemCtx } from '@/actions/content-item.actions';
import { contentItemSurfaces } from '@/surfaces/content-item.surfaces';
import { toContextMenuItems } from '@/surfaces/bridge';
import { buildActionMap } from '@/actions/types';
```

- [ ] **Step 2: Add actionMap constant inside the `TreeNodeContent` component (or at module level if the component is a function)**

Find the `TreeNodeContent` component function (search for `const TreeNodeContent` or similar). Inside it, before the existing `getContextMenuItems`, add:

```typescript
const contentActionMap = buildActionMap(contentItemActions);
```

(This can be at module level to avoid recreation, since the action definitions never change.)

Actually place it at module level, outside any component:

```typescript
// At module level, after imports:
const contentActionMap = buildActionMap(contentItemActions);
```

- [ ] **Step 3: Replace `getContextMenuItems` in `TreeNodeContent`**

Find the current implementation (lines ~1726-1775) and replace with:

```typescript
const getContextMenuItems = useCallback((): ContextMenuItem[] => {
  const ctx: ContentItemCtx = {
    id: nodeId,
    type: node.type,
    title: node.title,
    pinned: node.pinned,
    url: `${window.location.origin}/content?id=${node.type}:${node.rawId}`,
    startRename: () => {
      setRenameValue(node.title);
      setIsRenaming(true);
      setTimeout(() => renameInputRef.current?.select(), 30);
    },
    openIconPicker: () => setShowIconPicker(true),
    togglePin: () => onTogglePin(nodeId),
    deleteItem: () => onRequestDelete(nodeId),
  };
  return toContextMenuItems(contentItemSurfaces.contextMenu, contentActionMap, ctx, t, isMobile);
}, [node.pinned, node.rawId, node.type, node.title, nodeId, isMobile, onTogglePin, onRequestDelete, t]);
```

- [ ] **Step 4: Remove now-unused icon imports from content/page.tsx**

Check if `ExternalLink`, `Pencil`, `Smile`, `Link2`, `Pin`, `PinOff` are used elsewhere in the file. If not used outside the deleted `getContextMenuItems`, remove them from the import line.

```bash
grep -n "ExternalLink\|<Pencil\|<Smile\|<Link2\|<Pin\b\|<PinOff" /Users/mac/Documents/asuite/shell/src/app/\(workspace\)/content/page.tsx | grep -v "import"
```

Remove any that only appear in the deleted block.

- [ ] **Step 5: Build and verify**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(workspace\)/content/page.tsx
git commit -m "feat(sidebar): migrate TreeNode context menu to actions+bridge"
```

---

## Phase 3: PPT Actions

### Task 7: PPT object + slide action definitions

**Files:**
- Create: `src/actions/ppt-object.actions.ts`
- Create: `src/actions/ppt-slide.actions.ts`
- Create: `src/surfaces/ppt.surfaces.ts`

- [ ] **Step 1: Create `src/actions/ppt-object.actions.ts`**

Note: Use Fabric v6 API — `canvas.bringObjectToFront(obj)` not `obj.bringToFront()`.

```typescript
import {
  Copy, ClipboardPaste, Scissors, Trash2,
  ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine, MessageSquare,
} from 'lucide-react';
import type { ActionDef } from './types';

export interface PPTObjectCtx {
  canvas: any; // fabric.Canvas (v6)
  activeObject: any; // fabric.FabricObject
  clipboardRef: React.MutableRefObject<any>;
  setShowComments: (v: boolean) => void;
}

export const pptObjectActions: ActionDef<PPTObjectCtx>[] = [
  {
    id: 'ppt-cut',
    label: t => t('actions.cut'),
    icon: Scissors,
    shortcut: '⌘X',
    group: 'clipboard',
    execute: async ctx => {
      const { canvas, activeObject, clipboardRef } = ctx;
      canvas.fire('before:modified', { target: activeObject });
      const cloned = await activeObject.clone();
      clipboardRef.current = cloned;
      canvas.remove(activeObject);
      canvas.renderAll();
      canvas.fire('object:modified', { target: activeObject });
    },
  },
  {
    id: 'ppt-copy',
    label: t => t('actions.copy'),
    icon: Copy,
    shortcut: '⌘C',
    group: 'clipboard',
    execute: async ctx => {
      const cloned = await ctx.activeObject.clone();
      ctx.clipboardRef.current = cloned;
    },
  },
  {
    id: 'ppt-paste',
    label: t => t('actions.paste'),
    icon: ClipboardPaste,
    shortcut: '⌘V',
    group: 'clipboard',
    execute: async ctx => {
      const { canvas, clipboardRef } = ctx;
      const src = clipboardRef.current;
      if (!src) return;
      const pasted = await src.clone();
      canvas.fire('before:modified', { target: pasted });
      pasted.set({ left: (pasted.left || 0) + 20, top: (pasted.top || 0) + 20, evented: true });
      canvas.add(pasted);
      canvas.setActiveObject(pasted);
      canvas.renderAll();
      canvas.fire('object:modified', { target: pasted });
    },
  },
  {
    id: 'ppt-delete',
    label: t => t('actions.delete'),
    icon: Trash2,
    shortcut: 'Delete',
    danger: true,
    group: 'danger',
    execute: ctx => {
      const { canvas, activeObject } = ctx;
      canvas.fire('before:modified', { target: activeObject });
      canvas.remove(activeObject);
      canvas.renderAll();
      canvas.fire('object:modified', { target: activeObject });
    },
  },
  {
    id: 'ppt-bring-to-front',
    label: t => t('actions.bringToFront'),
    icon: ArrowUpToLine,
    group: 'zorder',
    execute: ctx => {
      ctx.canvas.fire('before:modified', { target: ctx.activeObject });
      ctx.canvas.bringObjectToFront(ctx.activeObject);
      ctx.canvas.renderAll();
      ctx.canvas.fire('object:modified', { target: ctx.activeObject });
    },
  },
  {
    id: 'ppt-bring-forward',
    label: t => t('actions.bringForward'),
    icon: ArrowUp,
    group: 'zorder',
    execute: ctx => {
      ctx.canvas.fire('before:modified', { target: ctx.activeObject });
      ctx.canvas.bringObjectForward(ctx.activeObject);
      ctx.canvas.renderAll();
      ctx.canvas.fire('object:modified', { target: ctx.activeObject });
    },
  },
  {
    id: 'ppt-send-backward',
    label: t => t('actions.sendBackward'),
    icon: ArrowDown,
    group: 'zorder',
    execute: ctx => {
      ctx.canvas.fire('before:modified', { target: ctx.activeObject });
      ctx.canvas.sendObjectBackwards(ctx.activeObject);
      ctx.canvas.renderAll();
      ctx.canvas.fire('object:modified', { target: ctx.activeObject });
    },
  },
  {
    id: 'ppt-send-to-back',
    label: t => t('actions.sendToBack'),
    icon: ArrowDownToLine,
    group: 'zorder',
    execute: ctx => {
      ctx.canvas.fire('before:modified', { target: ctx.activeObject });
      ctx.canvas.sendObjectToBack(ctx.activeObject);
      ctx.canvas.renderAll();
      ctx.canvas.fire('object:modified', { target: ctx.activeObject });
    },
  },
  {
    id: 'ppt-comment',
    label: t => t('actions.comment'),
    icon: MessageSquare,
    group: 'other',
    execute: ctx => ctx.setShowComments(true),
  },
];

export interface PPTCanvasCtx {
  canvas: any;
  clipboardRef: React.MutableRefObject<any>;
  setShowComments: (v: boolean) => void;
  openBackground: () => void;
}

export const pptCanvasActions: ActionDef<PPTCanvasCtx>[] = [
  {
    id: 'ppt-canvas-paste',
    label: t => t('actions.paste'),
    icon: ClipboardPaste,
    shortcut: '⌘V',
    group: 'clipboard',
    execute: async ctx => {
      const { canvas, clipboardRef } = ctx;
      const src = clipboardRef.current;
      if (!src) return;
      const pasted = await src.clone();
      canvas.fire('before:modified', { target: pasted });
      pasted.set({ left: (pasted.left || 0) + 20, top: (pasted.top || 0) + 20, evented: true });
      canvas.add(pasted);
      canvas.setActiveObject(pasted);
      canvas.renderAll();
      canvas.fire('object:modified', { target: pasted });
    },
  },
  {
    id: 'ppt-canvas-background',
    label: t => t('actions.background'),
    icon: ArrowUpToLine, // placeholder — import Settings from lucide instead
    group: 'canvas',
    execute: ctx => ctx.openBackground(),
  },
  {
    id: 'ppt-canvas-comment',
    label: t => t('actions.comment'),
    icon: MessageSquare,
    group: 'other',
    execute: ctx => ctx.setShowComments(true),
  },
];
```

Note: For `ppt-canvas-background`, replace `ArrowUpToLine` with `Settings` from lucide-react (import `Settings`).

- [ ] **Step 2: Create `src/actions/ppt-slide.actions.ts`**

```typescript
import { Scissors, Copy, ClipboardPaste, Trash2, CopyPlus, Settings, MessageSquare } from 'lucide-react';
import type { ActionDef } from './types';

export interface PPTSlideCtx {
  slideIndex: number;
  isMultiSelect: boolean;
  onSlideCut: (i: number) => void;
  onSlideCopy: (i: number) => void;
  onSlidePaste: (i: number) => void;
  onSlideDelete: (i: number) => void;
  onSlideDuplicate: (i: number) => void;
  onSlideBackground: (i: number) => void;
  onSlideComment: (i: number) => void;
}

export const pptSlideActions: ActionDef<PPTSlideCtx>[] = [
  {
    id: 'slide-cut',
    label: t => t('actions.cut'),
    icon: Scissors,
    group: 'clipboard',
    execute: ctx => ctx.onSlideCut(ctx.slideIndex),
  },
  {
    id: 'slide-copy',
    label: t => t('actions.copy'),
    icon: Copy,
    group: 'clipboard',
    execute: ctx => ctx.onSlideCopy(ctx.slideIndex),
  },
  {
    id: 'slide-paste',
    label: t => t('actions.paste'),
    icon: ClipboardPaste,
    group: 'clipboard',
    execute: ctx => ctx.onSlidePaste(ctx.slideIndex),
  },
  {
    id: 'slide-delete',
    label: t => t('actions.delete'),
    icon: Trash2,
    danger: true,
    group: 'danger',
    execute: ctx => ctx.onSlideDelete(ctx.slideIndex),
  },
  {
    id: 'slide-duplicate',
    label: t => t('actions.copy'),
    icon: CopyPlus,
    group: 'edit',
    execute: ctx => ctx.onSlideDuplicate(ctx.slideIndex),
  },
  {
    id: 'slide-background',
    label: t => t('actions.background'),
    icon: Settings,
    group: 'canvas',
    execute: ctx => ctx.onSlideBackground(ctx.slideIndex),
  },
  {
    id: 'slide-comment',
    label: t => t('actions.comment'),
    icon: MessageSquare,
    group: 'other',
    execute: ctx => ctx.onSlideComment(ctx.slideIndex),
  },
];
```

- [ ] **Step 3: Create `src/surfaces/ppt.surfaces.ts`**

```typescript
import type { SurfaceConfig } from './types';

export const pptSurfaces = {
  /** Canvas: empty area right-click */
  canvasEmpty: [
    'ppt-canvas-paste',
    '---',
    'ppt-canvas-background',
    'ppt-canvas-comment',
  ] as SurfaceConfig,

  /** Canvas: selected object right-click */
  canvasObject: [
    'ppt-cut',
    'ppt-copy',
    'ppt-paste',
    '---',
    'ppt-delete',
    '---',
    'ppt-bring-to-front',
    'ppt-bring-forward',
    'ppt-send-backward',
    'ppt-send-to-back',
    '---',
    'ppt-comment',
  ] as SurfaceConfig,

  /** Slide thumbnail: single selection right-click */
  slideSingle: [
    'slide-cut',
    'slide-copy',
    'slide-paste',
    '---',
    'slide-delete',
    'slide-duplicate',
    '---',
    'slide-background',
    'slide-comment',
  ] as SurfaceConfig,

  /** Slide thumbnail: multi-selection right-click */
  slideMulti: [
    'slide-cut',
    'slide-copy',
    'slide-paste',
    '---',
    'slide-delete',
    'slide-duplicate',
    '---',
    'slide-background',
  ] as SurfaceConfig,
};
```

- [ ] **Step 4: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/actions/ppt-object.actions.ts src/actions/ppt-slide.actions.ts src/surfaces/ppt.surfaces.ts
git commit -m "feat(actions): add PPT object/slide actions and surface configs"
```

---

### Task 8: Migrate PresentationEditor to use actions directly

**Files:**
- Modify: `src/components/presentation-editor/PresentationEditor.tsx`
- Delete: `src/components/presentation-editor/ppt-context-menu.ts`

The goal is to eliminate the `ppt:*` CustomEvent dispatch/listen pattern for copy/paste/cut/delete/z-order and replace with direct `action.execute(ctx)` calls. The keyboard shortcut handler and the context menu `showMenu` function will both call the same action's execute.

- [ ] **Step 1: Add imports to PresentationEditor.tsx**

```typescript
import { pptObjectActions, pptCanvasActions, type PPTObjectCtx, type PPTCanvasCtx } from '@/actions/ppt-object.actions';
import { pptSlideActions, type PPTSlideCtx } from '@/actions/ppt-slide.actions';
import { pptSurfaces } from '@/surfaces/ppt.surfaces';
import { toContextMenuItems } from '@/surfaces/bridge';
import { buildActionMap } from '@/actions/types';
import { useT } from '@/lib/i18n';
```

- [ ] **Step 2: Add action maps at module level (outside component)**

```typescript
const pptObjectActionMap = buildActionMap(pptObjectActions);
const pptCanvasActionMap = buildActionMap(pptCanvasActions);
const pptSlideActionMap = buildActionMap(pptSlideActions);
```

- [ ] **Step 3: Replace `showMenu` in the context menu useEffect**

Find the `showMenu` function (around line 451) and replace:

```typescript
const showMenu = (x: number, y: number) => {
  const canvas = canvasRef.current;
  const activeObj = canvas?.getActiveObject();

  let items;
  if (activeObj) {
    const ctx: PPTObjectCtx = {
      canvas,
      activeObject: activeObj,
      clipboardRef,
      setShowComments: (v) => { setShowCommentPanel(v); },
    };
    items = toContextMenuItems(pptSurfaces.canvasObject, pptObjectActionMap, ctx, t);
  } else {
    const ctx: PPTCanvasCtx = {
      canvas,
      clipboardRef,
      setShowComments: (v) => { setShowCommentPanel(v); },
      openBackground: () => {
        canvas?.discardActiveObject();
        canvas?.renderAll();
        setShowPropertyPanel(true);
        setPropVersion(v => v + 1);
      },
    };
    items = toContextMenuItems(pptSurfaces.canvasEmpty, pptCanvasActionMap, ctx, t);
  }

  if (items.length > 0) {
    window.dispatchEvent(new CustomEvent('show-context-menu', { detail: { items, x, y } }));
  }
};
```

Note: Replace `setShowCommentPanel` with the actual comment panel state setter name used in the file (search for `showComments` state setter).

- [ ] **Step 4: Replace keyboard handlers for copy/paste/cut/delete/z-order**

Find the keyboard useEffect (around `onKeyDown`). Replace the inline handlers for `⌘C/X/V` and the ordering operations with action calls:

```typescript
const buildObjectCtx = (): PPTObjectCtx | null => {
  const canvas = canvasRef.current;
  const activeObject = canvas?.getActiveObject();
  if (!canvas || !activeObject) return null;
  return {
    canvas,
    activeObject,
    clipboardRef,
    setShowComments: (v) => { /* your comment panel setter */ },
  };
};

// In onKeyDown, replace the c/x/v branches:
} else if (e.key === 'c' && !isFabricTextEditing) {
  const ctx = buildObjectCtx();
  if (!ctx) return;
  e.preventDefault();
  pptObjectActionMap['ppt-copy'].execute(ctx);
} else if (e.key === 'x' && !isFabricTextEditing) {
  const ctx = buildObjectCtx();
  if (!ctx) return;
  e.preventDefault();
  pptObjectActionMap['ppt-cut'].execute(ctx);
} else if (e.key === 'v' && !isFabricTextEditing) {
  if (!canvasRef.current || !clipboardRef.current) return;
  e.preventDefault();
  const ctx: PPTCanvasCtx = {
    canvas: canvasRef.current,
    clipboardRef,
    setShowComments: () => {},
    openBackground: () => {},
  };
  pptCanvasActionMap['ppt-canvas-paste'].execute(ctx);
}
```

- [ ] **Step 5: Remove the ppt:* event listener useEffect**

Find the useEffect that registers `ppt:bring-to-front`, `ppt:bring-forward`, `ppt:send-backward`, `ppt:send-to-back`, `ppt:cut`, `ppt:copy`, `ppt:paste`, `ppt:delete-selected`, `ppt:open-background` listeners. Remove the entire useEffect block.

Also remove the `onBringToFront`, `onBringForward`, `onSendBackward`, `onSendToBack`, `onCut`, `onCopy`, `onPaste`, `onDelete`, `onOpenBackground` function definitions inside it.

- [ ] **Step 6: Update SlidePanel context menu**

Find where `SlidePanel` gets its context menu items (search for `getContextMenuItems` near `SlidePanel` usage or the component itself). If it still uses `dispatch('ppt:slide-*')`, replace with direct action calls using `pptSlideActionMap`.

Check `SlidePanel.tsx`:
```bash
grep -n "dispatch\|contextmenu\|getContextMenu\|ppt:slide" /Users/mac/Documents/asuite/shell/src/components/presentation-editor/SlidePanel.tsx | head -20
```

If SlidePanel still dispatches `ppt:slide-copy` etc., and those listeners are in PresentationEditor, keep the dispatch pattern for slides (or migrate similarly).

- [ ] **Step 7: Delete `ppt-context-menu.ts`**

```bash
rm /Users/mac/Documents/asuite/shell/src/components/presentation-editor/ppt-context-menu.ts
```

Verify no imports remain:
```bash
grep -r "ppt-context-menu" /Users/mac/Documents/asuite/shell/src --include="*.ts" --include="*.tsx"
```

- [ ] **Step 8: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -10
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ppt): migrate context menu and keyboard shortcuts to actions+bridge, remove ppt-context-menu.ts"
```

---

## Phase 4: Diagram Actions

### Task 9: Diagram node action definitions + surface config

**Files:**
- Create: `src/actions/diagram-node.actions.ts`
- Create: `src/surfaces/diagram.surfaces.ts`

- [ ] **Step 1: Create `src/actions/diagram-node.actions.ts`**

```typescript
import { Copy, ClipboardPaste, Trash2, ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine, MessageSquare } from 'lucide-react';
import type { ActionDef } from './types';
import type { Graph, Cell } from '@antv/x6';

export interface DiagramNodeCtx {
  graph: Graph;
  cell: Cell;
}

export const diagramNodeActions: ActionDef<DiagramNodeCtx>[] = [
  {
    id: 'diagram-copy',
    label: t => t('actions.copy'),
    icon: Copy,
    shortcut: '⌘C',
    group: 'clipboard',
    execute: ctx => ctx.graph.copy([ctx.cell]),
  },
  {
    id: 'diagram-paste',
    label: t => t('actions.paste'),
    icon: ClipboardPaste,
    shortcut: '⌘V',
    group: 'clipboard',
    execute: ctx => {
      const cells = ctx.graph.paste({ offset: 20 });
      if (cells.length) {
        ctx.graph.cleanSelection();
        ctx.graph.select(cells);
      }
    },
  },
  {
    id: 'diagram-delete',
    label: t => t('actions.delete'),
    icon: Trash2,
    shortcut: 'Del',
    danger: true,
    group: 'danger',
    execute: ctx => ctx.graph.removeCells([ctx.cell]),
  },
  {
    id: 'diagram-to-front',
    label: t => t('actions.bringToFront'),
    icon: ArrowUpToLine,
    group: 'zorder',
    execute: ctx => ctx.cell.toFront(),
  },
  {
    id: 'diagram-bring-forward',
    label: t => t('actions.bringForward'),
    icon: ArrowUp,
    group: 'zorder',
    execute: ctx => ctx.cell.toFront(), // X6 does not have bringForward, use toFront
  },
  {
    id: 'diagram-send-backward',
    label: t => t('actions.sendBackward'),
    icon: ArrowDown,
    group: 'zorder',
    execute: ctx => ctx.cell.toBack(), // X6 does not have sendBackward, use toBack
  },
  {
    id: 'diagram-to-back',
    label: t => t('actions.sendToBack'),
    icon: ArrowDownToLine,
    group: 'zorder',
    execute: ctx => ctx.cell.toBack(),
  },
  {
    id: 'diagram-comment',
    label: t => t('actions.comment'),
    icon: MessageSquare,
    group: 'other',
    execute: _ctx => window.dispatchEvent(new CustomEvent('diagram:open-comments')),
  },
];

export interface DiagramCanvasCtx {
  graph: Graph;
}

export const diagramCanvasActions: ActionDef<DiagramCanvasCtx>[] = [
  {
    id: 'diagram-canvas-paste',
    label: t => t('actions.paste'),
    icon: ClipboardPaste,
    shortcut: '⌘V',
    group: 'clipboard',
    execute: ctx => {
      const cells = ctx.graph.paste({ offset: 20 });
      if (cells.length) {
        ctx.graph.cleanSelection();
        ctx.graph.select(cells);
      }
    },
  },
  {
    id: 'diagram-canvas-comment',
    label: t => t('actions.comment'),
    icon: MessageSquare,
    group: 'other',
    execute: _ctx => window.dispatchEvent(new CustomEvent('diagram:open-comments')),
  },
];
```

- [ ] **Step 2: Create `src/surfaces/diagram.surfaces.ts`**

```typescript
import type { SurfaceConfig } from './types';

export const diagramSurfaces = {
  /** Selected node right-click */
  nodeMenu: [
    'diagram-copy',
    'diagram-paste',
    '---',
    'diagram-delete',
    '---',
    'diagram-to-front',
    'diagram-bring-forward',
    'diagram-send-backward',
    'diagram-to-back',
    '---',
    'diagram-comment',
  ] as SurfaceConfig,

  /** Empty canvas right-click */
  canvasMenu: [
    'diagram-canvas-paste',
    '---',
    'diagram-canvas-comment',
  ] as SurfaceConfig,
};
```

- [ ] **Step 3: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/diagram-node.actions.ts src/surfaces/diagram.surfaces.ts
git commit -m "feat(actions): add diagram node/canvas actions and surface configs"
```

---

### Task 10: Migrate X6DiagramEditor to use actions directly

**Files:**
- Modify: `src/components/diagram-editor/X6DiagramEditor.tsx`
- Delete: `src/components/diagram-editor/diagram-context-menu.ts`

- [ ] **Step 1: Add imports to X6DiagramEditor.tsx**

```typescript
import { diagramNodeActions, diagramCanvasActions, type DiagramNodeCtx, type DiagramCanvasCtx } from '@/actions/diagram-node.actions';
import { diagramSurfaces } from '@/surfaces/diagram.surfaces';
import { toContextMenuItems } from '@/surfaces/bridge';
import { buildActionMap } from '@/actions/types';
```

- [ ] **Step 2: Add action maps at module level**

```typescript
const diagramNodeActionMap = buildActionMap(diagramNodeActions);
const diagramCanvasActionMap = buildActionMap(diagramCanvasActions);
```

- [ ] **Step 3: Replace `onContextMenu` handler in X6DiagramEditor**

Find where the context menu is shown on right-click of nodes (search for `getNodeContextMenuItems` or `show-context-menu` dispatch in this file). Replace with:

```typescript
// For node right-click:
const nodeCtx: DiagramNodeCtx = { graph, cell: selectedCell };
const items = toContextMenuItems(diagramSurfaces.nodeMenu, diagramNodeActionMap, nodeCtx, t);
window.dispatchEvent(new CustomEvent('show-context-menu', { detail: { items, x, y } }));

// For canvas right-click:
const canvasCtx: DiagramCanvasCtx = { graph };
const items = toContextMenuItems(diagramSurfaces.canvasMenu, diagramCanvasActionMap, canvasCtx, t);
window.dispatchEvent(new CustomEvent('show-context-menu', { detail: { items, x, y } }));
```

- [ ] **Step 4: Replace keyboard shortcut handlers for copy/paste/delete**

Find the `onCopy` and `onPaste` event handlers in the useEffect that listens to `diagram:copy` and `diagram:paste`. Replace the direct `graph.copy/paste` calls with action executes. Or better: since the DIAGRAM_SHORTCUTS already dispatch `diagram:copy` etc., update the `onCopy`/`onPaste` handlers inside the `useEffect` to use action maps:

```typescript
const onCopy = () => {
  const cells = graph?.getSelectedCells();
  if (!cells?.length || !graph) return;
  const ctx: DiagramNodeCtx = { graph, cell: cells[0] };
  diagramNodeActionMap['diagram-copy'].execute(ctx);
};

const onPaste = () => {
  if (!graph) return;
  const ctx: DiagramCanvasCtx = { graph };
  diagramCanvasActionMap['diagram-canvas-paste'].execute(ctx);
};

const onDeleteSelected = () => {
  const cells = graph?.getSelectedCells();
  if (!cells?.length || !graph) return;
  graph.removeCells(cells);
};
```

- [ ] **Step 5: Delete `diagram-context-menu.ts`**

```bash
rm /Users/mac/Documents/asuite/shell/src/components/diagram-editor/diagram-context-menu.ts
```

Verify:
```bash
grep -r "diagram-context-menu" /Users/mac/Documents/asuite/shell/src --include="*.ts" --include="*.tsx"
```

- [ ] **Step 6: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(diagram): migrate context menu to actions+bridge, remove diagram-context-menu.ts"
```

---

## Phase 5: Table Actions

### Task 11: Table action definitions + surface config

**Files:**
- Create: `src/actions/table-row.actions.ts`
- Create: `src/actions/table-column.actions.ts`
- Create: `src/surfaces/table.surfaces.ts`

- [ ] **Step 1: Create `src/actions/table-row.actions.ts`**

```typescript
import { ExternalLink, MessageSquare, Trash2 } from 'lucide-react';
import type { ActionDef } from './types';

export interface TableRowCtx {
  rowId: number;
  rowIdx: number;
  openRecord: (rowIdx: number) => void;
  openComments: (rowIdx: number) => void;
  deleteRecord: (rowId: number) => void;
}

export const tableRowActions: ActionDef<TableRowCtx>[] = [
  {
    id: 'table-open-record',
    label: t => t('actions.openRecord'),
    icon: ExternalLink,
    group: 'navigate',
    execute: ctx => ctx.openRecord(ctx.rowIdx),
  },
  {
    id: 'table-row-comments',
    label: t => t('actions.rowComments'),
    icon: MessageSquare,
    group: 'other',
    execute: ctx => ctx.openComments(ctx.rowIdx),
  },
  {
    id: 'table-delete-record',
    label: t => t('actions.deleteRecord'),
    icon: Trash2,
    danger: true,
    group: 'danger',
    execute: ctx => ctx.deleteRecord(ctx.rowId),
  },
];
```

- [ ] **Step 2: Create `src/actions/table-column.actions.ts`**

```typescript
import { ArrowUp, ArrowDown, EyeOff, Trash2 } from 'lucide-react';
import type { ActionDef } from './types';

export interface TableColumnCtx {
  colKey: string;
  sortColumn: (colKey: string, dir: 'asc' | 'desc') => void;
  hideColumn: (colKey: string) => void;
  deleteColumn: (colKey: string) => void;
}

export const tableColumnActions: ActionDef<TableColumnCtx>[] = [
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
```

- [ ] **Step 3: Create `src/surfaces/table.surfaces.ts`**

```typescript
import type { SurfaceConfig } from './types';

export const tableSurfaces = {
  /** Cell right-click */
  cellMenu: [
    'table-open-record',
    'table-row-comments',
    '---',
    'table-delete-record',
  ] as SurfaceConfig,

  /** Column header right-click */
  headerMenu: [
    'table-sort-asc',
    'table-sort-desc',
    '---',
    'table-hide-column',
    '---',
    'table-delete-column',
  ] as SurfaceConfig,
};
```

- [ ] **Step 4: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/actions/table-row.actions.ts src/actions/table-column.actions.ts src/surfaces/table.surfaces.ts
git commit -m "feat(actions): add table row/column actions and surface configs"
```

---

### Task 12: Migrate TableEditor context menu

**Files:**
- Modify: `src/components/table-editor/TableEditor.tsx`
- Delete: `src/components/table-editor/table-context-menu.ts`

- [ ] **Step 1: Add imports to TableEditor.tsx**

```typescript
import { tableRowActions, type TableRowCtx } from '@/actions/table-row.actions';
import { tableColumnActions, type TableColumnCtx } from '@/actions/table-column.actions';
import { tableSurfaces } from '@/surfaces/table.surfaces';
import { toContextMenuItems } from '@/surfaces/bridge';
import { buildActionMap } from '@/actions/types';
```

- [ ] **Step 2: Add action maps at module level**

```typescript
const tableRowActionMap = buildActionMap(tableRowActions);
const tableColumnActionMap = buildActionMap(tableColumnActions);
```

- [ ] **Step 3: Find the `onContextMenu` handler in TableEditor**

Currently (around line 550-580), it calls `getCellContextMenuItems(rowId, rowIdx)` and `getHeaderContextMenuItems(col.title)`. Replace:

```typescript
// Cell right-click:
const ctx: TableRowCtx = {
  rowId,
  rowIdx,
  openRecord: (idx) => { setExpandWithComments(false); setExpandedRowIdx(idx); },
  openComments: (idx) => { setExpandWithComments(true); setExpandedRowIdx(idx); },
  deleteRecord: (id) => handleDeleteRow(id),
};
showMenu(toContextMenuItems(tableSurfaces.cellMenu, tableRowActionMap, ctx, t), e.clientX, e.clientY);

// Header right-click:
const ctx: TableColumnCtx = {
  colKey: col.title,
  sortColumn: (key, dir) => window.dispatchEvent(new CustomEvent('table:sort', { detail: { colKey: key, dir } })),
  hideColumn: (key) => window.dispatchEvent(new CustomEvent('table:hide-column', { detail: { colKey: key } })),
  deleteColumn: (key) => window.dispatchEvent(new CustomEvent('table:delete-column', { detail: { colKey: key } })),
};
showMenu(toContextMenuItems(tableSurfaces.headerMenu, tableColumnActionMap, ctx, t), e.clientX, e.clientY);
```

Note: `handleDeleteRow` is declared after the useEffect — use `handleDeleteRowRef.current(id)` to avoid TDZ.

- [ ] **Step 4: Remove the now-unused event listener useEffect for table:open-record/row-comments/delete-record**

Since the actions now call callbacks directly, the `window.addEventListener('table:open-record', ...)` useEffect is no longer needed. Remove it along with `handleDeleteRowRef`.

Also remove the `table-context-menu` import.

- [ ] **Step 5: Delete `table-context-menu.ts`**

```bash
rm /Users/mac/Documents/asuite/shell/src/components/table-editor/table-context-menu.ts
```

Verify:
```bash
grep -r "table-context-menu" /Users/mac/Documents/asuite/shell/src --include="*.ts" --include="*.tsx"
```

- [ ] **Step 6: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(table): migrate context menu to actions+bridge, remove table-context-menu.ts"
```

---

## Phase 6: Color Unification

### Task 13: Replace hardcoded colors in FloatingToolbar presets with PALETTES

**Files:**
- Modify: `src/components/shared/FloatingToolbar/presets.ts`

- [ ] **Step 1: Audit existing color arrays**

```bash
grep -n "colors:" /Users/mac/Documents/asuite/shell/src/components/shared/FloatingToolbar/presets.ts | head -20
```

- [ ] **Step 2: Replace hardcoded arrays with PALETTES references**

In `presets.ts`, add import:

```typescript
import { PALETTES } from '@/actions/color-palettes';
```

Then replace each inline `colors: [...]` array with the appropriate palette:
- Fill color arrays → `colors: PALETTES.fill`
- Text color arrays → `colors: PALETTES.text`
- Border color arrays → `colors: PALETTES.border`

Update `PALETTES` in `color-palettes.ts` if the actual colors in presets.ts differ — keep the canonical list accurate.

- [ ] **Step 3: Build**

```bash
cd /Users/mac/Documents/asuite/shell && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/FloatingToolbar/presets.ts src/actions/color-palettes.ts
git commit -m "feat(colors): replace hardcoded color arrays with unified PALETTES registry"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| types.ts | Task 1 |
| entity-names.ts | Task 2 |
| color-palettes.ts | Task 3 |
| surfaces/types.ts + bridge.ts | Task 1 + Task 4 |
| content-item.actions.ts | Task 5 |
| content-item.surfaces.ts | Task 5 |
| Sidebar migration | Task 6 |
| ppt-object.actions.ts | Task 7 |
| ppt-slide.actions.ts | Task 7 |
| ppt.surfaces.ts | Task 7 |
| PPT migration | Task 8 |
| diagram-node.actions.ts | Task 9 |
| diagram.surfaces.ts | Task 9 |
| Diagram migration | Task 10 |
| table-row.actions.ts | Task 11 |
| table-column.actions.ts | Task 11 |
| table.surfaces.ts | Task 11 |
| Table migration | Task 12 |
| Color unification | Task 13 |
| i18n keys | Task 2 |
| Delete old files | Tasks 8, 10, 12 |

**Phase 6 acceptance checklist from spec:**
- [ ] All right-click menus functional (PPT, Diagram, Table, Sidebar)
- [ ] All keyboard shortcuts functional
- [ ] `npm run build` passes
- [ ] Old context-menu files deleted
- [ ] No hardcoded entity names outside i18n files

**Known issue in spec:** Section 7 (PPT Actions example) uses Fabric v5 API (`obj.bringToFront()`). This plan uses v6 API throughout (`canvas.bringObjectToFront(obj)`). ✓

**Fabric v5→v6 API reference (for implementer):**
- `obj.bringToFront()` → `canvas.bringObjectToFront(obj)`
- `obj.sendToBack()` → `canvas.sendObjectToBack(obj)`
- `obj.bringForward()` → `canvas.bringObjectForward(obj)`
- `obj.sendBackwards()` → `canvas.sendObjectBackwards(obj)`
- `obj.clone()` → `await obj.clone()` (returns Promise in v6)
