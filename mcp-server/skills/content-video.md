# Content: Video (Animated Design)

Reference for working with aose videos. Assumes you've read `00-role-and-principles.md`, `01-typical-tasks.md`, `02-platform-overview.md`, `03-events-and-collaboration.md`, and `content-canvas.md` (videos use the same HTML element model as canvases).

## What It Is

A video is an animated design surface with a flat timeline. Elements are the same HTML boxes as canvas (positioned at x, y with w, h), but each element has a **time window** (start, duration) and can have **per-property keyframe animations** (position, opacity, scale, rotation, color, font-size).

The output is an MP4 or WebM file rendered client-side via html-to-image + MediaRecorder + ffmpeg.wasm.

## When to Use

Create a video when:

- The content needs **motion**: animated intros, explainer clips, social media video content.
- Timing matters: elements should **appear, move, fade, or transform** over time.
- The human says "video", "animation", "motion graphics", "animated", "intro", or similar.

Don't create a video when:

- The output is a static image — that's a canvas.
- The content is a slide deck presented one-at-a-time — that's a presentation.
- There's no animation needed — use a canvas and export as PNG.

## Key Concepts

### Timeline

The video has a single flat timeline measured in seconds. All elements share this timeline. The total video duration is determined by the latest element endpoint: `max(element.start + element.duration)`.

### Elements

Each element extends the canvas element model with timeline fields:

```json
{
  "html": "<div style=\"...\">Hello</div>",
  "x": 100, "y": 200, "w": 400, "h": 100,
  "start": 0.5,
  "duration": 3.0,
  "type": "text",
  "name": "Headline",
  "z_index": 2,
  "opacity": 1,
  "scale": 1,
  "keyframes": {
    "opacity": [
      { "t": 0.3, "value": 1, "easing": "ease-out" }
    ]
  }
}
```

- **start**: When this element first appears (global seconds).
- **duration**: How long it stays visible.
- **type**: "shape", "text", "image", "svg" — used for UI display, not rendering behavior.
- **name**: Display name in the timeline panel.
- **opacity, scale**: Static values used at t=0 and when no keyframes exist.
- **fillColor, strokeColor, textColor**: Packed RGB integers (0xRRGGBB). E.g., white = 16777215, red = 16711680.
- **fontSize**: Static font size in px.
- **keyframes**: Per-property animation data (see below).
- **markers**: Time anchors for user reference (element-local seconds).

### Keyframes

Properties that can be keyframed: `x`, `y`, `w`, `h`, `opacity`, `scale`, `rotation`, `fillColor`, `strokeColor`, `textColor`, `fontSize`.

Keyframe times are **element-local** (0 = the element's start, not the video's start). The implicit t=0 value comes from the element's static fields.

```json
{
  "keyframes": {
    "opacity": [
      { "t": 1.0, "value": 1.0, "easing": "ease-out" },
      { "t": 2.5, "value": 0.0, "easing": "ease-in" }
    ],
    "y": [
      { "t": 0.5, "value": 180, "easing": "ease" }
    ]
  }
}
```

This means: opacity fades from static value to 1.0 over the first second (easing out), then fades to 0 from t=1.0 to t=2.5 (easing in). Y position slides from static value to 180px over 0.5 seconds.

Easing options: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`.

### Settings

```json
{
  "settings": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background_color": "#000000"
  }
}
```

## Typical Patterns

### Pattern 1: Create a complete animated video

The human asks for an animated intro, explainer, or motion graphic.

1. Plan the composition: what elements, where they go, when they appear, how they animate.
2. Call `create_video(title, { width, height, fps, background_color })`.
3. Call `batch_insert_video_elements(video_id, elements)` — pass ALL elements with their timing and keyframes in one call.
4. Report: what you created, total duration, element count, animation summary.

**Always use `batch_insert_video_elements` for new videos.** Design the entire composition mentally, then insert everything at once.

### Pattern 2: Add elements to an existing video

The human says "add a title card at the beginning" or "put a logo in the corner."

1. Call `get_video(video_id)` to see the current timeline.
2. Design the new elements with appropriate start/duration to fit the existing timeline.
3. Call `batch_insert_video_elements(video_id, elements)` or `insert_video_element` for one.
4. Report what was added.

### Pattern 3: Modify animation timing

The human says "make the fade-in faster" or "delay the subtitle by 0.5 seconds."

1. Call `get_video(video_id)` to find the element.
2. Call `update_video_element(video_id, element_id, { start, duration, keyframes })` — update timing or keyframes.
3. Report the change.

### Pattern 4: Redesign the entire video

The human wants major changes across the whole composition.

1. Call `get_video(video_id)` to understand the current state.
2. Design the new composition.
3. Call `replace_video_elements(video_id, elements)` to swap everything at once.
4. Report the changes.

### Pattern 5: Change video settings

The human wants different resolution or framerate.

1. Call `update_video_settings(video_id, { width, height, fps, background_color })`.
2. Report the change. Note: existing element positions may need adjustment if dimensions changed significantly.

## Animation Design Guidelines

### Entrance Animations

Common entrance effects built with keyframes:

**Fade in**: Set `opacity: 0` as static, add keyframe `{ t: 0.5, value: 1, easing: "ease-out" }`.

**Slide up + fade**: Set static `opacity: 0`, `y: element.y + 30`. Add keyframes:
- `opacity: [{ t: 0.5, value: 1, easing: "ease-out" }]`
- `y: [{ t: 0.5, value: targetY, easing: "ease-out" }]`

**Scale in**: Set `scale: 0.8`, `opacity: 0`. Add keyframes:
- `scale: [{ t: 0.4, value: 1, easing: "ease-out" }]`
- `opacity: [{ t: 0.3, value: 1, easing: "ease-out" }]`

### Exit Animations

Mirror entrance animations near the end of the element's duration:

**Fade out**: Add `opacity: [{ t: duration - 0.5, value: 1 }, { t: duration, value: 0, easing: "ease-in" }]`.

### Staggering

For multiple elements appearing in sequence, offset their `start` times:

```
Element 1: start=0.0, fade-in over 0.3s
Element 2: start=0.15, fade-in over 0.3s
Element 3: start=0.30, fade-in over 0.3s
```

A 0.1–0.2 second stagger between elements creates a natural cascade.

### Timing Principles

1. **Fast entrances, slower exits.** Entrance: 0.3–0.5s. Exit: 0.5–0.8s.
2. **Ease-out for entrances** (decelerate into position). **Ease-in for exits** (accelerate away).
3. **Don't animate everything.** Static backgrounds and persistent UI elements should not move. Animation draws attention — use it for what matters.
4. **Give elements time to be read.** A text element should be fully visible for at least 1.5× the reading time before it exits. A 5-word headline needs ~1.5s visible; a sentence needs ~3s.
5. **Total duration guideline:** 5–15 seconds for a social clip, 15–30 seconds for an intro, 30–60 seconds for an explainer segment.

## HTML Authoring

Video elements use the same HTML patterns as canvas elements. See `content-canvas.md` for:

- Inline styles (Shadow DOM isolation)
- SVG shapes and backgrounds
- Typography conventions
- Color palette guidelines

The only difference: video elements are rendered by `html-to-image` for export, so:

- Avoid CSS animations (`@keyframes`) — use the keyframes system instead for frame-accurate control.
- Avoid `<video>` or `<audio>` tags inside elements — they won't be captured.
- Complex CSS filters (blur, drop-shadow) may slow down frame capture.

## Color Values for Keyframes

Color properties (`fillColor`, `strokeColor`, `textColor`) use packed RGB integers:

- White: `16777215` (0xFFFFFF)
- Black: `0` (0x000000)
- Red: `16711680` (0xFF0000)
- Blue: `255` (0x0000FF)
- Custom: convert hex #RRGGBB to decimal. E.g., `#3B82F6` = `0x3B82F6` = `3899126`.

## Report Format

When reporting what you created:

```
Created "Product Launch" — 8 elements, 12s total duration:
- Background (0–12s): dark gradient, static
- Logo (0–12s): fade in at 0.3s, static after
- Headline (1–8s): slide up + fade in over 0.5s
- Subtext (1.5–8s): fade in over 0.3s
- Feature 1 (3–7s): slide left + fade, staggered 0.2s
- Feature 2 (3.2–7s): same pattern
- Feature 3 (3.4–7s): same pattern
- CTA (8–12s): scale in + fade
```
