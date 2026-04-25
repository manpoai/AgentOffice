export type SubElementType = 'text' | 'image' | 'svg' | 'container' | 'unknown';

export function getCssPath(el: Element, root: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent) break;
    let index = 0;
    for (let i = 0; i < parent.children.length; i++) {
      if (parent.children[i] === current) { index = i; break; }
    }
    parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index + 1})`);
    current = parent;
  }
  return parts.length > 0 ? ':scope > ' + parts.join(' > ') : ':scope';
}

export function getBreadcrumbs(root: Element, cssPath: string): { label: string; cssPath: string }[] {
  const crumbs: { label: string; cssPath: string }[] = [];
  const parts = cssPath.replace(/^:scope > /, '').split(' > ').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const partial = ':scope > ' + parts.slice(0, i + 1).join(' > ');
    const el = root.querySelector(partial);
    const tag = el?.tagName.toLowerCase() ?? parts[i].split(':')[0];
    crumbs.push({ label: tag, cssPath: partial });
  }
  return crumbs;
}

export function getSubElementType(el: Element): SubElementType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img' || tag === 'image') return 'image';
  if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'ellipse' || tag === 'line' || tag === 'polygon' || tag === 'polyline' || tag === 'g') return 'svg';
  if (el.children.length > 0 && !el.textContent?.trim()) return 'container';
  if (el.textContent?.trim()) return 'text';
  return 'unknown';
}

export function isPositioned(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.position === 'absolute' || style.position === 'relative' || style.position === 'fixed';
}
