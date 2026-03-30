/**
 * Shared shape definitions used by both Diagram (X6) and Presentation (Fabric.js) editors.
 *
 * This is the canonical shape catalog. Both editors import from here
 * rather than maintaining their own shape lists.
 */

// ── Shape categories ──

export type ShapeCategory = 'basic' | 'flowchart' | 'arrow';

// ── Shape IDs (superset of diagram FlowchartShape type) ──

export type ShapeId =
  | 'rect'
  | 'rounded-rect'
  | 'diamond'
  | 'circle'
  | 'ellipse'
  | 'parallelogram'
  | 'triangle'
  | 'stadium'
  | 'hexagon'
  | 'pentagon'
  | 'octagon'
  | 'star'
  | 'cross'
  | 'cloud'
  | 'cylinder'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-double'
  | 'chevron-right'
  | 'chevron-left'
  | 'trapezoid'
  | 'callout'
  | 'brace-left'
  | 'brace-right';

// ── Shape definition ──

export interface ShapeDefinition {
  id: ShapeId;
  label: string;
  category: ShapeCategory;
  /** SVG path data for rendering in shape pickers (24x24 viewBox) */
  svgPath: string;
  /** Default dimensions when inserting */
  defaultWidth: number;
  defaultHeight: number;
  /** X6-specific shape name (used in diagram editor) */
  x6Shape: string;
  /** Whether this shape is available in the presentation editor */
  availableInPpt: boolean;
}

// ── SVG path data (24x24 viewBox) ──

export const SHAPE_SVG_PATHS: Record<ShapeId, string> = {
  'rect':           'M3 5h18v14H3z',
  'rounded-rect':   'M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z',
  'diamond':        'M12 3 22 12 12 21 2 12z',
  'circle':         'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  'ellipse':        'M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6z',
  'parallelogram':  'M6 5h15l-3 14H3z',
  'triangle':       'M12 4 22 20H2z',
  'stadium':        'M7 6h10a6 6 0 0 1 0 12H7a6 6 0 0 1 0-12z',
  'hexagon':        'M7 3h10l5 9-5 9H7l-5-9z',
  'pentagon':       'M12 3l9 7-3.5 10h-11L3 10z',
  'octagon':        'M8 3h8l5 5v8l-5 5H8l-5-5V8z',
  'star':           'M12 3l2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L12 17.3 6.4 20l1.1-6.1L3 9.5l6.2-.9z',
  'cross':          'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  'cloud':          'M6 19a4 4 0 0 1-.5-7.97A7 7 0 0 1 12 5a7 7 0 0 1 6.5 6.03A4 4 0 0 1 18 19z',
  'cylinder':       'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3v10c0 1.7-3.6 3-8 3s-8-1.3-8-3z',
  'arrow-right':    'M4 9h11V5l6 7-6 7v-4H4z',
  'arrow-left':     'M20 9H9V5L3 12l6 7v-4h11z',
  'arrow-double':   'M7 5l-5 7 5 7v-4h10v4l5-7-5-7v4H7z',
  'chevron-right':  'M5 4h10l6 8-6 8H5l6-8z',
  'chevron-left':   'M19 4H9L3 12l6 8h10l-6-8z',
  'trapezoid':      'M6 5h12l3 14H3z',
  'callout':        'M4 4h16v12H13l-3 4v-4H4z',
  'brace-left':     'M12 3c-3 0-3 3-3 4.5S4 9 4 12s2 3.5 5 4.5 3 4.5 3 4.5',
  'brace-right':    'M12 3c3 0 3 3 3 4.5s5 1.5 5 4.5-2 3.5-5 4.5-3 4.5-3 4.5',
};

// ── Full shape catalog ──

export const SHAPES: ShapeDefinition[] = [
  // Basic shapes (available in both editors)
  { id: 'rect',          label: 'Rectangle',       category: 'basic',     svgPath: SHAPE_SVG_PATHS['rect'],          defaultWidth: 120, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: true },
  { id: 'rounded-rect',  label: 'Rounded Rect',    category: 'basic',     svgPath: SHAPE_SVG_PATHS['rounded-rect'],  defaultWidth: 120, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: true },
  { id: 'circle',        label: 'Circle',           category: 'basic',     svgPath: SHAPE_SVG_PATHS['circle'],        defaultWidth: 70,  defaultHeight: 70,  x6Shape: 'flowchart-node', availableInPpt: true },
  { id: 'ellipse',       label: 'Ellipse',          category: 'basic',     svgPath: SHAPE_SVG_PATHS['ellipse'],       defaultWidth: 120, defaultHeight: 70,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'triangle',      label: 'Triangle',         category: 'basic',     svgPath: SHAPE_SVG_PATHS['triangle'],      defaultWidth: 100, defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: true },
  { id: 'diamond',       label: 'Diamond',          category: 'flowchart', svgPath: SHAPE_SVG_PATHS['diamond'],       defaultWidth: 100, defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'parallelogram', label: 'Parallelogram',    category: 'flowchart', svgPath: SHAPE_SVG_PATHS['parallelogram'], defaultWidth: 130, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'stadium',       label: 'Stadium',          category: 'flowchart', svgPath: SHAPE_SVG_PATHS['stadium'],       defaultWidth: 130, defaultHeight: 50,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'hexagon',       label: 'Hexagon',          category: 'flowchart', svgPath: SHAPE_SVG_PATHS['hexagon'],       defaultWidth: 110, defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'pentagon',      label: 'Pentagon',          category: 'flowchart', svgPath: SHAPE_SVG_PATHS['pentagon'],      defaultWidth: 100, defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'octagon',       label: 'Octagon',           category: 'flowchart', svgPath: SHAPE_SVG_PATHS['octagon'],      defaultWidth: 90,  defaultHeight: 90,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'star',          label: 'Star',              category: 'basic',     svgPath: SHAPE_SVG_PATHS['star'],         defaultWidth: 90,  defaultHeight: 90,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'cross',         label: 'Cross',             category: 'basic',     svgPath: SHAPE_SVG_PATHS['cross'],        defaultWidth: 80,  defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'cloud',         label: 'Cloud',             category: 'flowchart', svgPath: SHAPE_SVG_PATHS['cloud'],        defaultWidth: 130, defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'cylinder',      label: 'Cylinder',          category: 'flowchart', svgPath: SHAPE_SVG_PATHS['cylinder'],     defaultWidth: 80,  defaultHeight: 100, x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'trapezoid',     label: 'Trapezoid',         category: 'flowchart', svgPath: SHAPE_SVG_PATHS['trapezoid'],    defaultWidth: 130, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'callout',       label: 'Callout',           category: 'flowchart', svgPath: SHAPE_SVG_PATHS['callout'],      defaultWidth: 130, defaultHeight: 80,  x6Shape: 'flowchart-node', availableInPpt: false },

  // Arrow shapes
  { id: 'arrow-right',   label: 'Arrow Right',      category: 'arrow',     svgPath: SHAPE_SVG_PATHS['arrow-right'],   defaultWidth: 130, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'arrow-left',    label: 'Arrow Left',       category: 'arrow',     svgPath: SHAPE_SVG_PATHS['arrow-left'],    defaultWidth: 130, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'arrow-double',  label: 'Double Arrow',     category: 'arrow',     svgPath: SHAPE_SVG_PATHS['arrow-double'],  defaultWidth: 130, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'chevron-right', label: 'Chevron Right',    category: 'arrow',     svgPath: SHAPE_SVG_PATHS['chevron-right'], defaultWidth: 120, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'chevron-left',  label: 'Chevron Left',     category: 'arrow',     svgPath: SHAPE_SVG_PATHS['chevron-left'],  defaultWidth: 120, defaultHeight: 60,  x6Shape: 'flowchart-node', availableInPpt: false },

  // Brace shapes
  { id: 'brace-left',    label: 'Left Brace',       category: 'basic',     svgPath: SHAPE_SVG_PATHS['brace-left'],    defaultWidth: 40,  defaultHeight: 100, x6Shape: 'flowchart-node', availableInPpt: false },
  { id: 'brace-right',   label: 'Right Brace',      category: 'basic',     svgPath: SHAPE_SVG_PATHS['brace-right'],   defaultWidth: 40,  defaultHeight: 100, x6Shape: 'flowchart-node', availableInPpt: false },
];

// ── Lookup helpers ──

/** Get shapes by category */
export function getShapesByCategory(category: ShapeCategory): ShapeDefinition[] {
  return SHAPES.filter(s => s.category === category);
}

/** Get shapes available in presentation editor */
export function getPptShapes(): ShapeDefinition[] {
  return SHAPES.filter(s => s.availableInPpt);
}

/** Get a shape by ID */
export function getShape(id: ShapeId): ShapeDefinition | undefined {
  return SHAPES.find(s => s.id === id);
}

/** Shape ID to default dimensions map (for backward compat with diagram constants) */
export function getShapeDimensions(id: ShapeId): { width: number; height: number } {
  const shape = getShape(id);
  return shape ? { width: shape.defaultWidth, height: shape.defaultHeight } : { width: 120, height: 60 };
}
