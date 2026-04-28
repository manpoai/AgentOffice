// Video editor — data model.
//
// AE-style flat timeline. Per-property keyframes + element-level markers + implicit t=0.
// See AgentOffice doc_55241d430df73876 (Video Editor — Animation Interaction Spec) for
// the full design rationale and behavior table.

import type { CanvasElement } from '../canvas-editor/types';

// ─────────────────────────────────────────────────────────────────────────
// Animatable properties
// ─────────────────────────────────────────────────────────────────────────

/** Properties that can be keyframed on an element. Keep this list narrow on purpose;
 *  extend only when the UI exposes a control for it. */
export type AnimatableProperty =
  | 'x' | 'y' | 'w' | 'h'
  | 'opacity'
  | 'scale'
  | 'rotation';

export const ANIMATABLE_PROPERTIES: readonly AnimatableProperty[] = [
  'x', 'y', 'w', 'h', 'opacity', 'scale', 'rotation',
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Keyframes & markers
// ─────────────────────────────────────────────────────────────────────────

export type EasingPreset =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out';

export const EASING_PRESETS: readonly EasingPreset[] = [
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
] as const;

/** A single keyframe for ONE property. Time is element-local (0 = element.start).
 *  `easing` is the INCOMING easing — applied to the segment that ends at this
 *  keyframe. (For the implicit t=0 keyframe, easing is meaningless.) Storing easing
 *  on the segment's terminal keyframe matches how users describe motion: "ease into
 *  the final position" naturally lives on the destination. */
export interface Keyframe {
  t: number;
  value: number;
  easing?: EasingPreset;
}

/** Per-property keyframe map. Keys are AnimatableProperty names; values are sorted
 *  keyframe lists. The implicit t=0 keyframe is NOT stored in this map — it lives
 *  conceptually on the element's static value (element.x, element.y, ...).
 *  A property is "animated" iff this map has an entry with at least one keyframe at
 *  t > 0. A property with no entry (or empty list) is static. */
export type KeyframesMap = Partial<Record<AnimatableProperty, Keyframe[]>>;

// ─────────────────────────────────────────────────────────────────────────
// Element
// ─────────────────────────────────────────────────────────────────────────

/** Video element extends Canvas's element with timeline fields.
 *
 *  - `start`, `duration` are global (in seconds, relative to the global timeline).
 *  - `markers[]` are USER-DECLARED time anchors in element-local coordinates
 *    (0 = element appears, duration = element disappears). They do not carry
 *    property values; they are pure UX intent.
 *  - `keyframes` is the per-property keyframe map (also element-local).
 *  - The static value of a property (what's used at t=0 and what's used when the
 *    property has no keyframes) lives on the inherited CanvasElement fields
 *    (x, y, w, h) and helper fields below for non-Canvas-shaped properties. */
export interface VideoElement extends CanvasElement {
  /** Global time (seconds) when this element first appears. */
  start: number;
  /** How long it persists, in seconds. */
  duration: number;
  /** User-declared time anchors in element-local seconds (0 .. duration). */
  markers?: number[];
  /** Per-property keyframe lists in element-local seconds. */
  keyframes?: KeyframesMap;
  /** Static opacity (0..1). Used at t=0 and when opacity has no keyframes. */
  opacity?: number;
  /** Static scale (uniform). Defaults to 1. */
  scale?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────

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
export const MIN_ELEMENT_DURATION = 0.5;
/** Tolerance (seconds) when checking whether the playhead "is on" a marker or keyframe. */
export const TIME_EPSILON = 1e-3;

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

// ─────────────────────────────────────────────────────────────────────────
// Static-value reads
// ─────────────────────────────────────────────────────────────────────────

/** Read the implicit-t=0 (static) value for a property. */
export function getStaticValue(el: VideoElement, prop: AnimatableProperty): number {
  switch (prop) {
    case 'x': return el.x;
    case 'y': return el.y;
    case 'w': return el.w;
    case 'h': return el.h;
    case 'opacity': return el.opacity ?? 1;
    case 'scale': return el.scale ?? 1;
    case 'rotation': return el.rotation ?? 0;
  }
}

/** Set the implicit-t=0 (static) value for a property. Returns updates to merge into
 *  the element. */
export function setStaticValue(prop: AnimatableProperty, value: number): Partial<VideoElement> {
  switch (prop) {
    case 'x': return { x: value };
    case 'y': return { y: value };
    case 'w': return { w: value };
    case 'h': return { h: value };
    case 'opacity': return { opacity: value };
    case 'scale': return { scale: value };
    case 'rotation': return { rotation: value };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Animation state queries
// ─────────────────────────────────────────────────────────────────────────

/** A property is "animated" iff it has at least one keyframe at t > 0. */
export function isPropertyAnimated(el: VideoElement, prop: AnimatableProperty): boolean {
  const kfs = el.keyframes?.[prop];
  return !!kfs && kfs.length > 0 && kfs.some(k => k.t > TIME_EPSILON);
}

/** Returns the list of marker times (element-local seconds), sorted ascending. */
export function getMarkers(el: VideoElement): number[] {
  return [...(el.markers ?? [])].sort((a, b) => a - b);
}

/** Tests whether a time (element-local) coincides with an existing marker. */
export function isOnMarker(el: VideoElement, t: number): boolean {
  return (el.markers ?? []).some(m => Math.abs(m - t) <= TIME_EPSILON);
}

/** The last keyframe time for a property (excluding the implicit t=0).
 *  Returns null if the property is static. */
export function getLastKeyframeTime(el: VideoElement, prop: AnimatableProperty): number | null {
  const kfs = el.keyframes?.[prop];
  if (!kfs || kfs.length === 0) return null;
  let max = -Infinity;
  for (const kf of kfs) if (kf.t > max) max = kf.t;
  return max > TIME_EPSILON ? max : null;
}

/** Animation interval for a property: (0, t_last). Returns null if the property is
 *  static. The boundaries are *exclusive*. */
export function getAnimationInterval(el: VideoElement, prop: AnimatableProperty): { start: number; end: number } | null {
  const last = getLastKeyframeTime(el, prop);
  return last == null ? null : { start: 0, end: last };
}

// ─────────────────────────────────────────────────────────────────────────
// Interpolation
// ─────────────────────────────────────────────────────────────────────────

const EASE = {
  linear: (t: number) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  'ease-in': cubicBezier(0.42, 0, 1, 1),
  'ease-out': cubicBezier(0, 0, 0.58, 1),
  'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
};

function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  // Approximate cubic-bezier easing; good enough for editor preview, exact rendering
  // happens via Web Animations API in the export path.
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1, mid = t;
    for (let i = 0; i < 16; i++) {
      mid = (lo + hi) / 2;
      const x = bezierAt(mid, p1x, p2x);
      if (x < t) lo = mid; else hi = mid;
    }
    return bezierAt((lo + hi) / 2, p1y, p2y);
  };
}

function bezierAt(t: number, c1: number, c2: number) {
  const u = 1 - t;
  return 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t;
}

/** Read a property's value at element-local time t.
 *  - If property has no t>0 keyframes → returns the static value.
 *  - If t < first kf time → returns interpolated from static (t=0) to first kf.
 *  - If t > last kf time → returns the last kf value (held).
 *  - Otherwise interpolates between surrounding keyframes using the previous kf's easing. */
export function getPropertyValueAt(el: VideoElement, prop: AnimatableProperty, t: number): number {
  const staticValue = getStaticValue(el, prop);
  const kfs = el.keyframes?.[prop];
  if (!kfs || kfs.length === 0) return staticValue;
  // Sort by t ascending
  const sorted = [...kfs].sort((a, b) => a.t - b.t).filter(k => k.t > TIME_EPSILON);
  if (sorted.length === 0) return staticValue;

  // Synthesize the implicit t=0 keyframe at the head
  const first: Keyframe = { t: 0, value: staticValue, easing: 'linear' };
  const series = [first, ...sorted];

  if (t <= series[0].t) return series[0].value;
  if (t >= series[series.length - 1].t) return series[series.length - 1].value;

  // Find surrounding pair. Easing on a segment is taken from the segment's END
  // keyframe (incoming-easing semantics).
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i], b = series[i + 1];
    if (t >= a.t && t <= b.t) {
      const frac = (t - a.t) / (b.t - a.t);
      const easeFn = EASE[b.easing ?? 'linear'] ?? EASE.linear;
      const eased = easeFn(frac);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return staticValue;
}

/** Convenience: read all animatable property values at once at time t. */
export function getElementSnapshotAt(el: VideoElement, t: number): Record<AnimatableProperty, number> {
  return {
    x: getPropertyValueAt(el, 'x', t),
    y: getPropertyValueAt(el, 'y', t),
    w: getPropertyValueAt(el, 'w', t),
    h: getPropertyValueAt(el, 'h', t),
    opacity: getPropertyValueAt(el, 'opacity', t),
    scale: getPropertyValueAt(el, 'scale', t),
    rotation: getPropertyValueAt(el, 'rotation', t),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Mutation helpers — pure functions that return updated elements
// ─────────────────────────────────────────────────────────────────────────

/** Add an empty marker at element-local time t. No-op if t is at t=0 or already
 *  exists. */
export function addMarker(el: VideoElement, t: number): VideoElement {
  if (t <= TIME_EPSILON) return el;
  if (isOnMarker(el, t)) return el;
  const next = [...(el.markers ?? []), t].sort((a, b) => a - b);
  return { ...el, markers: next };
}

/** Remove a marker AND any property keyframes at that time. */
export function removeMarker(el: VideoElement, t: number): VideoElement {
  const markers = (el.markers ?? []).filter(m => Math.abs(m - t) > TIME_EPSILON);
  const keyframes: KeyframesMap = {};
  for (const prop of ANIMATABLE_PROPERTIES) {
    const list = el.keyframes?.[prop];
    if (!list) continue;
    const filtered = list.filter(k => Math.abs(k.t - t) > TIME_EPSILON);
    if (filtered.length > 0) keyframes[prop] = filtered;
  }
  return { ...el, markers, keyframes };
}

/** Set a property keyframe at time t. If t is not already a marker, it's auto-added
 *  to markers[]. Caller owns the decision of WHEN to call this — see the behavior
 *  table in the spec. */
export function upsertKeyframe(
  el: VideoElement,
  prop: AnimatableProperty,
  t: number,
  value: number,
  easing?: EasingPreset,
): VideoElement {
  // Ensure marker exists (unless t is the implicit t=0)
  let next = el;
  if (t > TIME_EPSILON && !isOnMarker(el, t)) {
    next = addMarker(el, t);
  }
  const list = next.keyframes?.[prop] ?? [];
  const idx = list.findIndex(k => Math.abs(k.t - t) <= TIME_EPSILON);
  let updated: Keyframe[];
  if (idx >= 0) {
    updated = list.map((k, i) => i === idx ? { ...k, value, ...(easing ? { easing } : {}) } : k);
  } else {
    updated = [...list, { t, value, ...(easing ? { easing } : {}) }].sort((a, b) => a.t - b.t);
  }
  return {
    ...next,
    keyframes: { ...(next.keyframes ?? {}), [prop]: updated },
  };
}

/** Remove a single property keyframe at time t. */
export function removeKeyframe(el: VideoElement, prop: AnimatableProperty, t: number): VideoElement {
  const list = el.keyframes?.[prop];
  if (!list) return el;
  const filtered = list.filter(k => Math.abs(k.t - t) > TIME_EPSILON);
  const keyframes: KeyframesMap = { ...(el.keyframes ?? {}) };
  if (filtered.length > 0) keyframes[prop] = filtered;
  else delete keyframes[prop];
  return { ...el, keyframes };
}

/** Remove all animation from a property; returns a static element with the original
 *  static value preserved (per spec §A3 — t=0 value stays put). */
export function clearAnimation(el: VideoElement, prop: AnimatableProperty): VideoElement {
  const keyframes: KeyframesMap = { ...(el.keyframes ?? {}) };
  delete keyframes[prop];
  return { ...el, keyframes };
}

// ─────────────────────────────────────────────────────────────────────────
// Timeline helpers
// ─────────────────────────────────────────────────────────────────────────

export function computeTotalDuration(elements: VideoElement[]): number {
  if (elements.length === 0) return 10;
  return Math.max(...elements.map(el => el.start + el.duration), 1);
}

/** Given a global time, returns the element-local time, or null if global is outside
 *  the element's lifespan. */
export function globalToLocal(el: VideoElement, globalT: number): number | null {
  const local = globalT - el.start;
  if (local < -TIME_EPSILON || local > el.duration + TIME_EPSILON) return null;
  return Math.max(0, Math.min(el.duration, local));
}

// ─────────────────────────────────────────────────────────────────────────
// Migration
// ─────────────────────────────────────────────────────────────────────────

/** Migrate any prior video data shape into the new model.
 *
 *  Per moonyaan: AOSE has no real users yet, so legacy migration may discard
 *  animation data — we just want the documents to load without crashing. We:
 *  - flatten legacy `scenes[]` into a single elements list
 *  - drop legacy tuple `keyframes[]` (Model 2). Old animations are intentionally
 *    lost; users will recreate motion in the new model.
 *  - preserve element static layout (x, y, w, h, html) so the document is at least
 *    visually recognizable.
 */
export function migrateVideoData(raw: any): VideoData {
  const settings: VideoSettings = {
    width: raw?.settings?.width ?? raw?.scenes?.[0]?.width ?? DEFAULT_VIDEO_WIDTH,
    height: raw?.settings?.height ?? raw?.scenes?.[0]?.height ?? DEFAULT_VIDEO_HEIGHT,
    fps: raw?.settings?.fps ?? DEFAULT_FPS,
    background_color: raw?.settings?.background_color ?? raw?.scenes?.[0]?.background_color ?? '#000000',
  };

  // Source list of elements: either flat (.elements) or scene-based (.scenes[].elements)
  let sourceEls: any[] = [];
  if (Array.isArray(raw?.elements)) {
    sourceEls = raw.elements;
  } else if (Array.isArray(raw?.scenes)) {
    let timeOffset = 0;
    for (const scene of raw.scenes) {
      for (const el of scene.elements ?? []) {
        sourceEls.push({ ...el, start: (el.start ?? 0) + timeOffset });
      }
      timeOffset += scene.duration ?? 5;
    }
  }

  const elements: VideoElement[] = sourceEls.map((el: any) => {
    const ve: VideoElement = {
      id: el.id ?? `el-${crypto.randomUUID().slice(0, 8)}`,
      x: typeof el.x === 'number' ? el.x : 0,
      y: typeof el.y === 'number' ? el.y : 0,
      w: typeof el.w === 'number' ? el.w : 100,
      h: typeof el.h === 'number' ? el.h : 100,
      html: typeof el.html === 'string' ? el.html : '',
      start: typeof el.start === 'number' ? el.start : 0,
      duration: typeof el.duration === 'number' && el.duration >= MIN_ELEMENT_DURATION ? el.duration : 3,
      z_index: typeof el.z_index === 'number' ? el.z_index : 1,
      locked: !!el.locked,
      name: typeof el.name === 'string' ? el.name : undefined,
      opacity: typeof el.opacity === 'number' ? el.opacity : 1,
      scale: typeof el.scale === 'number' ? el.scale : 1,
      rotation: typeof el.rotation === 'number' ? el.rotation : 0,
      markers: [],
      keyframes: {},
    };
    return ve;
  });

  return { elements, settings };
}

// ─────────────────────────────────────────────────────────────────────────
// Legacy compat stubs (Phase 1 keeps existing VideoEditor.tsx compiling)
// ─────────────────────────────────────────────────────────────────────────

/** @deprecated Phase 1 stub — the old API consumer expected a partial-props snapshot.
 *  New code should use getElementSnapshotAt(el, globalT) directly. */
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

/** @deprecated kept for VideoEditor.tsx compile-pass during Phase 1. Returns the empty
 *  snapshot — animations from the old model are NOT migrated. Use
 *  getElementSnapshotAt(el, globalT) for the new behavior. */
export function interpolateKeyframes(
  _element: VideoElement,
  _currentTime: number,
): Partial<VideoKeyframe['props']> {
  return {};
}
