// ─── Color Palettes ────────────────────────────────

export const NODE_COLORS = [
  { bg: '#ffffff', border: '#374151', text: '#1f2937', name: 'Default' },
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', name: 'Blue' },
  { bg: '#dcfce7', border: '#22c55e', text: '#166534', name: 'Green' },
  { bg: '#fef9c3', border: '#eab308', text: '#854d0e', name: 'Yellow' },
  { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', name: 'Red' },
  { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', name: 'Purple' },
  { bg: '#ffedd5', border: '#f97316', text: '#9a3412', name: 'Orange' },
  { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3', name: 'Indigo' },
];

export const MINDMAP_COLORS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  { bg: '#ffedd5', border: '#f97316', text: '#9a3412' },
  { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
];

// ─── Shape Definitions ─────────────────────────────

export type FlowchartShape =
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

// SVG path data for shape icons (24x24 viewBox)
export const SHAPE_ICON_PATHS: Record<FlowchartShape, string> = {
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

export const SHAPE_META: Record<FlowchartShape, { width: number; height: number }> = {
  'rect':            { width: 120, height: 60 },
  'rounded-rect':    { width: 120, height: 60 },
  'diamond':         { width: 100, height: 80 },
  'circle':          { width: 70,  height: 70 },
  'ellipse':         { width: 120, height: 70 },
  'parallelogram':   { width: 130, height: 60 },
  'triangle':        { width: 100, height: 80 },
  'stadium':         { width: 130, height: 50 },
  'hexagon':         { width: 110, height: 80 },
  'pentagon':        { width: 100, height: 80 },
  'octagon':         { width: 90,  height: 90 },
  'star':            { width: 90,  height: 90 },
  'cross':           { width: 80,  height: 80 },
  'cloud':           { width: 130, height: 80 },
  'cylinder':        { width: 80,  height: 100 },
  'arrow-right':     { width: 130, height: 60 },
  'arrow-left':      { width: 130, height: 60 },
  'arrow-double':    { width: 130, height: 60 },
  'chevron-right':   { width: 120, height: 60 },
  'chevron-left':    { width: 120, height: 60 },
  'trapezoid':       { width: 130, height: 60 },
  'callout':         { width: 130, height: 80 },
  'brace-left':      { width: 40,  height: 100 },
  'brace-right':     { width: 40,  height: 100 },
};

// ─── Connector Types ───────────────────────────────

export type ConnectorType = 'straight' | 'manhattan' | 'rounded' | 'smooth';

export const CONNECTOR_META: Record<ConnectorType, { label: string; router: string; connector: string }> = {
  'straight':   { label: '直线',     router: 'normal',    connector: 'normal' },
  'manhattan':  { label: '正交连线', router: 'manhattan',  connector: 'rounded' },
  'rounded':    { label: '折线',     router: 'orth',       connector: 'rounded' },
  'smooth':     { label: '曲线',     router: 'normal',     connector: 'smooth' },
};

// ─── Standalone color palettes (for independent fill / border pickers) ────
export const FILL_COLORS = [
  '#ffffff', '#dbeafe', '#dcfce7', '#fef9c3', '#fee2e2',
  '#f3e8ff', '#ffedd5', '#e0e7ff', '#f1f5f9', '#fce7f3',
  'transparent', // no fill
];

export const BORDER_COLORS = [
  '#374151', '#3b82f6', '#22c55e', '#eab308', '#ef4444',
  '#a855f7', '#f97316', '#6366f1', '#94a3b8',
  'transparent', // no border
];

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

export const EDGE_WIDTHS = [1, 1.5, 2, 3, 4, 6];

// ─── Defaults ──────────────────────────────────────

export const DEFAULT_SHAPE: FlowchartShape = 'rounded-rect';
export const DEFAULT_CONNECTOR: ConnectorType = 'manhattan';
export const DEFAULT_NODE_COLOR = NODE_COLORS[0];
export const DEFAULT_EDGE_COLOR = '#94a3b8';
export const DEFAULT_EDGE_WIDTH = 2;

export const AUTOSAVE_DEBOUNCE_MS = 2000;
export const PORT_R = 5;
export const PORT_VISIBLE_R = 6;
