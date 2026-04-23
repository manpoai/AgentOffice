export interface ParsedSvg {
  html: string;
  w: number;
  h: number;
}

export function parseSvgFileContent(svgText: string): ParsedSvg {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) {
    return { html: `<div style="width:100%;height:100%;">${svgText}</div>`, w: 200, h: 200 };
  }

  let w = 200, h = 200;

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      w = parts[2];
      h = parts[3];
    }
  }

  const widthAttr = svg.getAttribute('width');
  const heightAttr = svg.getAttribute('height');
  if (widthAttr && heightAttr) {
    const pw = parseFloat(widthAttr);
    const ph = parseFloat(heightAttr);
    if (!isNaN(pw) && !isNaN(ph)) { w = pw; h = ph; }
  }

  const maxDim = 800;
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  if (!viewBox) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';

  const html = `<div style="width:100%;height:100%;overflow:hidden;">${svg.outerHTML}</div>`;
  return { html, w, h };
}
