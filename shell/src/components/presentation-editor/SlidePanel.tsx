'use client';

import { Plus, Table2 } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SlideData, SLIDE_WIDTH, SLIDE_HEIGHT, THUMB_WIDTH } from './types';
import { pptSlideActions, type PPTSlideCtx } from '@/actions/ppt-slide.actions';
import { pptSurfaces } from '@/surfaces/ppt.surfaces';
import { toContextMenuItems } from '@/surfaces/bridge';
import { buildActionMap } from '@/actions/types';
import { useT } from '@/lib/i18n';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

const pptSlideActionMap = buildActionMap(pptSlideActions);

// ─── Slide Thumbnail ─────────────────────────────────
function SlideThumb({ slide }: { slide: SlideData }) {
  if (slide.thumbnail) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={slide.thumbnail}
          alt="Slide preview"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }
  const scale = THUMB_WIDTH / SLIDE_WIDTH;
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: slide.background || '#fff' }}>
      {slide.backgroundImage && (
        <img src={slide.backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {slide.elements.slice(0, 10).map((el, i) => {
        const w = (el.width || 100) * scale * (el.scaleX || 1);
        const h = (el.height || 50) * scale * (el.scaleY || 1);
        const style: React.CSSProperties = {
          position: 'absolute',
          left: (el.left || 0) * scale,
          top: (el.top || 0) * scale,
          width: w,
          height: h,
          overflow: 'hidden',
        };
        if (el.type === 'textbox') {
          const scaledFont = (el.fontSize || 24) * scale;
          if (scaledFont < 6) {
            const barH = Math.max(2, Math.round(scaledFont * 0.8));
            return (
              <div key={i} style={{ ...style }}>
                {(el.text || '').split('\n').slice(0, 3).map((line: string, li: number) => (
                  <div key={li} style={{ height: barH, width: `${Math.min(100, Math.max(20, (line.length / 30) * 100))}%`, backgroundColor: el.fill || '#333', opacity: 0.4, borderRadius: 1, marginBottom: 1 }} />
                ))}
              </div>
            );
          }
          return <div key={i} style={{ ...style, fontSize: scaledFont, lineHeight: '1.2', color: el.fill || '#333' }}>{el.text?.slice(0, 30)}</div>;
        }
        if (el.type === 'rect') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: (el.rx || 0) * scale }} />;
        if (el.type === 'circle') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: '50%' }} />;
        if (el.type === 'triangle') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />;
        if (el.type === 'ellipse') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: '50%' }} />;
        if (el.type === 'shape') return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0', borderRadius: 4 }} />;
        if (el.type === 'image') return <img key={i} src={el.src} alt="" style={{ ...style, objectFit: 'cover' }} />;
        if (el.type === 'table') return <div key={i} style={{ ...style, backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}><Table2 className="w-full h-full text-muted-foreground/30 p-0.5" /></div>;
        return <div key={i} style={{ ...style, backgroundColor: el.fill || '#e2e8f0' }} />;
      })}
    </div>
  );
}

// ─── Sortable Slide Item ──────────────────────────────
interface SortableSlideItemProps {
  slide: SlideData;
  index: number;
  isSelected: boolean;
  onClick: (i: number, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, i: number) => void;
}

function SortableSlideItem({ slide, index, isSelected, onClick, onContextMenu }: SortableSlideItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        {...listeners}
        onClick={(e) => onClick(index, e)}
        onContextMenu={(e) => onContextMenu(e, index)}
        className={cn(
          'w-[160px] rounded border transition-all overflow-hidden cursor-grab active:cursor-grabbing',
          isSelected
            ? 'border-[#2FCC71] border-2'
            : 'border-black/10 dark:border-white/10 hover:border-black/20'
        )}
      >
        <div
          className="relative w-full rounded-sm overflow-hidden"
          style={{ aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}`, backgroundColor: slide.background || '#fff' }}
        >
          <SlideThumb slide={slide} />
        </div>
      </button>
    </div>
  );
}

// ─── Slide Panel ─────────────────────────────────────
export interface SlidePanelProps {
  slides: SlideData[];
  currentSlideIndex: number;
  selectedIndices: Set<number>;
  onSlideSelect: (index: number) => void;
  onMultiSelect: (indices: Set<number>) => void;
  onAddSlide: () => void;
  onSlideCut: (i: number) => void;
  onSlideCopy: (i: number) => void;
  onSlidePaste: (i: number) => void;
  onSlideDelete: (i: number) => void;
  onSlideDuplicate: (i: number) => void;
  onSlideBackground: (i: number) => void;
  onSlideComment: (i: number) => void;
  onSlideDragEnd: (fromIndex: number, toIndex: number) => void;
}

export function SlidePanel({
  slides,
  currentSlideIndex,
  selectedIndices,
  onSlideSelect,
  onMultiSelect,
  onAddSlide,
  onSlideCut,
  onSlideCopy,
  onSlidePaste,
  onSlideDelete,
  onSlideDuplicate,
  onSlideBackground,
  onSlideComment,
  onSlideDragEnd,
}: SlidePanelProps) {
  const { t } = useT();
  const lastClickedIdx = useRef<number>(currentSlideIndex);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleClick = useCallback((i: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIndices);
      if (next.has(i)) {
        next.delete(i);
        if (next.size === 0) next.add(currentSlideIndex);
      } else {
        next.add(i);
      }
      onMultiSelect(next);
      lastClickedIdx.current = i;
    } else if (e.shiftKey && selectedIndices.size > 0) {
      const from = Math.min(lastClickedIdx.current, i);
      const to = Math.max(lastClickedIdx.current, i);
      const next = new Set<number>();
      for (let idx = from; idx <= to; idx++) next.add(idx);
      onMultiSelect(next);
    } else {
      onSlideSelect(i);
      onMultiSelect(new Set([i]));
      lastClickedIdx.current = i;
    }
  }, [selectedIndices, currentSlideIndex, onSlideSelect, onMultiSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIndices.has(i)) {
      onSlideSelect(i);
      onMultiSelect(new Set([i]));
    }
    const isMulti = selectedIndices.size > 1;
    const ctx: PPTSlideCtx = {
      slideIndex: i,
      isMultiSelect: isMulti,
      onSlideCut,
      onSlideCopy,
      onSlidePaste,
      onSlideDelete,
      onSlideDuplicate,
      onSlideBackground,
      onSlideComment,
    };
    const surface = isMulti ? pptSurfaces.slideMulti : pptSurfaces.slideSingle;
    const items = toContextMenuItems(surface, pptSlideActionMap, ctx, t);
    if (items.length > 0) {
      window.dispatchEvent(new CustomEvent('show-context-menu', {
        detail: { items, x: e.clientX, y: e.clientY },
      }));
    }
  }, [selectedIndices, onSlideSelect, onMultiSelect, onSlideCut, onSlideCopy, onSlidePaste, onSlideDelete, onSlideDuplicate, onSlideBackground, onSlideComment, t]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = slides.findIndex(s => s.id === active.id);
    const toIndex = slides.findIndex(s => s.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    onSlideDragEnd(fromIndex, toIndex);
  }, [slides, onSlideDragEnd]);

  return (
    <div className="w-[192px] flex-col shrink-0 bg-[#F5F7F5] dark:bg-sidebar hidden md:flex shadow-[0px_0px_20px_0px_rgba(0,0,0,0.02)]">
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onAddSlide}
          className="w-[160px] h-8 flex items-center gap-2 px-3 rounded border border-black/10 dark:border-white/10 bg-white/20 dark:bg-white/10 text-sm font-medium text-black/70 dark:text-white/70 hover:bg-white/40 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Slide
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={slides.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {slides.map((slide, i) => (
              <SortableSlideItem
                key={slide.id}
                slide={slide}
                index={i}
                isSelected={selectedIndices.has(i)}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
