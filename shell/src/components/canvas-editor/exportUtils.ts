import { toPng, toSvg } from 'html-to-image';
import type { CanvasPage, CanvasElement } from './types';

export async function exportFramePng(frameEl: HTMLElement, frameName: string): Promise<void> {
  const dataUrl = await toPng(frameEl, { pixelRatio: 2, skipFonts: false });
  const a = document.createElement('a');
  a.download = `${frameName || 'frame'}.png`;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function canExportFrameAsSvg(frame: CanvasPage): boolean {
  return canExportElementsAsSvg(frame.elements);
}

export function canExportElementsAsSvg(elements: CanvasElement[]): boolean {
  return elements.every(el => {
    if (el.visible === false) return true;
    if (el.type === 'group' && el.children) return canExportElementsAsSvg(el.children);
    return el.html.includes('<svg') && !el.html.includes('<img') && !el.html.includes('<iframe');
  });
}

export function canExportElementAsSvg(el: CanvasElement): boolean {
  if (el.type === 'group' && el.children) return canExportElementsAsSvg(el.children);
  return el.html.includes('<svg') && !el.html.includes('<img') && !el.html.includes('<iframe');
}

export async function exportFrameSvg(frameEl: HTMLElement, frameName: string): Promise<void> {
  const dataUrl = await toSvg(frameEl, { skipFonts: false });
  const svgContent = decodeURIComponent(dataUrl.replace('data:image/svg+xml;charset=utf-8,', ''));
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `${frameName || 'frame'}.svg`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
