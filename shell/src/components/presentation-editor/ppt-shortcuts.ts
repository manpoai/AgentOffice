import type { ShortcutDef } from '@/lib/keyboard/types';
import { pptObjectActions, pptCanvasActions, type PPTObjectCtx, type PPTCanvasCtx } from '@/actions/ppt-object.actions';
import { buildActionMap } from '@/actions/types';

const pptObjectActionMap = buildActionMap(pptObjectActions);
const pptCanvasActionMap = buildActionMap(pptCanvasActions);

/**
 * Presentation editor context shortcuts.
 * Handlers call action.execute() via context registry.
 * Register a context provider via setPPTShortcutContext before shortcuts fire.
 */
let _getObjectCtx: (() => PPTObjectCtx | null) | null = null;
let _getCanvasCtx: (() => PPTCanvasCtx | null) | null = null;

export function setPPTShortcutContext(
  getObjectCtx: () => PPTObjectCtx | null,
  getCanvasCtx: () => PPTCanvasCtx | null,
) {
  _getObjectCtx = getObjectCtx;
  _getCanvasCtx = getCanvasCtx;
}

export const PPT_SHORTCUTS: ShortcutDef[] = [
  {
    id: 'ppt-delete',
    key: 'Delete',
    handler: () => {
      const ctx = _getObjectCtx?.();
      if (ctx) pptObjectActionMap['ppt-delete'].execute(ctx);
    },
    label: 'Delete selected',
    category: 'Presentation',
    priority: 5,
  },
  {
    id: 'ppt-backspace',
    key: 'Backspace',
    handler: () => {
      const ctx = _getObjectCtx?.();
      if (ctx) pptObjectActionMap['ppt-delete'].execute(ctx);
    },
    label: 'Delete selected',
    category: 'Presentation',
    priority: 5,
  },
  {
    id: 'ppt-duplicate',
    key: 'd',
    modifiers: { meta: true },
    handler: (e) => {
      e.preventDefault();
      const ctx = _getObjectCtx?.();
      if (ctx) pptObjectActionMap['ppt-duplicate'].execute(ctx);
    },
    label: 'Duplicate',
    category: 'Presentation',
    priority: 8,
  },
  {
    id: 'ppt-copy',
    key: 'c',
    modifiers: { meta: true },
    handler: () => {
      const ctx = _getObjectCtx?.();
      if (ctx) pptObjectActionMap['ppt-copy'].execute(ctx);
    },
    label: 'Copy',
    category: 'Presentation',
    priority: 8,
  },
  {
    id: 'ppt-cut',
    key: 'x',
    modifiers: { meta: true },
    handler: () => {
      const ctx = _getObjectCtx?.();
      if (ctx) pptObjectActionMap['ppt-cut'].execute(ctx);
    },
    label: 'Cut',
    category: 'Presentation',
    priority: 8,
  },
  {
    id: 'ppt-paste',
    key: 'v',
    modifiers: { meta: true },
    handler: () => {
      const ctx = _getCanvasCtx?.();
      if (ctx) pptCanvasActionMap['ppt-canvas-paste'].execute(ctx);
    },
    label: 'Paste',
    category: 'Presentation',
    priority: 8,
  },
  {
    id: 'ppt-group',
    key: 'g',
    modifiers: { meta: true },
    handler: (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('ppt:group')); },
    label: 'Group',
    category: 'Presentation',
    priority: 8,
  },
  {
    id: 'ppt-ungroup',
    key: 'g',
    modifiers: { meta: true, shift: true },
    handler: (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('ppt:ungroup')); },
    label: 'Ungroup',
    category: 'Presentation',
    priority: 9,
  },
  {
    id: 'ppt-nudge-left',
    key: 'ArrowLeft',
    handler: () => window.dispatchEvent(new CustomEvent('ppt:nudge-left')),
    label: 'Nudge left',
    category: 'Presentation',
    priority: 3,
  },
  {
    id: 'ppt-nudge-right',
    key: 'ArrowRight',
    handler: () => window.dispatchEvent(new CustomEvent('ppt:nudge-right')),
    label: 'Nudge right',
    category: 'Presentation',
    priority: 3,
  },
  {
    id: 'ppt-nudge-up',
    key: 'ArrowUp',
    handler: () => window.dispatchEvent(new CustomEvent('ppt:nudge-up')),
    label: 'Nudge up',
    category: 'Presentation',
    priority: 3,
  },
  {
    id: 'ppt-nudge-down',
    key: 'ArrowDown',
    handler: () => window.dispatchEvent(new CustomEvent('ppt:nudge-down')),
    label: 'Nudge down',
    category: 'Presentation',
    priority: 3,
  },
];
