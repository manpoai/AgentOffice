'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface SubElementSelection {
  cssPath: string;
  rect: DOMRect;
}

interface SubElementEditorProps {
  containerRef: React.RefObject<HTMLElement>;
  offsetX: number;
  offsetY: number;
  scale: number;
  onSelect: (sel: SubElementSelection | null) => void;
  onDragMove: (cssPath: string, totalDx: number, totalDy: number) => void;
  onDragEnd: () => void;
  onResize: (cssPath: string, changes: { left?: number; top?: number; width?: number; height?: number }) => void;
  onTextEditChange: (editing: boolean) => void;
  onExit: () => void;
}

export function SubElementEditor({
  containerRef, offsetX, offsetY, scale,
  onSelect, onDragMove, onDragEnd, onResize, onTextEditChange, onExit,
}: SubElementEditorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target === container || target === overlayRef.current) {
        onExit();
        return;
      }
      const path = getCssPath(target, container);
      if (path) {
        const rect = target.getBoundingClientRect();
        onSelect({ cssPath: path, rect });
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [containerRef, onSelect, onExit]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: 'crosshair',
      }}
    />
  );
}

function getCssPath(el: HTMLElement, root: HTMLElement): string | null {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children);
    const idx = siblings.indexOf(current);
    const tag = current.tagName.toLowerCase();
    parts.unshift(`${tag}:nth-child(${idx + 1})`);
    current = parent;
  }
  return parts.length > 0 ? parts.join(' > ') : null;
}
