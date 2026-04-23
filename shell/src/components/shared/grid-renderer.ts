export interface GridConfig {
  enabled: boolean;
  size: number;
  snap: boolean;
  color: string;
}

export const DEFAULT_GRID: GridConfig = {
  enabled: false,
  size: 20,
  snap: true,
  color: 'rgba(0,0,0,0.06)',
};

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function renderGridPattern(size: number, color: string): string {
  return `repeating-linear-gradient(0deg, ${color} 0 1px, transparent 1px ${size}px), repeating-linear-gradient(90deg, ${color} 0 1px, transparent 1px ${size}px)`;
}
