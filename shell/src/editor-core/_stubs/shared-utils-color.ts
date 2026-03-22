/**
 * Stub for @shared/utils/color
 * Used by: marks/Highlight.ts, nodes/TableCell.ts
 */

// Outline preset colors for highlights — must be an array of { name, hex }
export const presetColors = [
  { name: "red", hex: "#FF5C5C" },
  { name: "orange", hex: "#FF9F1A" },
  { name: "yellow", hex: "#FFE066" },
  { name: "green", hex: "#4FBF67" },
  { name: "blue", hex: "#0D8ECF" },
  { name: "purple", hex: "#B57BFF" },
  { name: "pink", hex: "#FF7EB3" },
  { name: "grey", hex: "#A0A0A0" },
];

export function hexToRgba(hex: string, alpha = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function rgbaToHex(rgba: any): string {
  // Handle polished RgbaColor objects: { red, green, blue, alpha? }
  if (rgba && typeof rgba === 'object' && 'red' in rgba) {
    const { red, green, blue } = rgba;
    return (
      "#" +
      [red, green, blue]
        .map((c: number) => Math.round(c).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  // Handle rgba string: "rgba(r, g, b, a)"
  if (typeof rgba === 'string') {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return "#000000";
    const [, r, g, b] = match;
    return (
      "#" +
      [r, g, b].map((c) => parseInt(c).toString(16).padStart(2, "0")).join("")
    );
  }
  return "#000000";
}
