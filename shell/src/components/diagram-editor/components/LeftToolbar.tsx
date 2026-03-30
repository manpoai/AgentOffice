'use client';

import { useState, useCallback, useRef } from 'react';
import type { Graph } from '@antv/x6';
import {
  Type, Brain, ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SHAPE_META, SHAPE_ICON_PATHS, DEFAULT_NODE_COLOR,
  type FlowchartShape, type ConnectorType,
} from '../constants';

export type ActiveTool = 'select' | 'text' | FlowchartShape | 'connector' | 'mindmap';

interface LeftToolbarProps {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  activeConnector: ConnectorType;
  onConnectorChange: (c: ConnectorType) => void;
  graph: Graph | null;
}

function ShapeIcon({ shape, size = 20 }: { shape: FlowchartShape; size?: number }) {
  const path = SHAPE_ICON_PATHS[shape];
  const isBrace = shape === 'brace-left' || shape === 'brace-right';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {isBrace ? (
        <path d={path} fill="none" />
      ) : shape === 'cylinder' ? (
        <>
          <ellipse cx="12" cy="7" rx="8" ry="3" fill="none" />
          <path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" fill="none" />
        </>
      ) : (
        <path d={path} fill="none" />
      )}
    </svg>
  );
}

export function LeftToolbar({ activeTool, onToolChange, activeConnector, onConnectorChange, graph }: LeftToolbarProps) {
  const [showShapes, setShowShapes] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isShapeTool = Object.keys(SHAPE_META).includes(activeTool);

  const handleDragStart = useCallback((shape: FlowchartShape) => (e: React.DragEvent) => {
    const meta = SHAPE_META[shape];
    e.dataTransfer.setData('application/x6-shape', JSON.stringify({
      shape: 'flowchart-node',
      width: meta.width,
      height: meta.height,
      data: {
        label: '',
        flowchartShape: shape,
        bgColor: DEFAULT_NODE_COLOR.bg,
        borderColor: DEFAULT_NODE_COLOR.border,
        textColor: DEFAULT_NODE_COLOR.text,
        fontSize: 14,
        fontWeight: 'normal',
        fontStyle: 'normal',
      },
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const showShapeList = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    setShowShapes(true);
  };

  const scheduleHideShapeList = () => {
    hideTimerRef.current = setTimeout(() => setShowShapes(false), 200);
  };

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-card rounded-xl shadow-lg border border-border p-1.5">
      {/* Text */}
      <ToolButton
        active={activeTool === 'text'}
        onClick={() => { onToolChange('text'); setShowShapes(false); }}
        title="文本 (T)"
      >
        <Type size={18} />
      </ToolButton>

      {/* Shapes: click = activate default (rounded-rect), hover = expand list */}
      <div
        className="relative"
        onMouseEnter={showShapeList}
        onMouseLeave={scheduleHideShapeList}
      >
        <ToolButton
          active={isShapeTool}
          onClick={() => { onToolChange('rounded-rect'); setShowShapes(false); }}
          title="图形 (R)"
        >
          <ShapeIcon shape="rect" size={18} />
        </ToolButton>

        {showShapes && (
          <div
            className="absolute left-full top-0 ml-2 bg-card rounded-lg shadow-lg border border-border p-2 grid grid-cols-6 gap-0.5"
            style={{ width: 220 }}
            onMouseEnter={showShapeList}
            onMouseLeave={scheduleHideShapeList}
          >
            {(Object.keys(SHAPE_META) as FlowchartShape[]).map((key) => (
              <button
                key={key}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors',
                  activeTool === key && 'bg-sidebar-accent text-sidebar-primary',
                )}
                onClick={() => { onToolChange(key); setShowShapes(false); }}
                draggable
                onDragStart={handleDragStart(key)}
              >
                <ShapeIcon shape={key} size={20} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mindmap */}
      <ToolButton
        active={activeTool === 'mindmap'}
        onClick={() => { onToolChange('mindmap'); setShowShapes(false); }}
        title="思维导图 (M)"
      >
        <Brain size={18} />
      </ToolButton>

      {/* Image */}
      <ToolButton
        active={activeTool === 'image' as any}
        onClick={() => {
          if (!graph) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const { tx, ty } = graph.translate();
              const { sx } = graph.scale();
              const container = graph.container;
              const cx = (-tx + container.clientWidth / 2) / sx;
              const cy = (-ty + container.clientHeight / 2) / sx;
              const nodeId = `img_${Date.now().toString(36)}`;
              graph.addNode({
                id: nodeId,
                shape: 'image-node',
                x: cx - 100,
                y: cy - 75,
                width: 200,
                height: 150,
                data: { imageUrl: dataUrl },
              });
              graph.select(graph.getCellById(nodeId)!);
              onToolChange('select');
            };
            reader.readAsDataURL(file);
          };
          input.click();
        }}
        title="图片 (I)"
      >
        <ImageIcon size={18} />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  children, active, onClick, title, disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
        active ? 'bg-sidebar-accent text-sidebar-primary' : 'text-muted-foreground hover:bg-muted',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      onClick={disabled ? undefined : onClick}
      title={title}
    >
      {children}
    </button>
  );
}
