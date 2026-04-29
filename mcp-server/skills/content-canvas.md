# Content: Canvas (Free-Form Design)

Reference for working with aose canvases. Assumes you've read `00-role-and-principles.md`, `01-typical-tasks.md`, `02-platform-overview.md`, and `03-events-and-collaboration.md`.

## What It Is

A canvas is a multi-page, free-form design surface. Each page is a coordinate grid (default 1920×1080 px) containing positioned HTML elements. Every element is an independent box at (x, y) with size (w, h) and arbitrary HTML content rendered in its own Shadow DOM.

The canvas is not a text editor. There is no document flow — elements are absolutely positioned and can overlap. Think of it as a graphic design tool where your medium is HTML + inline CSS.

## When to Use

Create a canvas when:

- The output is **visual design**: landing pages, UI mockups, posters, infographics, social media graphics.
- The content needs **precise spatial layout**: multi-column arrangements, overlapping elements, pixel-level positioning.
- You need **multiple pages** of different sizes in one project (e.g., a landing page hero + mobile variant + pricing page).
- The human says "design", "mockup", "layout", "poster", "banner", "infographic", or similar.

Don't create a canvas when:

- The content is primarily text for reading — that's a document.
- You need structured data with columns — that's a table.
- You need a process flow with connections — that's a diagram.
- You need animated content with a timeline — that's a video.

## Key Concepts

### Pages

A canvas has one or more pages. Each page has its own dimensions and title. Use different page sizes for different formats (1440×900 for desktop, 393×852 for mobile, 1080×1080 for social).

### Elements

Each element is a positioned rectangle containing HTML:

```json
{
  "html": "<div style=\"...\">content</div>",
  "x": 100, "y": 200,
  "w": 400, "h": 300,
  "z_index": 1,
  "locked": false
}
```

- **html**: Any valid HTML with inline styles. Shadow DOM isolates each element's styles.
- **x, y**: Position from the page's top-left corner. Can be negative (element partially off-page).
- **w, h**: Bounding box size. The HTML is rendered within this box.
- **z_index**: Stacking order — higher numbers render on top.
- **locked**: If true, the human cannot drag/resize the element in the editor.

### Element Types

Everything is HTML, but common patterns include:

1. **Background rectangles**: Full-page SVG rects or div backgrounds.
2. **Text elements**: `<div>` with font-family, font-size, color, etc.
3. **SVG shapes**: Circles, polygons, stars, custom paths wrapped in `<svg>`.
4. **Layout containers**: Flex containers for stat rows, nav bars, feature grids.
5. **Cards**: Rounded-corner containers with internal layout.
6. **Images**: `<div>` with background-image or `<img>` tags.

## Typical Patterns

### Pattern 1: Create a complete design from a brief

The human asks for a landing page, poster, or UI mockup.

1. Plan the design: page dimensions, visual hierarchy, color scheme, typography.
2. Call `create_canvas(title)`.
3. Call `add_page(canvas_id, { title, width, height, elements })` — pass ALL elements for the page in one call. This is much more efficient than inserting elements one by one.
4. For additional pages, call `add_page` again with their elements.
5. Report: what you created, page count, design summary.

**Always use `add_page` with the `elements` parameter for new pages.** Do not call `insert_element` in a loop — batch operations save API calls and are faster.

### Pattern 2: Add elements to an existing page

The human says "add a footer to page 2" or "put a call-to-action button here."

1. Call `get_canvas(canvas_id)` to see the current state.
2. Design the new elements.
3. Call `batch_insert_elements(canvas_id, page_id, elements)` to add multiple elements, or `insert_element` for a single one.
4. Report what was added.

### Pattern 3: Redesign an entire page

The human says "redo the pricing page" or the current design needs major changes.

1. Call `get_canvas(canvas_id)` to see the current state.
2. Design the new version.
3. Call `replace_page_elements(canvas_id, page_id, elements)` to swap all elements at once.
4. Report the changes.

**Prefer `replace_page_elements` over individual update/delete calls** when changing more than half the elements on a page.

### Pattern 4: Tweak individual elements

The human says "make the headline bigger" or "move the logo 20px to the right."

1. Call `get_canvas(canvas_id)` to find the element.
2. Identify it by its html content, position, or ID.
3. Call `update_element(canvas_id, page_id, element_id, patch)`.
4. Report the change.

## HTML Authoring Guidelines

### Inline Styles Only

Every element's HTML is rendered in a Shadow DOM. External CSS classes don't apply. **Always use inline styles.**

```html
<!-- ✅ Good -->
<div style="font-family: -apple-system, sans-serif; font-size: 48px; font-weight: 700; color: #0F172A;">
  Headline Text
</div>

<!-- ❌ Bad — class won't resolve -->
<div class="text-4xl font-bold">Headline Text</div>
```

### SVG for Shapes and Backgrounds

Use SVG for backgrounds, decorative shapes, and complex graphics. The standard pattern:

```html
<div style="width:100%;height:100%;overflow:visible;">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 W+2 H+2"
       preserveAspectRatio="none"
       style="width:100%;height:100%;display:block;overflow:visible;">
    <rect x="0" y="0" width="W" height="H" rx="12" fill="#1E293B"/>
  </svg>
</div>
```

- `viewBox` uses the element's w/h dimensions, padded by 1 on each side for strokes.
- `preserveAspectRatio="none"` lets the SVG stretch to fill the element box.
- Use `overflow:visible` to allow strokes and effects to extend beyond the box.

### Gradients

Use SVG linearGradient or radialGradient for gradient backgrounds:

```html
<svg ...>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
  </defs>
  <rect ... fill="url(#bg)"/>
</svg>
```

### Typography

- Use system fonts: `-apple-system, BlinkMacSystemFont, sans-serif` for UI text.
- Use `Georgia, serif` for editorial/literary styles.
- Use `monospace` for code or technical labels.
- Always set `box-sizing: border-box` on text containers.
- Use `white-space: nowrap` for single-line text, `white-space: normal; word-wrap: break-word` for multi-line.

### Layout within Elements

Use CSS flexbox for internal layout:

```html
<div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
  <div>Left content</div>
  <div>Right content</div>
</div>
```

### Colors

Use a consistent palette. Good defaults:

- **Dark backgrounds**: `#0F172A` (slate-900), `#1E293B` (slate-800)
- **Light backgrounds**: `#FFFFFF`, `#F8FAFC` (slate-50)
- **Text on dark**: `#FFFFFF`, `rgba(255,255,255,0.75)` for secondary
- **Text on light**: `#0F172A`, `#64748B` (slate-500) for secondary
- **Accent**: Pick one brand color and use it sparingly

### Spacing and Alignment

- Place elements on a consistent grid. Common gutters: 24px, 32px, 48px.
- Align text baselines when elements are side by side.
- Leave breathing room — don't pack elements edge to edge.

## Design Principles

1. **Visual hierarchy first.** Decide what the viewer sees first, second, third. Size, contrast, and position control this.
2. **Less is more.** Each element should serve a purpose. Remove decorative elements that don't support the message.
3. **Consistent typography.** Use 2-3 font sizes max. Title, body, caption — not 7 different sizes.
4. **Layered composition.** Use z_index to create depth. Background → mid-ground shapes → foreground content.
5. **Size the page to the content.** Don't use 1920×1080 for a mobile mockup. Match the canvas size to the deliverable.

## Element Structure

### Page summary format (in reports)

When reporting what you created, list pages and element counts:

```
Created "Lumina Landing Page" — 3 pages:
1. Hero (1440×900) — 13 elements: nav, tagline, headline, description, CTA buttons, stats, feature card
2. Mobile (393×852) — 12 elements: status bar, player interface, album art, controls
3. Pricing (1440×900) — 39 elements: header, 3 pricing cards with features and CTAs
```
