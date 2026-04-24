// shell/src/components/canvas-editor/useFontLoader.ts
const loaded = new Set<string>();

export function loadGoogleFont(family: string): void {
  if (typeof document === 'undefined') return;
  if (loaded.has(family)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`;
  document.head.appendChild(link);
  loaded.add(family);
}
