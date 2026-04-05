import type { ShortcutDef } from '@/lib/keyboard/types';
import { pptObjectActions, pptCanvasActions, type PPTObjectCtx, type PPTCanvasCtx } from '@/actions/ppt-object.actions';
import { buildActionMap } from '@/actions/types';
import { getT } from '@/lib/i18n';

const pptObjectActionMap = buildActionMap(pptObjectActions);
const pptCanvasActionMap = buildActionMap(pptCanvasActions);

function dispatch(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName));
}

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

export function buildPPTShortcuts(): ShortcutDef[] {
  const t = getT();
  return [
    {
      id: 'ppt-delete',
      key: 'Delete',
      handler: () => {
        const ctx = _getObjectCtx?.();
        if (ctx) pptObjectActionMap['ppt-delete'].execute(ctx);
      },
      label: t('shortcuts.ppt.deleteSelected'),
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
      label: t('shortcuts.ppt.deleteSelected'),
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
      label: t('shortcuts.ppt.duplicate'),
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
      label: t('shortcuts.ppt.copy'),
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
      label: t('shortcuts.ppt.cut'),
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
      label: t('shortcuts.ppt.paste'),
      category: 'Presentation',
      priority: 8,
    },
    {
      id: 'ppt-group',
      key: 'g',
      modifiers: { meta: true },
      handler: (e) => { e.preventDefault(); dispatch('ppt:group'); },
      label: t('shortcuts.ppt.group'),
      category: 'Presentation',
      priority: 8,
    },
    {
      id: 'ppt-ungroup',
      key: 'g',
      modifiers: { meta: true, shift: true },
      handler: (e) => { e.preventDefault(); dispatch('ppt:ungroup'); },
      label: t('shortcuts.ppt.ungroup'),
      category: 'Presentation',
      priority: 9,
    },
    {
      id: 'ppt-nudge-left',
      key: 'ArrowLeft',
      handler: () => dispatch('ppt:nudge-left'),
      label: t('shortcuts.ppt.nudgeLeft'),
      category: 'Presentation',
      priority: 3,
    },
    {
      id: 'ppt-nudge-right',
      key: 'ArrowRight',
      handler: () => dispatch('ppt:nudge-right'),
      label: t('shortcuts.ppt.nudgeRight'),
      category: 'Presentation',
      priority: 3,
    },
    {
      id: 'ppt-nudge-up',
      key: 'ArrowUp',
      handler: () => dispatch('ppt:nudge-up'),
      label: t('shortcuts.ppt.nudgeUp'),
      category: 'Presentation',
      priority: 3,
    },
    {
      id: 'ppt-nudge-down',
      key: 'ArrowDown',
      handler: () => dispatch('ppt:nudge-down'),
      label: t('shortcuts.ppt.nudgeDown'),
      category: 'Presentation',
      priority: 3,
    },
  ];
}

export const PPT_SHORTCUTS: ShortcutDef[] = buildPPTShortcuts();
