'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Node } from '@antv/x6';
import type { FlowchartShape } from '../constants';

interface FlowchartNodeData {
  label: string;
  flowchartShape: FlowchartShape;
  bgColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
}

const defaultData: FlowchartNodeData = {
  label: '',
  flowchartShape: 'rounded-rect',
  bgColor: '#ffffff',
  borderColor: '#374151',
  textColor: '#1f2937',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
};

export function FlowchartNode({ node }: { node: Node }) {
  const raw = node.getData() || {};
  const d: FlowchartNodeData = { ...defaultData, ...raw };
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.label);
  const inputRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef(false);
  const isMinimapRef = useRef<boolean | null>(null);

  // Sync external data changes
  useEffect(() => {
    const onChange = () => {
      const newData = node.getData() || {};
      setText(newData.label ?? '');
    };
    node.on('change:data', onChange);
    return () => { node.off('change:data', onChange); };
  }, [node]);

  const commitEdit = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const newText = inputRef.current?.textContent ?? text;
    setText(newText);
    setEditing(false);
    node.setData({ ...node.getData(), label: newText }, { silent: false });
    node.trigger('edit:end');
  }, [node, text]);

  const cancelEdit = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setText(d.label);
    if (inputRef.current) inputRef.current.textContent = d.label;
    setEditing(false);
    node.trigger('edit:end');
  }, [d.label, node]);

  const focusAndSelect = useCallback((args?: { initialKey?: string }) => {
    const initialKey = args?.initialKey;
    editingRef.current = true;
    setEditing(true);

    const deadline = Date.now() + 500;
    const tryFocus = () => {
      const el = inputRef.current;
      if (!el || !editingRef.current) return;

      if (isMinimapRef.current === null) {
        isMinimapRef.current = !!el.closest('.x6-widget-minimap');
      }
      if (isMinimapRef.current) {
        editingRef.current = false;
        setEditing(false);
        return;
      }

      el.focus();
      if (document.activeElement === el) {
        if (el.textContent) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        if (initialKey) {
          document.execCommand('insertText', false, initialKey);
        }
        return;
      }

      if (Date.now() < deadline) {
        requestAnimationFrame(tryFocus);
      }
    };
    setTimeout(tryFocus, 16);
  }, []);

  useEffect(() => {
    node.on('edit:start', focusAndSelect);
    node.on('edit:commit', commitEdit);
    return () => {
      node.off('edit:start', focusAndSelect);
      node.off('edit:commit', commitEdit);
    };
  }, [node, focusAndSelect, commitEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      cancelEdit();
    }
  }, [commitEdit, cancelEdit]);

  const size = node.getSize();
  const w = size.width;
  const h = size.height;
  const s = 2; // stroke inset

  const baseStyle: React.CSSProperties = {
    width: w,
    height: h,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: d.fontSize,
    fontWeight: d.fontWeight,
    fontStyle: d.fontStyle,
    color: d.textColor,
    overflow: 'hidden',
    cursor: 'default',
    userSelect: 'none',
  };

  const textStyle: React.CSSProperties = {
    fontSize: d.fontSize,
    fontWeight: d.fontWeight,
    fontStyle: d.fontStyle,
    color: d.textColor,
    lineHeight: 1.25,
    wordBreak: 'break-word',
    textAlign: 'center' as const,
    padding: '4px 8px',
    maxWidth: w - 4,
    cursor: editing ? 'text' : 'default',
  };

  const textEl = editing ? (
    <div
      ref={inputRef}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ ...textStyle, outline: 'none', userSelect: 'text' }}
    >
      {text}
    </div>
  ) : (
    <span className="pointer-events-none select-none" style={textStyle}>
      {d.label || '\u00A0'}
    </span>
  );

  const stroke = d.borderColor === 'transparent' ? 'none' : d.borderColor;
  const svgAbsolute: React.CSSProperties = { position: 'absolute', top: 0, left: 0 };
  const textOverlay = (padding?: string) => (
    <div style={{ position: 'relative', zIndex: 1, padding: padding || '0 16px' }}>{textEl}</div>
  );

  // Helper: SVG polygon shape
  const svgShape = (points: string, textPad?: string) => (
    <div style={{ ...baseStyle, position: 'relative' }}>
      <svg width={w} height={h} style={svgAbsolute}>
        <polygon points={points} fill={d.bgColor} stroke={stroke} strokeWidth={2} />
      </svg>
      {textOverlay(textPad)}
    </div>
  );

  // Helper: SVG path shape
  const svgPathShape = (pathD: string, textPad?: string) => (
    <div style={{ ...baseStyle, position: 'relative' }}>
      <svg width={w} height={h} style={svgAbsolute}>
        <path d={pathD} fill={d.bgColor} stroke={stroke} strokeWidth={2} />
      </svg>
      {textOverlay(textPad)}
    </div>
  );

  // Helper: CSS border-radius shape
  const cssShape = (borderRadius: number | string) => (
    <div
      style={{
        ...baseStyle,
        borderRadius,
        backgroundColor: d.bgColor,
        border: d.borderColor === 'transparent' ? 'none' : `2px solid ${d.borderColor}`,
      }}
    >
      {textEl}
    </div>
  );

  switch (d.flowchartShape) {
    case 'rect':
      return cssShape(0);

    case 'circle':
    case 'ellipse':
      return cssShape('50%');

    case 'stadium':
      return cssShape(h / 2);

    case 'diamond':
      return svgShape(`${w / 2},${s} ${w - s},${h / 2} ${w / 2},${h - s} ${s},${h / 2}`);

    case 'parallelogram':
      return svgShape(
        `${w * 0.15},${h - s} ${s},${s} ${w * 0.85},${s} ${w - s},${h - s}`,
        '0 20px',
      );

    case 'triangle':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={svgAbsolute}>
            <polygon
              points={`${w / 2},${s} ${w - s},${h - s} ${s},${h - s}`}
              fill={d.bgColor} stroke={stroke} strokeWidth={2}
            />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, paddingTop: h * 0.3 }}>{textEl}</div>
        </div>
      );

    case 'hexagon':
      return svgShape(
        `${w * 0.25},${s} ${w * 0.75},${s} ${w - s},${h / 2} ${w * 0.75},${h - s} ${w * 0.25},${h - s} ${s},${h / 2}`,
        '0 20px',
      );

    case 'pentagon':
      return svgShape(
        `${w / 2},${s} ${w - s},${h * 0.38} ${w * 0.82},${h - s} ${w * 0.18},${h - s} ${s},${h * 0.38}`,
      );

    case 'octagon': {
      const o = Math.min(w, h) * 0.29;
      return svgShape(
        `${o},${s} ${w - o},${s} ${w - s},${o} ${w - s},${h - o} ${w - o},${h - s} ${o},${h - s} ${s},${h - o} ${s},${o}`,
      );
    }

    case 'star': {
      const cx = w / 2, cy = h / 2;
      const outerR = Math.min(w, h) / 2 - s;
      const innerR = outerR * 0.38;
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const ao = (Math.PI / 2) + (i * 2 * Math.PI / 5);
        const ai = (Math.PI / 2) + ((i + 0.5) * 2 * Math.PI / 5);
        pts.push(`${cx - outerR * Math.cos(ao)},${cy - outerR * Math.sin(ao)}`);
        pts.push(`${cx - innerR * Math.cos(ai)},${cy - innerR * Math.sin(ai)}`);
      }
      return svgShape(pts.join(' '));
    }

    case 'cross':
      return svgShape(
        `${w * 0.33},${s} ${w * 0.67},${s} ${w * 0.67},${h * 0.33} ${w - s},${h * 0.33} ${w - s},${h * 0.67} ${w * 0.67},${h * 0.67} ${w * 0.67},${h - s} ${w * 0.33},${h - s} ${w * 0.33},${h * 0.67} ${s},${h * 0.67} ${s},${h * 0.33} ${w * 0.33},${h * 0.33}`,
      );

    case 'cloud':
      return svgPathShape(
        `M${w * 0.25},${h * 0.75} ` +
        `a${w * 0.15},${h * 0.2} 0 0,1 ${w * 0.05},-${h * 0.35} ` +
        `a${w * 0.2},${h * 0.25} 0 0,1 ${w * 0.35},-${h * 0.15} ` +
        `a${w * 0.2},${h * 0.2} 0 0,1 ${w * 0.25},${h * 0.1} ` +
        `a${w * 0.15},${h * 0.2} 0 0,1 ${w * 0.05},${h * 0.3} ` +
        `z`,
      );

    case 'cylinder':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={svgAbsolute}>
            <ellipse cx={w / 2} cy={h * 0.15} rx={w / 2 - s} ry={h * 0.15 - s}
              fill={d.bgColor} stroke={stroke} strokeWidth={2} />
            <path
              d={`M${s},${h * 0.15} v${h * 0.7} a${w / 2 - s},${h * 0.15 - s} 0 0,0 ${w - 2 * s},0 v-${h * 0.7}`}
              fill={d.bgColor} stroke={stroke} strokeWidth={2}
            />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, paddingTop: h * 0.15 }}>{textEl}</div>
        </div>
      );

    case 'arrow-right':
      return svgShape(
        `${s},${h * 0.2} ${w * 0.65},${h * 0.2} ${w * 0.65},${s} ${w - s},${h / 2} ${w * 0.65},${h - s} ${w * 0.65},${h * 0.8} ${s},${h * 0.8}`,
        '0 30px 0 10px',
      );

    case 'arrow-left':
      return svgShape(
        `${w - s},${h * 0.2} ${w * 0.35},${h * 0.2} ${w * 0.35},${s} ${s},${h / 2} ${w * 0.35},${h - s} ${w * 0.35},${h * 0.8} ${w - s},${h * 0.8}`,
        '0 10px 0 30px',
      );

    case 'arrow-double':
      return svgShape(
        `${s},${h / 2} ${w * 0.2},${s} ${w * 0.2},${h * 0.25} ${w * 0.8},${h * 0.25} ${w * 0.8},${s} ${w - s},${h / 2} ${w * 0.8},${h - s} ${w * 0.8},${h * 0.75} ${w * 0.2},${h * 0.75} ${w * 0.2},${h - s}`,
        '0 24px',
      );

    case 'chevron-right':
      return svgShape(
        `${s},${s} ${w * 0.75},${s} ${w - s},${h / 2} ${w * 0.75},${h - s} ${s},${h - s} ${w * 0.25},${h / 2}`,
        '0 20px',
      );

    case 'chevron-left':
      return svgShape(
        `${w - s},${s} ${w * 0.25},${s} ${s},${h / 2} ${w * 0.25},${h - s} ${w - s},${h - s} ${w * 0.75},${h / 2}`,
        '0 20px',
      );

    case 'trapezoid':
      return svgShape(
        `${w * 0.15},${s} ${w * 0.85},${s} ${w - s},${h - s} ${s},${h - s}`,
        '0 16px',
      );

    case 'callout':
      return svgPathShape(
        `M${s},${s} h${w - 2 * s} v${h * 0.7} h-${w * 0.55} l-${w * 0.1},${h * 0.25} v-${h * 0.25} h-${w * 0.35 + s - 2 * s} z`,
      );

    case 'brace-left':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={svgAbsolute}>
            <path
              d={`M${w - s},${s} Q${w * 0.5},${s} ${w * 0.5},${h * 0.25} T${s},${h / 2} Q${w * 0.5},${h * 0.5} ${w * 0.5},${h * 0.75} T${w - s},${h - s}`}
              fill="none" stroke={stroke} strokeWidth={2}
            />
          </svg>
          {textOverlay()}
        </div>
      );

    case 'brace-right':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={svgAbsolute}>
            <path
              d={`M${s},${s} Q${w * 0.5},${s} ${w * 0.5},${h * 0.25} T${w - s},${h / 2} Q${w * 0.5},${h * 0.5} ${w * 0.5},${h * 0.75} T${s},${h - s}`}
              fill="none" stroke={stroke} strokeWidth={2}
            />
          </svg>
          {textOverlay()}
        </div>
      );

    case 'rounded-rect':
    default:
      return cssShape(8);
  }
}
