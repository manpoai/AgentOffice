import React from 'react';
import type { CanvasPage, CanvasElement } from './types';

function ExportElement({ el }: { el: CanvasElement }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        zIndex: el.z_index ?? 0,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        pointerEvents: 'none',
      }}
      dangerouslySetInnerHTML={{ __html: el.html }}
    />
  );
}

interface Props {
  frame: CanvasPage;
}

export const CanvasFrameExportView = React.forwardRef<HTMLDivElement, Props>(
  ({ frame }, ref) => {
    const sorted = [...frame.elements].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
    return (
      <div
        ref={ref}
        style={{
          position: 'relative',
          width: frame.width,
          height: frame.height,
          backgroundColor: frame.background_color || '#ffffff',
          backgroundImage: frame.background_image ? `url(${frame.background_image})` : undefined,
          backgroundSize: 'cover',
          overflow: 'hidden',
        }}
      >
        {sorted.map(el => <ExportElement key={el.id} el={el} />)}
      </div>
    );
  }
);
CanvasFrameExportView.displayName = 'CanvasFrameExportView';
