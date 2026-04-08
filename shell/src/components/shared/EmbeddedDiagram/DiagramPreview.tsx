/**
 * DiagramPreview — Static SVG preview of a diagram.
 *
 * Renders diagram cells as lightweight SVG without
 * loading the full X6 graph library. Used for thumbnails,
 * embeds in documents, and presentation slides.
 */

import React, { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DiagramCell {
  id: string;
  shape?: string;
  source?: string | { cell: string };
  target?: string | { cell: string };
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  data?: { label?: string; bgColor?: string; borderColor?: string; textColor?: string; flowchartShape?: string };
  attrs?: {
    body?: { fill?: string; stroke?: string; rx?: number; ry?: number };
    label?: { text?: string; fill?: string; fontSize?: number };
    line?: { stroke?: string; strokeWidth?: number; strokeDasharray?: string };
  };
  labels?: Array<{ attrs?: { label?: { text?: string } } }>;
}

export interface DiagramData {
  cells: DiagramCell[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface DiagramPreviewProps {
  data: DiagramData;
  width?: number;
  height?: number;
  className?: string;
}

export function DiagramPreview({
  data,
  width = 400,
  height = 300,
  className,
}: DiagramPreviewProps) {
  const reactId = useId();
  const markerId = `arrowhead-${reactId.replace(/:/g, '')}`;

  const { viewBox, nodes, edges } = useMemo(() => {
    const cells = data.cells || [];
    const nodes = cells.filter(
      c => c.shape !== 'edge' && c.shape !== 'flowchart-edge' && c.shape !== 'mindmap-edge' && !c.source && c.position,
    );
    const edges = cells.filter(
      c => c.shape === 'edge' || c.shape === 'flowchart-edge' || c.shape === 'mindmap-edge' || !!c.source,
    );

    if (!nodes.length) {
      return { viewBox: `0 0 ${width} ${height}`, nodes: [], edges: [] };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const x = n.position!.x;
      const y = n.position!.y;
      const w = n.size?.width ?? 120;
      const h = n.size?.height ?? 60;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    const padding = 20;
    return {
      viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`,
      nodes,
      edges,
    };
  }, [data, width, height]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, DiagramCell>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const getNodeCenter = (ref: string | { cell: string } | undefined): { x: number; y: number } | null => {
    if (!ref) return null;
    const id = typeof ref === 'string' ? ref : ref.cell;
    const node = nodeMap.get(id);
    if (!node?.position) return null;
    return {
      x: node.position.x + (node.size?.width ?? 120) / 2,
      y: node.position.y + (node.size?.height ?? 60) / 2,
    };
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      className={cn('bg-white rounded', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <path d="M 0 0 L 8 3 L 0 6 Z" fill="#94a3b8" />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map((edge) => {
        const from = getNodeCenter(edge.source);
        const to = getNodeCenter(edge.target);
        if (!from || !to) return null;

        const stroke = edge.attrs?.line?.stroke || '#94a3b8';
        const strokeWidth = edge.attrs?.line?.strokeWidth || 1.5;
        const dasharray = edge.attrs?.line?.strokeDasharray;

        return (
          <g key={edge.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              markerEnd={`url(#${markerId})`}
            />
            {edge.labels?.[0]?.attrs?.label?.text && (
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 6}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
              >
                {edge.labels[0].attrs!.label!.text}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const x = node.position!.x;
        const y = node.position!.y;
        const w = node.size?.width ?? 120;
        const h = node.size?.height ?? 60;
        const fill = node.data?.bgColor || node.attrs?.body?.fill || '#ffffff';
        const stroke = node.data?.borderColor || node.attrs?.body?.stroke || '#374151';
        const textColor = node.data?.textColor || node.attrs?.label?.fill || '#1f2937';
        const rx = node.attrs?.body?.rx ?? 4;
        const label = node.data?.label || node.attrs?.label?.text || '';
        const fShape = node.data?.flowchartShape || '';

        return (
          <g key={node.id}>
            {fShape === 'circle' || fShape === 'ellipse' ? (
              <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={1.5} />
            ) : fShape === 'diamond' ? (
              <polygon points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} fill={fill} stroke={stroke} strokeWidth={1.5} />
            ) : fShape === 'rounded-rect' ? (
              <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} />
            ) : (
              <rect x={x} y={y} width={w} height={h} rx={rx} ry={rx} fill={fill} stroke={stroke} strokeWidth={1.5} />
            )}
            {label && (
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fill={textColor}
                className="select-none"
              >
                {label.length > 20 ? label.slice(0, 18) + '...' : label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
