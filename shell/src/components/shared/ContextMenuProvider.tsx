'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { ContextMenuItem } from '@/lib/hooks/use-context-menu';

interface ContextMenuState {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  visible: boolean;
}

const MENU_MIN_WIDTH = 180;
const VIEWPORT_PADDING = 8;

function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
}

// ─── Desktop floating context menu ────────────────────────────────────

function FloatingMenu({
  items,
  position,
  onClose,
}: {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 9999,
    opacity: 0,
  });

  // Calculate position after first render to get actual menu dimensions
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const menuWidth = el.offsetWidth;
    const menuHeight = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let { x, y } = position;

    // Flip left if overflows right
    if (x + menuWidth > vw - VIEWPORT_PADDING) {
      x = Math.max(VIEWPORT_PADDING, x - menuWidth);
    }
    // Flip up if overflows bottom
    if (y + menuHeight > vh - VIEWPORT_PADDING) {
      y = Math.max(VIEWPORT_PADDING, y - menuHeight);
    }

    setStyle({
      position: 'fixed',
      top: y,
      left: x,
      zIndex: 9999,
      opacity: 1,
    });
  }, [position]);

  return (
    <>
      {/* Invisible backdrop to catch outside clicks */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className="fixed z-[9999] min-w-[180px] bg-popover border border-border rounded-lg shadow-xl py-1 overflow-y-auto transition-opacity duration-75"
        style={style}
        role="menu"
      >
        {items.map((item) => (
          <div key={item.id}>
            {item.separator && <div className="border-t border-border my-0.5" />}
            <button
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                item.onClick();
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                item.danger
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-popover-foreground hover:bg-accent',
                item.disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {item.icon && <span className="shrink-0 w-4 h-4 flex items-center justify-center">{item.icon}</span>}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-muted-foreground ml-4 shrink-0">{item.shortcut}</span>
              )}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Mobile bottom sheet ──────────────────────────────────────────────

function BottomSheet({
  items,
  onClose,
}: {
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const currentTranslateY = useRef(0);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 200); // wait for animation
  }, [onClose]);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      currentTranslateY.current = dy;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };

  const handleDragEnd = () => {
    if (currentTranslateY.current > 80) {
      close();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(0)';
    }
    dragStartY.current = null;
    currentTranslateY.current = 0;
  };

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={close}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[9999] bg-popover rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Menu items */}
        <div className="px-2 pb-2">
          {items.map((item) => (
            <div key={item.id}>
              {item.separator && <div className="border-t border-border my-1 mx-2" />}
              <button
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onClick();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors min-h-[44px]',
                  item.danger
                    ? 'text-destructive active:bg-destructive/10'
                    : 'text-popover-foreground active:bg-accent',
                  item.disabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                {item.icon && <span className="shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>}
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            </div>
          ))}

          {/* Cancel button */}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={close}
              className="w-full flex items-center justify-center px-4 py-3 text-base font-medium text-muted-foreground rounded-lg active:bg-accent min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────

export function ContextMenuProvider() {
  const [state, setState] = useState<ContextMenuState>({
    items: [],
    position: { x: 0, y: 0 },
    visible: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Listen for the custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const { items, x, y } = (e as CustomEvent).detail;
      setState({ items, position: { x, y }, visible: true });
    };
    window.addEventListener('show-context-menu', handler);
    return () => window.removeEventListener('show-context-menu', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!state.visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [state.visible, handleClose]);

  if (!mounted || !state.visible || state.items.length === 0) return null;

  const content = isMobile() ? (
    <BottomSheet items={state.items} onClose={handleClose} />
  ) : (
    <FloatingMenu items={state.items} position={state.position} onClose={handleClose} />
  );

  return createPortal(content, document.body);
}
