'use client';

const PRESETS = [
  { name: 'Desktop', w: 1920, h: 1080 },
  { name: 'Laptop', w: 1440, h: 900 },
  { name: 'Tablet', w: 1024, h: 768 },
  { name: 'Mobile', w: 390, h: 844 },
  { name: 'Square', w: 1080, h: 1080 },
  { name: 'A4 Portrait', w: 794, h: 1123 },
  { name: 'A4 Landscape', w: 1123, h: 794 },
  { name: '16:9', w: 1600, h: 900 },
  { name: '4:3', w: 1600, h: 1200 },
];

interface FramePresetPanelProps {
  onSelect: (w: number, h: number, name: string) => void;
}

export function FramePresetPanel({ onSelect }: FramePresetPanelProps) {
  return (
    <div className="p-3">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Frame Presets
      </div>
      <div className="space-y-1">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelect(p.w, p.h, p.name)}
            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent/50 transition-colors flex items-center justify-between"
          >
            <span className="text-foreground">{p.name}</span>
            <span className="text-[11px] text-muted-foreground">{p.w} × {p.h}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
