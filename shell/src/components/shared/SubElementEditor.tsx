'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCssPath, getBreadcrumbs, getSubElementType, isPositioned, type SubElementType } from './sub-element-utils';
import { HANDLES, HANDLE_CURSORS, HANDLE_POS } from '@/components/canvas-editor/CanvasElement';

export interface SubElementSelection {
  cssPath: string;
  tagName: string;
  elementType: SubElementType;
  isPositioned: boolean;
  breadcrumbs: { label: string; cssPath: string }[];
}

interface SubElementEditorProps {
  containerRef: React.RefObject<HTMLElement | ShadowRoot | null>;
  offsetX: number;
  offsetY: number;
  scale: number;
  onSelect: (selection: SubElementSelection | null) => void;
  onDragMove?: (cssPath: string, deltaX: number, deltaY: number) => void;
  onDragEnd?: (cssPath: string) => void;
  onResize?: (cssPath: string, changes: { left?: number; top?: number; width?: number; height?: number }) => void;
  onTextEditChange?: (editing: boolean) => void;
  onExit: () => void;
}

interface RelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function SubElementEditor({
  containerRef,
  offsetX,
  offsetY,
  scale,
  onSelect,
  onDragMove,
  onDragEnd,
  onResize,
  onTextEditChange,
  onExit,
}: SubElementEditorProps) {
  const [hoverRect, setHoverRect] = useState<RelRect | null>(null);
  const [selectedRect, setSelectedRect] = useState<RelRect | null>(null);
  const [selectedIsPositioned, setSelectedIsPositioned] = useState(false);
  const [selectedCssPath, setSelectedCssPath] = useState<string | null>(null);
  const [textEditing, setTextEditing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    cssPath: string;
    startClientX: number;
    startClientY: number;
    canDrag: boolean;
    active: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    cssPath: string;
    handle: string;
    startClientX: number;
    startClientY: number;
    origLeft: number;
    origTop: number;
    origWidth: number;
    origHeight: number;
  } | null>(null);

  const getRoot = useCallback((): Element | null => {
    const container = containerRef.current;
    if (!container) return null;
    if (container instanceof ShadowRoot) {
      let el = container.firstElementChild;
      while (el && el.tagName === 'STYLE') el = el.nextElementSibling;
      return el;
    }
    return container as Element;
  }, [containerRef]);

  const toRelRect = useCallback((el: Element): RelRect | null => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const oRect = overlay.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return {
      left: eRect.left - oRect.left,
      top: eRect.top - oRect.top,
      width: eRect.width,
      height: eRect.height,
    };
  }, []);

  const getElementAtPoint = useCallback(
    (clientX: number, clientY: number): Element | null => {
      const root = getRoot();
      if (!root) return null;
      let deepest: Element | null = null;
      const walk = (el: Element) => {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
          deepest = el;
          for (let i = 0; i < el.children.length; i++) {
            walk(el.children[i]);
          }
        }
      };
      for (let i = 0; i < root.children.length; i++) {
        walk(root.children[i]);
      }
      return deepest || root;
    },
    [getRoot]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = (e.clientX - r.startClientX) / scale;
        const dy = (e.clientY - r.startClientY) / scale;
        let { origLeft: left, origTop: top, origWidth: width, origHeight: height } = r;
        if (r.handle.includes('e')) width = Math.max(10, width + dx);
        if (r.handle.includes('w')) { const nw = Math.max(10, width - dx); left += width - nw; width = nw; }
        if (r.handle.includes('s')) height = Math.max(10, height + dy);
        if (r.handle.includes('n')) { const nh = Math.max(10, height - dy); top += height - nh; height = nh; }
        onResize?.(r.cssPath, { left, top, width, height });
        return;
      }
      if (dragRef.current?.active) {
        const dx = (e.clientX - dragRef.current.startClientX) / scale;
        const dy = (e.clientY - dragRef.current.startClientY) / scale;
        onDragMove?.(dragRef.current.cssPath, dx, dy);
        return;
      }
      const el = getElementAtPoint(e.clientX, e.clientY);
      if (el && el !== getRoot()) {
        setHoverRect(toRelRect(el));
      } else {
        setHoverRect(null);
      }
    },
    [getElementAtPoint, getRoot, scale, onDragMove, onResize, toRelRect]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const el = getElementAtPoint(e.clientX, e.clientY);
      const root = getRoot();
      if (!el || !root || el === root) {
        onExit();
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      const cssPath = getCssPath(el, root);
      const positioned = isPositioned(el as HTMLElement);
      setSelectedCssPath(cssPath);
      setSelectedRect(toRelRect(el));
      setSelectedIsPositioned(positioned);
      onSelect({
        cssPath,
        tagName: el.tagName.toLowerCase(),
        elementType: getSubElementType(el),
        isPositioned: positioned,
        breadcrumbs: getBreadcrumbs(root, cssPath),
      });
      dragRef.current = {
        cssPath,
        startClientX: e.clientX,
        startClientY: e.clientY,
        canDrag: positioned,
        active: false,
      };
    },
    [getElementAtPoint, getRoot, onSelect, onExit, toRelRect]
  );

  const handleMouseMoveForDrag = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current && !dragRef.current.active && dragRef.current.canDrag) {
        const dx = Math.abs(e.clientX - dragRef.current.startClientX);
        const dy = Math.abs(e.clientY - dragRef.current.startClientY);
        if (dx > 3 || dy > 3) {
          dragRef.current.active = true;
        }
      }
      handleMouseMove(e);
    },
    [handleMouseMove]
  );

  const handleMouseUp = useCallback(
    () => {
      if (resizeRef.current) {
        onDragEnd?.(resizeRef.current.cssPath);
        resizeRef.current = null;
        return;
      }
      if (dragRef.current?.active) {
        onDragEnd?.(dragRef.current.cssPath);
      }
      dragRef.current = null;
    },
    [onDragEnd]
  );

  const handleResizeStart = useCallback(
    (handle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!selectedCssPath || !selectedRect) return;
      const root = getRoot();
      if (!root) return;
      const target = root.querySelector(selectedCssPath) as HTMLElement;
      if (!target) return;
      resizeRef.current = {
        cssPath: selectedCssPath,
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origLeft: parseFloat(target.style.left) || 0,
        origTop: parseFloat(target.style.top) || 0,
        origWidth: parseFloat(target.style.width) || target.offsetWidth,
        origHeight: parseFloat(target.style.height) || target.offsetHeight,
      };
    },
    [selectedCssPath, selectedRect, getRoot]
  );

  const exitTextEditing = useCallback(() => {
    setTextEditing(false);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const el = getElementAtPoint(e.clientX, e.clientY) as HTMLElement;
      if (!el) return;
      const root = getRoot();
      if (!root || el === root) return;
      if (el.children.length === 0 && el.textContent?.trim()) {
        el.contentEditable = 'true';
        el.style.outline = '2px solid #10b981';
        el.style.outlineOffset = '-1px';
        el.style.borderRadius = '2px';
        setTextEditing(true);
        onTextEditChange?.(true);
        setTimeout(() => el.focus(), 0);
        const handleKeyDown = (evt: Event) => {
          evt.stopPropagation();
          if ((evt as KeyboardEvent).key === 'Escape') {
            evt.preventDefault();
            el.blur();
          }
        };
        el.addEventListener('keydown', handleKeyDown);
        el.addEventListener('blur', () => {
          el.contentEditable = 'false';
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.style.borderRadius = '';
          el.removeEventListener('keydown', handleKeyDown);
          setTextEditing(false);
          onTextEditChange?.(false);
          onDragEnd?.(getCssPath(el, root));
        }, { once: true });
      }
    },
    [getElementAtPoint, getRoot, onDragEnd]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !textEditing) {
        e.stopPropagation();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, textEditing]);

  useEffect(() => {
    if (!selectedCssPath) return;
    const root = getRoot();
    if (!root) return;
    const el = root.querySelector(selectedCssPath);
    if (el) setSelectedRect(toRelRect(el));
  });

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute', inset: 0,
        cursor: dragRef.current?.active ? 'grabbing' : 'default',
        zIndex: 100,
        pointerEvents: textEditing ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveForDrag}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Hover outline */}
      {hoverRect && !dragRef.current?.active && !resizeRef.current && (
        <div style={{
          position: 'absolute', left: hoverRect.left, top: hoverRect.top,
          width: hoverRect.width, height: hoverRect.height,
          border: '2px solid rgba(59, 130, 246, 0.5)',
          pointerEvents: 'none', borderRadius: 2,
        }} />
      )}
      {/* Selected: border + size label + resize handles for positioned */}
      {selectedRect && (
        <>
          <div style={{
            position: 'absolute', left: selectedRect.left, top: selectedRect.top,
            width: selectedRect.width, height: selectedRect.height,
            border: '2px solid #3b82f6',
            pointerEvents: 'none', borderRadius: 2,
          }} />
          <div style={{
            position: 'absolute',
            left: selectedRect.left + selectedRect.width / 2,
            top: selectedRect.top + selectedRect.height + 4,
            transform: 'translateX(-50%)',
            fontSize: 10, lineHeight: '16px', padding: '0 6px',
            background: '#3b82f6', color: 'white',
            borderRadius: 3, pointerEvents: 'none', whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            {Math.round(selectedRect.width / scale)} × {Math.round(selectedRect.height / scale)}
          </div>
          {selectedIsPositioned && HANDLES.map(h => (
            <div key={h} style={{
              position: 'absolute',
              left: selectedRect.left + (parseFloat(HANDLE_POS[h].left) / 100) * selectedRect.width - 4,
              top: selectedRect.top + (parseFloat(HANDLE_POS[h].top) / 100) * selectedRect.height - 4,
              width: 8, height: 8,
              background: '#fff', border: '2px solid #3b82f6',
              borderRadius: 2, cursor: HANDLE_CURSORS[h],
              pointerEvents: 'auto', zIndex: 10,
            }}
              onMouseDown={(e) => handleResizeStart(h, e)}
            />
          ))}
        </>
      )}
    </div>
  );
}
