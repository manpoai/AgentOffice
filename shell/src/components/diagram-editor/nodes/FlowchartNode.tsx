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

  // Focus the contentEditable and select all text (or place cursor if empty).
  // X6 steals focus at unpredictable times during dblclick/selection processing.
  // We poll with rAF until our element has focus, then select text. Gives up
  // after 500ms to avoid infinite loops.
  // If initialKey is provided (from keyboard-initiated edit), insert it after
  // focus — this replaces the selected text naturally.
  const focusAndSelect = useCallback((args?: { initialKey?: string }) => {
    const initialKey = args?.initialKey;
    editingRef.current = true;
    setEditing(true);

    const deadline = Date.now() + 500;
    const tryFocus = () => {
      const el = inputRef.current;
      if (!el || !editingRef.current) return;

      // On first attempt, detect if we're in the minimap. If so, abort.
      if (isMinimapRef.current === null) {
        isMinimapRef.current = !!el.closest('.x6-widget-minimap');
      }
      if (isMinimapRef.current) {
        editingRef.current = false;
        setEditing(false);
        return;
      }

      el.focus();
      // Check if we actually got focus
      if (document.activeElement === el) {
        // Focus succeeded — select all text or place cursor
        if (el.textContent) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        // If a key was provided (keyboard-initiated edit), insert it.
        // This replaces any selected text or starts typing in empty node.
        if (initialKey) {
          document.execCommand('insertText', false, initialKey);
        }
        return; // Done!
      }

      // Focus was stolen — retry if within deadline
      if (Date.now() < deadline) {
        requestAnimationFrame(tryFocus);
      }
    };
    // Start trying after a small delay to let React render the contentEditable
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

  // Double-click is handled by X6DiagramEditor at the DOM level.
  // The node component should NOT start editing on its own — that causes
  // state desync with editingNode tracking in the parent.

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation so X6 keyboard handler doesn't intercept
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

  // Shared text style so editing and preview render at the exact same position
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

  // Shape-specific rendering
  switch (d.flowchartShape) {
    case 'diamond':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
            <polygon
              points={`${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}`}
              fill={d.bgColor}
              stroke={d.borderColor === 'transparent' ? 'none' : d.borderColor}
              strokeWidth={2}
            />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>{textEl}</div>
        </div>
      );

    case 'circle':
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: '50%',
            backgroundColor: d.bgColor,
            border: d.borderColor === 'transparent' ? 'none' : `2px solid ${d.borderColor}`,
          }}
        >
          {textEl}
        </div>
      );

    case 'ellipse':
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: '50%',
            backgroundColor: d.bgColor,
            border: d.borderColor === 'transparent' ? 'none' : `2px solid ${d.borderColor}`,
          }}
        >
          {textEl}
        </div>
      );

    case 'parallelogram':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
            <polygon
              points={`${w * 0.15},${h - 2} 2,2 ${w * 0.85},2 ${w - 2},${h - 2}`}
              fill={d.bgColor}
              stroke={d.borderColor === 'transparent' ? 'none' : d.borderColor}
              strokeWidth={2}
            />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, padding: '0 20px' }}>{textEl}</div>
        </div>
      );

    case 'triangle':
      return (
        <div style={{ ...baseStyle, position: 'relative' }}>
          <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
            <polygon
              points={`${w / 2},2 ${w - 2},${h - 2} 2,${h - 2}`}
              fill={d.bgColor}
              stroke={d.borderColor === 'transparent' ? 'none' : d.borderColor}
              strokeWidth={2}
            />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, paddingTop: h * 0.3 }}>{textEl}</div>
        </div>
      );

    case 'stadium':
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: h / 2,
            backgroundColor: d.bgColor,
            border: d.borderColor === 'transparent' ? 'none' : `2px solid ${d.borderColor}`,
          }}
        >
          {textEl}
        </div>
      );

    case 'rect':
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: 0,
            backgroundColor: d.bgColor,
            border: d.borderColor === 'transparent' ? 'none' : `2px solid ${d.borderColor}`,
          }}
        >
          {textEl}
        </div>
      );

    case 'rounded-rect':
    default:
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: 8,
            backgroundColor: d.bgColor,
            border: d.borderColor === 'transparent' ? 'none' : `2px solid ${d.borderColor}`,
          }}
        >
          {textEl}
        </div>
      );
  }
}
