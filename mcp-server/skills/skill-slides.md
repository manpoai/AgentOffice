# AgentOffice — Agent Skill: Working with Presentations

## Overview

AgentOffice presentations are slide decks built from structured JSON data. Each slide contains elements (text, shapes, images, tables) positioned on a 960×540 pixel canvas.

## Slide Structure

A presentation is an array of slides. Each slide has:
```json
{
  "elements": [...],      // Array of positioned elements
  "background": "#ffffff", // Background color (hex)
  "backgroundImage": null, // Optional background image URL
  "notes": ""             // Speaker notes (plain text)
}
```

## Element Types

### Textbox
```json
{
  "type": "textbox",
  "left": 100, "top": 50,
  "width": 400, "height": 60,
  "text": "Your text here",
  "fontSize": 24,
  "fontFamily": "Inter",
  "fontWeight": "normal",
  "fontStyle": "normal",
  "textAlign": "left",
  "fill": "#1f2937",
  "opacity": 1,
  "angle": 0
}
```

**Text Properties:**
- `fontSize`: 10–200px (common sizes: 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96)
- `fontFamily`: Inter, Arial, Georgia, Times New Roman, Courier New, Verdana, Trebuchet MS, Comic Sans MS, Noto Sans SC, Noto Serif SC, Microsoft YaHei, PingFang SC
- `fontWeight`: "normal" or "bold"
- `fontStyle`: "normal" or "italic"
- `underline`: true/false
- `linethrough`: true/false
- `textAlign`: "left", "center", "right", "justify"
- `lineHeight`: multiplier (default 1.3)
- `charSpacing`: character spacing in pixels
- `padding`: inner padding in pixels

### Shapes (24 Types)

**Basic:** rectangle, rounded-rect, circle, ellipse, triangle
**Flowchart:** parallelogram, trapezoid, stadium, hexagon, pentagon, octagon, star, cross, cloud, cylinder
**Arrows:** arrow-right, arrow-left, double-arrow, chevron-right, chevron-left
**Callouts:** callout, left-brace, right-brace, diamond

```json
{
  "type": "shape",
  "shapeType": "rounded-rect",
  "left": 200, "top": 150,
  "width": 200, "height": 100,
  "fill": "#e2e8f0",
  "stroke": "#94a3b8",
  "strokeWidth": 2,
  "strokeDashArray": null,
  "opacity": 1,
  "angle": 0
}
```

**Shape Properties:**
- `fill`: Fill color (hex)
- `stroke`: Border color (hex)
- `strokeWidth`: 0–20px
- `strokeDashArray`: null (solid), [8,4] (dashed), [2,4] (dotted)
- `rx` / `ry`: Corner radius (for rectangles)
- `shadow`: `{ color, blur, offsetX, offsetY }` or null

### Image
```json
{
  "type": "image",
  "src": "https://...",
  "left": 50, "top": 200,
  "width": 300, "height": 200,
  "scaleX": 1, "scaleY": 1,
  "stroke": null,
  "strokeWidth": 0,
  "borderRadius": 0,
  "opacity": 1,
  "angle": 0
}
```

### Table
```json
{
  "type": "table",
  "left": 100, "top": 300,
  "width": 500, "height": 200,
  "tableJSON": { ... }
}
```
Tables use ProseMirror JSON structure with table, table_header, and table_row nodes.

### Embedded Diagram
Images with `src` in format `diagram:diagramId` render an embedded flowchart diagram.

## Speaker Notes

Each slide has a `notes` field (plain text string) for presenter notes. Use speaker notes to:
- Add talking points for presentations delivered by humans
- Store metadata or context about slide content
- Provide instructions for future editors

## Guidelines for Creating Good Presentations

### Structure
- **Start with a clear outline** — decide the narrative arc before creating slides
- **One idea per slide** — avoid overloading slides with multiple concepts
- **Consistent layout** — maintain consistent element positions across slides
- **Logical flow** — each slide should naturally lead to the next

### Visual Design
- **Limit text** — use bullet points, not paragraphs. Aim for ≤6 lines per slide, ≤6 words per line
- **High contrast** — ensure text is readable against the background
- **Consistent colors** — pick 2–3 primary colors and use them throughout
- **White space** — don't fill every pixel. Breathing room improves readability
- **Font hierarchy** — use larger sizes for titles (36–48px), medium for body (18–24px), smaller for labels (12–14px)

### Content Tips
- **Title slides** — include presentation title + subtitle or date
- **Section headers** — use bold text on a clean background to signal topic transitions
- **Data slides** — prefer embedded tables or simple text over complex layouts
- **Summary slides** — end with key takeaways or next steps
- **Use shapes** — flowchart shapes and arrows help visualize processes and relationships
- **Speaker notes** — always add notes to give context for the visual content

### What to Avoid
- Walls of text — if you need that much text, it should be a document
- Too many fonts — stick to 1–2 font families
- Tiny text — if it's below 14px, it's probably not readable in a presentation
- Decorative clutter — every element should serve a purpose
