export interface VideoKeyframe {
  time: number;
  props: Partial<{
    x: number;
    y: number;
    w: number;
    h: number;
    opacity: number;
    scale: number;
    rotation: number;
  }>;
  easing?: string;
}

export interface VideoElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  html: string;
  start: number;
  duration: number;
  keyframes?: VideoKeyframe[];
  z_index?: number;
  locked?: boolean;
  name?: string;
}

export interface VideoSettings {
  width: number;
  height: number;
  fps: number;
  background_color?: string;
}

export interface VideoData {
  elements: VideoElement[];
  settings: VideoSettings;
}

export const DEFAULT_VIDEO_WIDTH = 1920;
export const DEFAULT_VIDEO_HEIGHT = 1080;
export const DEFAULT_FPS = 30;

export const SIZE_PRESETS = [
  { label: '16:9 Landscape', width: 1920, height: 1080 },
  { label: '16:9 HD', width: 1280, height: 720 },
  { label: '9:16 Portrait', width: 1080, height: 1920 },
  { label: '1:1 Square', width: 1080, height: 1080 },
  { label: '4:3 Standard', width: 1440, height: 1080 },
] as const;

export const SHAPE_TYPES = [
  { id: 'rect', label: 'Rectangle', html: '<div style="width:100%;height:100%;background:#3b82f6;border-radius:8px;"></div>' },
  { id: 'circle', label: 'Circle', html: '<div style="width:100%;height:100%;background:#3b82f6;border-radius:50%;"></div>' },
  { id: 'rounded', label: 'Rounded', html: '<div style="width:100%;height:100%;background:#3b82f6;border-radius:24px;"></div>' },
  { id: 'triangle', label: 'Triangle', html: '<div style="width:0;height:0;border-left:100px solid transparent;border-right:100px solid transparent;border-bottom:173px solid #3b82f6;margin:auto;"></div>' },
  { id: 'line', label: 'Line', html: '<div style="width:100%;height:4px;background:#3b82f6;position:absolute;top:50%;transform:translateY(-50%);"></div>' },
] as const;

export function computeTotalDuration(elements: VideoElement[]): number {
  if (elements.length === 0) return 10;
  return Math.max(...elements.map(el => el.start + el.duration), 1);
}

export function migrateVideoData(raw: any): VideoData {
  if (raw.scenes && Array.isArray(raw.scenes)) {
    const allElements: VideoElement[] = [];
    let timeOffset = 0;
    for (const scene of raw.scenes) {
      for (const el of scene.elements ?? []) {
        allElements.push({ ...el, start: el.start + timeOffset });
      }
      timeOffset += scene.duration ?? 5;
    }
    return {
      elements: allElements,
      settings: {
        width: raw.settings?.width ?? DEFAULT_VIDEO_WIDTH,
        height: raw.settings?.height ?? DEFAULT_VIDEO_HEIGHT,
        fps: raw.settings?.fps ?? DEFAULT_FPS,
        background_color: raw.scenes?.[0]?.background_color ?? '#000000',
      },
    };
  }
  return raw as VideoData;
}

export function interpolateKeyframes(
  element: VideoElement,
  currentTime: number,
): Partial<VideoKeyframe['props']> {
  const relTime = currentTime - element.start;
  if (relTime < 0 || relTime > element.duration) return {};
  if (!element.keyframes || element.keyframes.length === 0) return {};

  const sorted = [...element.keyframes].sort((a, b) => a.time - b.time);

  if (relTime <= sorted[0].time) return sorted[0].props;
  if (relTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].props;

  let prev = sorted[0];
  let next = sorted[1];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].time >= relTime) {
      prev = sorted[i - 1];
      next = sorted[i];
      break;
    }
  }

  const t = (relTime - prev.time) / (next.time - prev.time);
  const result: Partial<VideoKeyframe['props']> = {};

  for (const key of ['x', 'y', 'w', 'h', 'opacity', 'scale', 'rotation'] as const) {
    const pv = prev.props[key];
    const nv = next.props[key];
    if (pv !== undefined && nv !== undefined) {
      result[key] = pv + (nv - pv) * t;
    } else if (pv !== undefined) {
      result[key] = pv;
    } else if (nv !== undefined) {
      result[key] = nv;
    }
  }

  return result;
}
