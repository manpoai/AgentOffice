import type { ShortcutDef } from '@/lib/keyboard/types';
import { diagramNodeActions, diagramCanvasActions, type DiagramNodeCtx, type DiagramCanvasCtx } from '@/actions/diagram-node.actions';
import { buildActionMap } from '@/actions/types';

const diagramNodeActionMap = buildActionMap(diagramNodeActions);
const diagramCanvasActionMap = buildActionMap(diagramCanvasActions);

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

export const DIAGRAM_SHORTCUTS: ShortcutDef[] = [
  {
    id: 'diagram-delete',
    key: 'Delete',
    handler: () => {
      const ctx = _getNodeCtx?.();
      if (ctx) diagramNodeActionMap['diagram-delete'].execute(ctx);
    },
    label: 'Delete selected',
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
    label: 'Delete selected',
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
    label: 'Copy',
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
    label: 'Paste',
    category: 'Diagram',
    priority: 5,
  },
  {
    id: 'diagram-tab',
    key: 'Tab',
    handler: (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('diagram:add-child')); },
    label: 'Add child node',
    category: 'Diagram',
    priority: 5,
  },
  {
    id: 'diagram-enter',
    key: 'Enter',
    handler: () => window.dispatchEvent(new CustomEvent('diagram:add-sibling')),
    label: 'Add sibling node',
    category: 'Diagram',
    priority: 5,
  },
  {
    id: 'diagram-f2',
    key: 'F2',
    handler: () => window.dispatchEvent(new CustomEvent('diagram:edit-label')),
    label: 'Edit label',
    category: 'Diagram',
    priority: 5,
  },
  {
    id: 'diagram-select-all',
    key: 'a',
    modifiers: { meta: true },
    handler: (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('diagram:select-all')); },
    label: 'Select all',
    category: 'Diagram',
    priority: 5,
  },
  {
    id: 'diagram-tool-select',
    key: 'v',
    handler: () => window.dispatchEvent(new CustomEvent('diagram:tool-select')),
    label: 'Select tool',
    category: 'Diagram',
    priority: 2,
  },
  {
    id: 'diagram-tool-text',
    key: 't',
    handler: () => window.dispatchEvent(new CustomEvent('diagram:tool-text')),
    label: 'Text tool',
    category: 'Diagram',
    priority: 2,
  },
  {
    id: 'diagram-tool-rect',
    key: 'r',
    handler: () => window.dispatchEvent(new CustomEvent('diagram:tool-rect')),
    label: 'Rectangle tool',
    category: 'Diagram',
    priority: 2,
  },
  {
    id: 'diagram-tool-mindmap',
    key: 'm',
    handler: () => window.dispatchEvent(new CustomEvent('diagram:tool-mindmap')),
    label: 'Mindmap tool',
    category: 'Diagram',
    priority: 2,
  },
  {
    id: 'diagram-collapse',
    key: '.',
    modifiers: { meta: true },
    handler: (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('diagram:toggle-collapse')); },
    label: 'Toggle collapse',
    category: 'Diagram',
    priority: 5,
  },
];
