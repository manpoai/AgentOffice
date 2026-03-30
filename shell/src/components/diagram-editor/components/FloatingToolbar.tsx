'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Graph, Node, Edge, Cell } from '@antv/x6';
import {
  Bold, Italic, Underline, Trash2, Copy, ArrowUp, ArrowDown, MoreHorizontal, Type, ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NODE_COLORS, SHAPE_META, CONNECTOR_META,
  FILL_COLORS, BORDER_COLORS, FONT_SIZES, EDGE_WIDTHS,
  type FlowchartShape, type ConnectorType,
} from '../constants';

interface FloatingToolbarProps {
  graph: Graph | null;
}

export function FloatingToolbar({ graph }: FloatingToolbarProps) {
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Track selection
  useEffect(() => {
    if (!graph) return;

    const updateSelection = () => {
      const cells = graph.getSelectedCells();
      if (cells.length === 1) {
        const cell = cells[0];
        setSelectedCell(cell);
        updatePosition(cell);
      } else {
        setSelectedCell(null);
        setPosition(null);
      }
      setShowMore(false);
    };

    const updatePosition = (cell: Cell) => {
      if (!cell.isNode()) {
        // For edges, position toolbar near the edge midpoint
        const edge = cell as Edge;
        const sourceCell = edge.getSourceCell();
        const targetCell = edge.getTargetCell();
        if (sourceCell?.isNode() && targetCell?.isNode()) {
          // Use source/target node positions (local coords) to find edge midpoint
          const sp = (sourceCell as Node).position();
          const ss = (sourceCell as Node).size();
          const tp = (targetCell as Node).position();
          const ts = (targetCell as Node).size();
          const sx = sp.x + ss.width / 2, sy = sp.y + ss.height / 2;
          const tx = tp.x + ts.width / 2, ty = tp.y + ts.height / 2;
          const midLocal = { x: (sx + tx) / 2, y: Math.min(sy, ty) };
          const graphPoint = graph.localToGraph(midLocal.x, midLocal.y);
          setPosition({ x: graphPoint.x, y: graphPoint.y - 40 });
        } else {
          // Fallback: use edge vertices or source/target points
          const vertices = edge.getVertices();
          if (vertices.length > 0) {
            const v = vertices[Math.floor(vertices.length / 2)];
            const gp = graph.localToGraph(v.x, v.y);
            setPosition({ x: gp.x, y: gp.y - 40 });
          }
        }
        return;
      }
      const node = cell as Node;
      const pos = node.position();
      const size = node.size();
      const graphPoint = graph.localToGraph(pos.x + size.width / 2, pos.y);
      setPosition({ x: graphPoint.x, y: graphPoint.y - 50 });
    };

    graph.on('selection:changed', updateSelection);
    graph.on('node:moved', () => {
      if (selectedCell?.isNode()) updatePosition(selectedCell);
    });

    return () => {
      graph.off('selection:changed', updateSelection);
    };
  }, [graph, selectedCell]);

  // Close toolbar on click outside
  useEffect(() => {
    if (!selectedCell) return;
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as HTMLElement)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selectedCell]);

  if (!graph || !selectedCell || !position) return null;

  const isNode = selectedCell.isNode();
  const isEdge = selectedCell.isEdge();
  const data = selectedCell.getData() || {};
  const isMindmap = data.mindmapGroupId;

  const updateData = (updates: Record<string, any>) => {
    selectedCell.setData({ ...selectedCell.getData(), ...updates }, { silent: false });
  };

  const handleDelete = () => {
    graph.removeCells([selectedCell]);
    setSelectedCell(null);
    setPosition(null);
  };

  const handleCopy = () => {
    graph.copy([selectedCell]);
  };

  return (
    <div
      ref={toolbarRef}
      className="absolute z-30 flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 px-1 py-0.5"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
      }}
    >
      {isNode && !isMindmap && data.flowchartShape !== undefined && (
        <>
          {/* Shape switch */}
          <ShapeSelector
            current={data.flowchartShape || 'rounded-rect'}
            onChange={(s) => updateData({ flowchartShape: s })}
          />
          <Divider />
          {/* Fill color */}
          <FillColorPicker
            color={data.bgColor || '#ffffff'}
            onChange={(c) => updateData({ bgColor: c })}
          />
          {/* Border color */}
          <BorderColorPicker
            color={data.borderColor || '#374151'}
            onChange={(c) => updateData({ borderColor: c })}
          />
          <Divider />
          {/* Font size */}
          <FontSizePicker
            size={data.fontSize || 14}
            onChange={(s) => updateData({ fontSize: s })}
          />
          {/* Font controls */}
          <FontButton
            icon={<Bold size={14} />}
            active={data.fontWeight === 'bold'}
            onClick={() => updateData({ fontWeight: data.fontWeight === 'bold' ? 'normal' : 'bold' })}
          />
          <FontButton
            icon={<Italic size={14} />}
            active={data.fontStyle === 'italic'}
            onClick={() => updateData({ fontStyle: data.fontStyle === 'italic' ? 'normal' : 'italic' })}
          />
        </>
      )}

      {isNode && !isMindmap && selectedCell.shape === 'image-node' && (
        <>
          {/* Replace image */}
          <FontButton
            icon={<ImageIcon size={14} />}
            active={false}
            onClick={() => (selectedCell as Node).trigger('image:replace')}
            title="替换图片"
          />
        </>
      )}

      {isEdge && (
        <>
          {/* Edge color */}
          <EdgeColorButton edge={selectedCell as Edge} graph={graph} />
          <Divider />
          {/* Line width */}
          <EdgeWidthPicker edge={selectedCell as Edge} />
          {/* Line style */}
          <LineStyleButton edge={selectedCell as Edge} graph={graph} />
          <Divider />
          {/* Connector type */}
          <ConnectorTypeButton edge={selectedCell as Edge} graph={graph} />
          <Divider />
          {/* Edge label */}
          <EdgeLabelButton edge={selectedCell as Edge} graph={graph} />
        </>
      )}

      {isMindmap && (
        <>
          <FillColorPicker
            color={data.bgColor || '#ffffff'}
            onChange={(c) => updateData({ bgColor: c })}
          />
          <BorderColorPicker
            color={data.borderColor || '#374151'}
            onChange={(c) => updateData({ borderColor: c })}
          />
          <Divider />
          <FontSizePicker
            size={data.fontSize || 14}
            onChange={(s) => updateData({ fontSize: s })}
          />
          <FontButton
            icon={<Bold size={14} />}
            active={data.fontWeight === 'bold'}
            onClick={() => updateData({ fontWeight: data.fontWeight === 'bold' ? 'normal' : 'bold' })}
          />
        </>
      )}

      <Divider />

      {/* Common actions */}
      <FontButton icon={<Copy size={14} />} active={false} onClick={handleCopy} title="复制" />
      <FontButton icon={<Trash2 size={14} />} active={false} onClick={handleDelete} title="删除" />

      {/* More */}
      <div className="relative">
        <FontButton icon={<MoreHorizontal size={14} />} active={showMore} onClick={() => setShowMore(!showMore)} title="更多" />
        {showMore && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-32">
            <MoreMenuItem label="置顶" onClick={() => { selectedCell.toFront(); setShowMore(false); }} />
            <MoreMenuItem label="置底" onClick={() => { selectedCell.toBack(); setShowMore(false); }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

function FontButton({ icon, active, onClick, title }: { icon: React.ReactNode; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded transition-colors',
        active ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100',
      )}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
}

function ShapeSelector({ current, onChange }: { current: FlowchartShape; onChange: (s: FlowchartShape) => void }) {
  const [open, setOpen] = useState(false);
  const meta = SHAPE_META[current] || SHAPE_META['rounded-rect'];

  return (
    <div className="relative">
      <button
        className="h-7 px-1.5 flex items-center gap-1 rounded hover:bg-gray-100 text-sm text-gray-700"
        onClick={() => setOpen(!open)}
      >
        <span>{meta.icon}</span>
        <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 grid grid-cols-2 gap-0.5 w-[180px] z-40">
          {(Object.entries(SHAPE_META) as [FlowchartShape, typeof SHAPE_META[FlowchartShape]][]).map(([key, m]) => (
            <button
              key={key}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-gray-100',
                current === key && 'bg-blue-50 text-blue-600',
              )}
              onClick={() => { onChange(key); setOpen(false); }}
            >
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorButton({ color, onChange }: { color: string; onChange: (c: typeof NODE_COLORS[0]) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => setOpen(!open)}
        title="填充色"
      >
        <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: color }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-wrap gap-1 w-[140px] z-40">
          {NODE_COLORS.map((c, i) => (
            <button
              key={i}
              className={cn('w-6 h-6 rounded border transition-transform hover:scale-110', color === c.bg && 'ring-2 ring-blue-500')}
              style={{ backgroundColor: c.bg, borderColor: c.border }}
              onClick={() => { onChange(c); setOpen(false); }}
              title={c.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FillColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => setOpen(!open)}
        title="填充色"
      >
        <div
          className="w-4 h-4 rounded border border-gray-300"
          style={{
            backgroundColor: color === 'transparent' ? '#fff' : color,
            backgroundImage: color === 'transparent'
              ? 'linear-gradient(45deg, #f87171 50%, transparent 50%), linear-gradient(-45deg, #f87171 50%, transparent 50%)'
              : 'none',
            backgroundSize: color === 'transparent' ? '100% 2px, 100% 2px' : 'auto',
          }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-wrap gap-1 w-[160px] z-40">
          {FILL_COLORS.map((c, i) => (
            <button
              key={i}
              className={cn('w-6 h-6 rounded border transition-transform hover:scale-110', color === c && 'ring-2 ring-blue-500')}
              style={{
                backgroundColor: c === 'transparent' ? '#fff' : c,
                borderColor: c === 'transparent' ? '#ef4444' : '#d1d5db',
              }}
              onClick={() => { onChange(c); setOpen(false); }}
              title={c === 'transparent' ? '无填充' : c}
            >
              {c === 'transparent' && <span className="text-red-500 text-xs leading-none">∅</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BorderColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => setOpen(!open)}
        title="边框色"
      >
        <div
          className="w-4 h-4 rounded"
          style={{
            border: color === 'transparent' ? '2px dashed #d1d5db' : `2px solid ${color}`,
          }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-wrap gap-1 w-[160px] z-40">
          {BORDER_COLORS.map((c, i) => (
            <button
              key={i}
              className={cn('w-6 h-6 rounded transition-transform hover:scale-110', color === c && 'ring-2 ring-blue-500')}
              style={{
                border: c === 'transparent' ? '2px dashed #d1d5db' : `3px solid ${c}`,
                backgroundColor: '#fff',
              }}
              onClick={() => { onChange(c); setOpen(false); }}
              title={c === 'transparent' ? '无边框' : c}
            >
              {c === 'transparent' && <span className="text-gray-400 text-xs leading-none">∅</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FontSizePicker({ size, onChange }: { size: number; onChange: (s: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="h-7 px-1.5 flex items-center gap-0.5 rounded hover:bg-gray-100 text-xs text-gray-600 min-w-[32px] justify-center"
        onClick={() => setOpen(!open)}
        title="字号"
      >
        {size}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-16 z-40">
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              className={cn(
                'w-full px-2 py-1 text-xs text-center hover:bg-gray-100',
                size === s && 'bg-blue-50 text-blue-600',
              )}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EdgeWidthPicker({ edge }: { edge: Edge }) {
  const [open, setOpen] = useState(false);
  const lineAttrs = edge.getAttrs()?.line || {};
  const currentWidth = (lineAttrs as any).strokeWidth || 2;

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => setOpen(!open)}
        title="线宽"
      >
        <div className="w-4 flex flex-col items-center justify-center gap-0.5">
          <div className="w-full bg-gray-500 rounded" style={{ height: Math.max(1, currentWidth) }} />
        </div>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-20 z-40">
          {EDGE_WIDTHS.map((w) => (
            <button
              key={w}
              className={cn(
                'w-full px-2 py-1.5 flex items-center gap-2 hover:bg-gray-100',
                currentWidth === w && 'bg-blue-50',
              )}
              onClick={() => { edge.attr('line/strokeWidth', w); setOpen(false); }}
            >
              <div className="flex-1 bg-gray-600 rounded" style={{ height: Math.max(1, w) }} />
              <span className="text-xs text-gray-500">{w}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EdgeColorButton({ edge, graph }: { edge: Edge; graph: Graph }) {
  const [open, setOpen] = useState(false);
  const lineAttrs = edge.getAttrs()?.line || {};
  const currentColor = (lineAttrs as any).stroke || '#94a3b8';

  const colors = ['#94a3b8', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#f97316', '#374151'];

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => setOpen(!open)}
        title="线条颜色"
      >
        <div className="w-4 h-1 rounded" style={{ backgroundColor: currentColor }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-wrap gap-1 w-[140px] z-40">
          {colors.map((c) => (
            <button
              key={c}
              className={cn('w-6 h-6 rounded border border-gray-200 transition-transform hover:scale-110', currentColor === c && 'ring-2 ring-blue-500')}
              style={{ backgroundColor: c }}
              onClick={() => { edge.attr('line/stroke', c); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LineStyleButton({ edge, graph }: { edge: Edge; graph: Graph }) {
  const [open, setOpen] = useState(false);
  const lineAttrs = edge.getAttrs()?.line || {};
  const isDashed = !!(lineAttrs as any).strokeDasharray;

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-xs text-gray-600"
        onClick={() => setOpen(!open)}
        title="线型"
      >
        {isDashed ? '┄' : '━'}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-24 z-40">
          <button className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100" onClick={() => { edge.attr('line/strokeDasharray', ''); setOpen(false); }}>实线 ━</button>
          <button className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100" onClick={() => { edge.attr('line/strokeDasharray', '8 4'); setOpen(false); }}>虚线 ┄</button>
          <button className="w-full px-2 py-1 text-xs text-left hover:bg-gray-100" onClick={() => { edge.attr('line/strokeDasharray', '2 4'); setOpen(false); }}>点线 ┈</button>
        </div>
      )}
    </div>
  );
}

function ConnectorTypeButton({ edge, graph }: { edge: Edge; graph: Graph }) {
  const [open, setOpen] = useState(false);

  // Detect current connector type from edge's router/connector
  const router = edge.getRouter();
  const connector = edge.getConnector();
  const routerName = typeof router === 'object' ? (router as any).name : (router || 'manhattan');
  const connectorName = typeof connector === 'object' ? (connector as any).name : (connector || 'rounded');

  let currentType: ConnectorType = 'manhattan';
  if (routerName === 'normal' && connectorName === 'normal') currentType = 'straight';
  else if (routerName === 'normal' && connectorName === 'smooth') currentType = 'smooth';
  else if (routerName === 'orth') currentType = 'rounded';

  const labels: Record<ConnectorType, string> = {
    straight: '╱',
    manhattan: '⊞',
    rounded: '⌐',
    smooth: '∿',
  };

  const setConnectorType = (type: ConnectorType) => {
    const meta = CONNECTOR_META[type];
    edge.setRouter({ name: meta.router });
    edge.setConnector({ name: meta.connector, args: meta.connector === 'rounded' ? { radius: 8 } : undefined });
    // Clear manually set vertices when switching to manhattan (it auto-routes)
    if (type === 'manhattan') {
      edge.setVertices([]);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-xs text-gray-600"
        onClick={() => setOpen(!open)}
        title="连线类型"
      >
        {labels[currentType]}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-28 z-40">
          {(Object.entries(CONNECTOR_META) as [ConnectorType, typeof CONNECTOR_META[ConnectorType]][]).map(([key, meta]) => (
            <button
              key={key}
              className={cn(
                'w-full px-2 py-1 text-xs text-left hover:bg-gray-100 flex items-center gap-2',
                currentType === key && 'bg-blue-50 text-blue-600',
              )}
              onClick={() => setConnectorType(key)}
            >
              <span>{labels[key]}</span>
              <span>{meta.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EdgeLabelButton({ edge, graph }: { edge: Edge; graph: Graph }) {
  const labels = edge.getLabels();
  const hasLabel = labels.length > 0 && !!(labels[0]?.attrs?.text as any)?.text;

  const startEdit = () => {
    const currentText = hasLabel ? String((labels[0].attrs?.text as any)?.text || '') : '';

    // Position input at edge midpoint using source/target node positions
    const sourceCell = edge.getSourceCell();
    const targetCell = edge.getTargetCell();
    if (!sourceCell?.isNode() || !targetCell?.isNode()) return;
    const sp = (sourceCell as Node).position();
    const ss = (sourceCell as Node).size();
    const tp = (targetCell as Node).position();
    const ts = (targetCell as Node).size();
    const sx = sp.x + ss.width / 2, sy = sp.y + ss.height / 2;
    const tx = tp.x + ts.width / 2, ty = tp.y + ts.height / 2;
    const midPoint = graph.localToGraph((sx + tx) / 2, (sy + ty) / 2);
    const inputX = midPoint.x;
    const inputY = midPoint.y;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.placeholder = '输入标签...';
    input.style.cssText = `
      position: absolute;
      left: ${inputX}px;
      top: ${inputY - 14}px;
      transform: translateX(-50%);
      z-index: 100;
      padding: 2px 8px;
      border: 2px solid #3b82f6;
      border-radius: 4px;
      outline: none;
      font-size: 12px;
      min-width: 80px;
      text-align: center;
      background: white;
    `;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const text = input.value.trim();
      if (text) {
        edge.setLabels([{
          attrs: {
            text: { text, fontSize: 12, fill: '#374151' },
            rect: { fill: '#fff', stroke: '#e5e7eb', strokeWidth: 1, rx: 3, ry: 3 },
          },
          position: 0.5,
        }]);
      } else {
        edge.setLabels([]);
      }
      input.remove();
    };

    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
      if (ke.key === 'Escape') { ke.preventDefault(); input.remove(); }
    });
    input.addEventListener('blur', commit);

    graph.container.parentElement?.appendChild(input);
    input.focus();
    input.select();
  };

  return (
    <button
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded transition-colors',
        hasLabel ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100',
      )}
      onClick={startEdit}
      title="文字标签"
    >
      <Type size={14} />
    </button>
  );
}

function MoreMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-100" onClick={onClick}>
      {label}
    </button>
  );
}
