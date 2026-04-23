'use client';

import { useState } from 'react';
import { X, Ban, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showError } from '@/lib/utils/error';
import { pickFile } from '@/lib/utils/pick-file';
import * as gw from '@/lib/api/gateway';
import type { CanvasElement, CanvasPage, DesignToken } from './types';
import { projectElement, applyProjection, extractDesignTokens, updateDesignToken } from './projection';
import type { ProjectedProps } from './projection';

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isNone = !value || value === 'none';
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-14 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        {isNone ? (
          <button onClick={() => onChange('#000000')}
            className="w-6 h-6 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center"
            title="Set color">
            <Ban className="h-3 w-3 text-muted-foreground/40" />
          </button>
        ) : (
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-6 h-6 rounded border cursor-pointer" />
        )}
        <input type="text" value={isNone ? '' : value}
          onChange={e => onChange(e.target.value || 'none')}
          className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background font-mono" placeholder="none" />
        {!isNone && (
          <button onClick={() => onChange('none')}
            className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground" title="Remove">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-14 shrink-0">{label}</label>
      <input type="number" value={Math.round(value * 100) / 100} min={min} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background font-mono" />
    </div>
  );
}

function SectionHeader({ children, collapsed, onToggle }: {
  children: React.ReactNode; collapsed?: boolean; onToggle?: () => void;
}) {
  return (
    <div className={cn("px-3 py-1.5 border-b border-border", onToggle && "cursor-pointer hover:bg-accent/50")}
      onClick={onToggle}>
      <div className="flex items-center gap-1">
        {onToggle && (collapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{children}</span>
      </div>
    </div>
  );
}

function ImageFillInput({ element, onUpdateElement }: {
  element: CanvasElement;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
}) {
  const isSvg = element.html.includes('<svg');
  const patternMatch = element.html.match(/href="([^"]+)"/);
  const bgMatch = element.html.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
  const currentUrl = (isSvg ? patternMatch?.[1] : bgMatch?.[1]) || '';
  const hasImage = !!currentUrl;

  const applyImageFill = (url: string) => {
    let html = element.html;
    if (isSvg) {
      html = html.replace(/<defs>[\s\S]*?<\/defs>/g, '');
      const pathEl = html.match(/<(path|rect|circle|ellipse|polygon)\s/);
      if (pathEl) {
        if (url) {
          const defsBlock = `<defs><pattern id="img-fill" patternUnits="objectBoundingBox" width="1" height="1"><image href="${url}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/></pattern></defs>`;
          html = html.replace(/<svg([^>]*)>/, `<svg$1>${defsBlock}`);
          html = html.replace(/fill="[^"]*"/, 'fill="url(#img-fill)"');
        } else {
          html = html.replace(/fill="url\(#img-fill\)"/, 'fill="#e0e7ff"');
        }
      }
    } else {
      const wrapperStyleMatch = html.match(/^<div\s+style="([^"]*)"/);
      if (wrapperStyleMatch) {
        let style = wrapperStyleMatch[1];
        style = style.replace(/background-image:[^;]+;?\s*/g, '');
        style = style.replace(/background-size:[^;]+;?\s*/g, '');
        style = style.replace(/background-position:[^;]+;?\s*/g, '');
        style = style.replace(/background-repeat:[^;]+;?\s*/g, '');
        if (url) {
          style += `background-image:url('${url}');background-size:cover;background-position:center;`;
        }
        html = html.replace(wrapperStyleMatch[0], `<div style="${style}"`);
      }
    }
    onUpdateElement(element.id, { html });
  };

  const handleUpload = async () => {
    try {
      const files = await pickFile({ accept: 'image/*' });
      const file = files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/gateway/uploads', { method: 'POST', headers: gw.gwAuthHeaders(), body: formData });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const respData = await resp.json();
      const url = respData.url?.startsWith('http') ? respData.url : `/api/gateway${respData.url?.replace(/^\/api/, '')}`;
      applyImageFill(url);
    } catch (err) {
      showError('Failed to upload image', err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-14 shrink-0">Image</label>
      {hasImage ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="w-6 h-6 rounded border bg-cover bg-center shrink-0"
            style={{ backgroundImage: `url('${currentUrl}')` }} />
          <span className="flex-1 text-[11px] text-muted-foreground truncate">{currentUrl.split('/').pop()}</span>
          <button onClick={() => applyImageFill('')}
            className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground shrink-0" title="Remove image">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button onClick={handleUpload}
          className="flex-1 text-[11px] px-1.5 py-1 rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 flex items-center gap-1 justify-center">
          <Upload className="h-3 w-3" /> Upload
        </button>
      )}
    </div>
  );
}

function FrameImageInput({ frame, onUpdateFrame }: {
  frame: CanvasPage;
  onUpdateFrame: (pageId: string, updates: Partial<CanvasPage>) => void;
}) {
  const hasImage = !!frame.background_image;

  const handleUpload = async () => {
    try {
      const files = await pickFile({ accept: 'image/*' });
      const file = files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/gateway/uploads', { method: 'POST', headers: gw.gwAuthHeaders(), body: formData });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const respData = await resp.json();
      const url = respData.url?.startsWith('http') ? respData.url : `/api/gateway${respData.url?.replace(/^\/api/, '')}`;
      onUpdateFrame(frame.page_id, { background_image: url });
    } catch (err) {
      showError('Failed to upload image', err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-14 shrink-0">Bg Image</label>
      {hasImage ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="w-6 h-6 rounded border bg-cover bg-center shrink-0"
            style={{ backgroundImage: `url('${frame.background_image}')` }} />
          <span className="flex-1 text-[11px] text-muted-foreground truncate">{frame.background_image!.split('/').pop()}</span>
          <button onClick={() => onUpdateFrame(frame.page_id, { background_image: '' })}
            className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground shrink-0" title="Remove image">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button onClick={handleUpload}
          className="flex-1 text-[11px] px-1.5 py-1 rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 flex items-center gap-1 justify-center">
          <Upload className="h-3 w-3" /> Upload
        </button>
      )}
    </div>
  );
}

export function CanvasPropertyPanel({
  element,
  selectedElements,
  frame,
  selectedCount,
  designTokens,
  onUpdateElement,
  onUpdateFrame,
  onUpdateToken,
  onClose,
}: {
  element: CanvasElement | null;
  selectedElements?: CanvasElement[];
  frame: CanvasPage | null;
  selectedCount: number;
  designTokens: DesignToken[];
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  onUpdateFrame: (pageId: string, updates: Partial<CanvasPage>) => void;
  onUpdateToken: (name: string, value: string) => void;
  onClose: () => void;
}) {
  const [showCode, setShowCode] = useState(false);

  if (!element && selectedCount > 1 && selectedElements && selectedElements.length > 1) {
    const projected = selectedElements.map(el => projectElement(el.html));
    const hasSvg = projected.some(p => p.isSvgShape);
    const hasNonSvg = projected.some(p => !p.isSvgShape);

    const commonStr = (getter: (p: ReturnType<typeof projectElement>) => string | undefined): string => {
      const vals = projected.map(getter).filter(Boolean) as string[];
      if (vals.length === 0) return '';
      return vals.every(v => v === vals[0]) ? vals[0] : 'mixed';
    };
    const commonNum = (getter: (p: ReturnType<typeof projectElement>) => number | undefined): number | 'mixed' => {
      const vals = projected.map(getter).filter(v => v !== undefined) as number[];
      if (vals.length === 0) return 0;
      return vals.every(v => v === vals[0]) ? vals[0] : 'mixed';
    };

    const applyToAll = (changes: Partial<ProjectedProps>) => {
      for (const el of selectedElements) {
        const newHtml = applyProjection(el.html, changes);
        onUpdateElement(el.id, { html: newHtml });
      }
    };

    const svgFill = commonStr(p => p.svgFill);
    const svgStroke = commonStr(p => p.svgStroke);
    const svgStrokeW = commonNum(p => p.svgStrokeWidth);
    const bgColor = commonStr(p => p.backgroundColor);
    const textColor = commonStr(p => p.color);
    const fontSize = commonNum(p => p.fontSize);
    const radius = commonNum(p => p.borderRadius);
    const opacity = commonNum(p => p.opacity);

    return (
      <div className="w-[280px] min-w-[280px] border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto h-full shadow-lg">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{selectedCount} Selected</span>
          <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <SectionHeader>Appearance</SectionHeader>
        <div className="p-3 space-y-2">
          {hasSvg && (
            <>
              <ColorInput label="Fill" value={svgFill === 'mixed' ? '' : svgFill}
                onChange={v => applyToAll({ svgFill: v })} />
              <ColorInput label="Stroke" value={svgStroke === 'mixed' ? '' : svgStroke}
                onChange={v => applyToAll({ svgStroke: v })} />
              <NumberInput label="Stroke W" value={typeof svgStrokeW === 'number' ? svgStrokeW : 0} min={0} step={0.5}
                onChange={v => applyToAll({ svgStrokeWidth: v })} />
            </>
          )}
          {hasNonSvg && (
            <>
              <ColorInput label="Fill" value={bgColor === 'mixed' ? '' : bgColor}
                onChange={v => applyToAll({ backgroundColor: v })} />
              <ColorInput label="Text" value={textColor === 'mixed' ? '' : textColor}
                onChange={v => applyToAll({ color: v })} />
              <NumberInput label="Font Size" value={typeof fontSize === 'number' ? fontSize : 16} min={1}
                onChange={v => applyToAll({ fontSize: v })} />
            </>
          )}
          <NumberInput label="Radius" value={typeof radius === 'number' ? radius : 0} min={0}
            onChange={v => applyToAll({ borderRadius: v })} />
          <NumberInput label="Opacity" value={typeof opacity === 'number' ? opacity : 1} min={0} step={0.1}
            onChange={v => applyToAll({ opacity: Math.min(1, Math.max(0, v)) })} />
        </div>
      </div>
    );
  }

  if (!element && selectedCount > 1) {
    return (
      <div className="w-[280px] min-w-[280px] border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto h-full shadow-lg">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{selectedCount} Selected</span>
          <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-3 text-[11px] text-muted-foreground">
          Use the floating toolbar to align or delete selected elements.
        </div>
      </div>
    );
  }

  if (!element) {
    return (
      <div className="w-[280px] min-w-[280px] border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto h-full shadow-lg">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {frame ? 'Frame' : 'Canvas'}
          </span>
          <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {frame && (
          <>
            <SectionHeader>Position & Size</SectionHeader>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="X" value={frame.frame_x ?? 0} onChange={v => onUpdateFrame(frame.page_id, { frame_x: v })} />
                <NumberInput label="Y" value={frame.frame_y ?? 0} onChange={v => onUpdateFrame(frame.page_id, { frame_y: v })} />
                <NumberInput label="W" value={frame.width} min={100} onChange={w => onUpdateFrame(frame.page_id, { width: w })} />
                <NumberInput label="H" value={frame.height} min={100} onChange={h => onUpdateFrame(frame.page_id, { height: h })} />
              </div>
            </div>
            <SectionHeader>Appearance</SectionHeader>
            <div className="p-3 space-y-2">
              <ColorInput label="Bg Color" value={frame.background_color || '#ffffff'}
                onChange={v => onUpdateFrame(frame.page_id, { background_color: v })} />
              <NumberInput label="Radius" value={frame.border_radius ?? 0} min={0}
                onChange={v => onUpdateFrame(frame.page_id, { border_radius: v })} />
              <FrameImageInput frame={frame} onUpdateFrame={onUpdateFrame} />
            </div>
          </>
        )}
        {designTokens.length > 0 && (
          <>
            <SectionHeader>Design Tokens</SectionHeader>
            <div className="p-3 space-y-2">
              {designTokens.map(token => (
                <ColorInput key={token.name} label={token.name.replace('--', '')}
                  value={token.value} onChange={v => onUpdateToken(token.name, v)} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const projected = projectElement(element.html);

  const applyChange = (changes: Partial<ProjectedProps>) => {
    const newHtml = applyProjection(element.html, changes);
    onUpdateElement(element.id, { html: newHtml });
  };

  return (
    <div className="w-[280px] min-w-[280px] border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto h-full shadow-lg">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Element</span>
        <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <SectionHeader>Position & Size</SectionHeader>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={element.x} onChange={v => onUpdateElement(element.id, { x: v })} />
          <NumberInput label="Y" value={element.y} onChange={v => onUpdateElement(element.id, { y: v })} />
          <NumberInput label="W" value={element.w} min={20} onChange={v => onUpdateElement(element.id, { w: v })} />
          <NumberInput label="H" value={element.h} min={20} onChange={v => onUpdateElement(element.id, { h: v })} />
        </div>
        <NumberInput label="Z-Index" value={element.z_index ?? 0}
          onChange={v => onUpdateElement(element.id, { z_index: v })} />
      </div>

      <SectionHeader>Appearance</SectionHeader>
      <div className="p-3 space-y-2">
        {projected.isSvgShape ? (
          <>
            <ColorInput label="Fill" value={projected.svgFill || ''}
              onChange={v => applyChange({ svgFill: v })} />
            <ColorInput label="Stroke" value={projected.svgStroke || ''}
              onChange={v => applyChange({ svgStroke: v })} />
            <NumberInput label="Stroke W" value={projected.svgStrokeWidth ?? 2} min={0} step={0.5}
              onChange={v => applyChange({ svgStrokeWidth: v })} />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-14 shrink-0">Dash</label>
              <select value={projected.svgStrokeDasharray || ''}
                onChange={e => applyChange({ svgStrokeDasharray: e.target.value })}
                className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background">
                <option value="">Solid</option>
                <option value="8 4">Dashed</option>
                <option value="2 2">Dotted</option>
                <option value="12 4 4 4">Dash-dot</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground w-14 shrink-0">Align</label>
              <select value={projected.svgStrokeAlignment || 'center'}
                onChange={e => applyChange({ svgStrokeAlignment: e.target.value as 'center' | 'inside' | 'outside' })}
                className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background">
                <option value="center">Center</option>
                <option value="inside">Inside</option>
                <option value="outside">Outside</option>
              </select>
            </div>
            <NumberInput label="Radius" value={projected.borderRadius ?? 0} min={0}
              onChange={v => applyChange({ borderRadius: v })} />
            <ImageFillInput element={element} onUpdateElement={onUpdateElement} />
          </>
        ) : (
          <>
            <ColorInput label="Fill" value={projected.backgroundColor || ''}
              onChange={v => applyChange({ backgroundColor: v })} />
            <ImageFillInput element={element} onUpdateElement={onUpdateElement} />
            <ColorInput label="Text" value={projected.color || ''}
              onChange={v => applyChange({ color: v })} />
            {projected.fontSize !== undefined && (
              <NumberInput label="Font Size" value={projected.fontSize} min={1}
                onChange={v => applyChange({ fontSize: v })} />
            )}
            {projected.fontFamily !== undefined && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground w-14 shrink-0">Font</label>
                <select value={projected.fontFamily || 'sans-serif'}
                  onChange={e => applyChange({ fontFamily: e.target.value })}
                  className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background">
                  <option value="-apple-system, BlinkMacSystemFont, sans-serif">System</option>
                  <option value="sans-serif">Sans-serif</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Monospace</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                </select>
              </div>
            )}
            {projected.fontWeight !== undefined && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground w-14 shrink-0">Weight</label>
                <select value={projected.fontWeight || '400'}
                  onChange={e => applyChange({ fontWeight: e.target.value })}
                  className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background">
                  <option value="300">Light</option>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="900">Black</option>
                </select>
              </div>
            )}
          </>
        )}
        {projected.borderRadius !== undefined && (
          <NumberInput label="Radius" value={projected.borderRadius} min={0}
            onChange={v => applyChange({ borderRadius: v })} />
        )}
        <NumberInput label="Opacity" value={projected.opacity ?? 1} min={0} step={0.1}
          onChange={v => applyChange({ opacity: Math.min(1, Math.max(0, v)) })} />
      </div>

      <SectionHeader collapsed={!showCode} onToggle={() => setShowCode(v => !v)}>HTML Code</SectionHeader>
      {showCode && (
        <div className="p-3">
          <textarea
            value={element.html}
            onChange={e => onUpdateElement(element.id, { html: e.target.value })}
            className="w-full h-40 text-[11px] px-2 py-1.5 rounded border bg-background font-mono resize-y"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
