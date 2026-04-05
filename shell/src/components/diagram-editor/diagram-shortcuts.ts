import type { ShortcutDef } from '@/lib/keyboard/types';
import { diagramNodeActions, diagramCanvasActions, type DiagramNodeCtx, type DiagramCanvasCtx } from '@/actions/diagram-node.actions';
import { buildActionMap } from '@/actions/types';
import { getT } from '@/lib/i18n';

const diagramNodeActionMap = buildActionMap(diagramNodeActions);
const diagramCanvasActionMap = buildActionMap(diagramCanvasActions);

function dispatch(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName));
}

/**
 * Diagram editor context shortcuts.
 * Handlers call action.execute() via context registry.
 * Register a context provider via setDiagramShortcutContext before shortcuts fire.
 */
let _getNodeCtx: (() => DiagramNodeCtx | null) | null = null;
let _getCanvasCtx: (() => DiagramCanvasCtx | null) | null = null;

export function setDiagramShortcutContext(
  getNodeCtx: () => DiagramNodeCtx | null,
  getCanvasCtx: () => DiagramCanvasCtx | null,
) {
  _getNodeCtx = getNodeCtx;
  _getCanvasCtx = getCanvasCtx;
}

export function buildDiagramShortcutsFromFile(): ShortcutDef[] {
  const t = getT();
  return [
    {
      id: 'diagram-delete',
      key: 'Delete',
      handler: () => {
        const ctx = _getNodeCtx?.();
        if (ctx) diagramNodeActionMap['diagram-delete'].execute(ctx);
      },
      label: t('shortcuts.diagram.deleteSelected'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-backspace',
      key: 'Backspace',
      handler: () => {
        const ctx = _getNodeCtx?.();
        if (ctx) diagramNodeActionMap['diagram-delete'].execute(ctx);
      },
      label: t('shortcuts.diagram.deleteSelected'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-copy',
      key: 'c',
      modifiers: { meta: true },
      handler: () => {
        const ctx = _getNodeCtx?.();
        if (ctx) diagramNodeActionMap['diagram-copy'].execute(ctx);
      },
      label: t('shortcuts.diagram.copy'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-paste',
      key: 'v',
      modifiers: { meta: true },
      handler: () => {
        const ctx = _getCanvasCtx?.();
        if (ctx) diagramCanvasActionMap['diagram-canvas-paste'].execute(ctx);
      },
      label: t('shortcuts.diagram.paste'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-tab',
      key: 'Tab',
      handler: (e) => { e.preventDefault(); dispatch('diagram:add-child'); },
      label: t('shortcuts.diagram.addChild'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-enter',
      key: 'Enter',
      handler: () => dispatch('diagram:add-sibling'),
      label: t('shortcuts.diagram.addSibling'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-f2',
      key: 'F2',
      handler: () => dispatch('diagram:edit-label'),
      label: t('shortcuts.diagram.editLabel'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-select-all',
      key: 'a',
      modifiers: { meta: true },
      handler: (e) => { e.preventDefault(); dispatch('diagram:select-all'); },
      label: t('shortcuts.diagram.selectAll'),
      category: 'Diagram',
      priority: 5,
    },
    {
      id: 'diagram-tool-select',
      key: 'v',
      handler: () => dispatch('diagram:tool-select'),
      label: t('shortcuts.diagram.selectTool'),
      category: 'Diagram',
      priority: 2,
    },
    {
      id: 'diagram-tool-text',
      key: 't',
      handler: () => dispatch('diagram:tool-text'),
      label: t('shortcuts.diagram.textTool'),
      category: 'Diagram',
      priority: 2,
    },
    {
      id: 'diagram-tool-rect',
      key: 'r',
      handler: () => dispatch('diagram:tool-rect'),
      label: t('shortcuts.diagram.rectTool'),
      category: 'Diagram',
      priority: 2,
    },
    {
      id: 'diagram-tool-mindmap',
      key: 'm',
      handler: () => dispatch('diagram:tool-mindmap'),
      label: t('shortcuts.diagram.mindmapTool'),
      category: 'Diagram',
      priority: 2,
    },
    {
      id: 'diagram-collapse',
      key: '.',
      modifiers: { meta: true },
      handler: (e) => { e.preventDefault(); dispatch('diagram:toggle-collapse'); },
      label: t('shortcuts.diagram.toggleCollapse'),
      category: 'Diagram',
      priority: 5,
    },
  ];
}

export const DIAGRAM_SHORTCUTS: ShortcutDef[] = buildDiagramShortcutsFromFile();
