# AgentOffice — Agent Skill: Working with Flowcharts

## Overview

AgentOffice flowcharts are node-and-edge diagrams built on AntV X6. You can create process flows, system architectures, decision trees, and organizational charts.

## Diagram Structure

A diagram consists of **cells** — an array of nodes and edges stored in JSON format.

## Node Types (24 Shapes)

**Basic Shapes:**
- `rectangle` — Standard box
- `rounded-rect` — Rounded corners (default shape)
- `circle` — Perfect circle
- `ellipse` — Oval shape
- `triangle` — Triangle

**Flowchart Shapes:**
- `parallelogram` — Input/Output
- `trapezoid` — Manual operation
- `stadium` — Terminal/Start-End
- `hexagon` — Preparation
- `pentagon` — Five-sided shape
- `octagon` — Eight-sided shape
- `star` — Star marker
- `cross` — Cross/Plus
- `cloud` — Cloud/External system
- `cylinder` — Database/Storage
- `diamond` — Decision point

**Arrow Shapes:**
- `arrow-right`, `arrow-left` — Directional arrows
- `double-arrow` — Bidirectional
- `chevron-right`, `chevron-left` — Process direction

**Annotation Shapes:**
- `callout` — Speech bubble
- `left-brace`, `right-brace` — Grouping braces

## Node Properties

```json
{
  "id": "node-1",
  "shape": "flowchart-node",
  "x": 200, "y": 100,
  "width": 120, "height": 60,
  "data": {
    "flowchartShape": "rounded-rect",
    "label": "Process Step",
    "bgColor": "#ffffff",
    "borderColor": "#374151",
    "textColor": "#1f2937",
    "fontSize": 14,
    "fontWeight": "normal",
    "fontStyle": "normal",
    "textDecoration": "",
    "textAlign": "center"
  }
}
```

**Visual Properties:**
- `bgColor`: Fill color (hex, or "transparent")
- `borderColor`: Stroke color (hex, or "transparent")
- `textColor`: Label text color
- `fontSize`: 12, 14, 16, 18, 20, 24, 28, or 32px
- `fontWeight`: "normal" or "bold"
- `fontStyle`: "normal" or "italic"
- `textDecoration`: "" or "line-through" or "underline"
- `textAlign`: "left", "center", or "right"

**Ports:**
Every node has 4 connection ports: top, bottom, left, right. Edges connect from one port to another.

## Edge Types

### Connector Styles (4 Types)

| Style | Description | Best For |
|-------|-------------|----------|
| `manhattan` | Orthogonal right-angle routing | Clean flowcharts (default) |
| `rounded` | Orthogonal with rounded corners | Softer look |
| `straight` | Direct straight line | Simple connections |
| `smooth` | Curved bezier line | Organic diagrams |

### Edge Properties

```json
{
  "id": "edge-1",
  "shape": "edge",
  "source": { "cell": "node-1", "port": "bottom" },
  "target": { "cell": "node-2", "port": "top" },
  "labels": [{ "attrs": { "label": { "text": "Yes" } } }],
  "attrs": {
    "line": {
      "stroke": "#94a3b8",
      "strokeWidth": 2,
      "strokeDasharray": "",
      "targetMarker": { "name": "classic", "size": 8 }
    }
  },
  "router": { "name": "manhattan" },
  "connector": { "name": "rounded" }
}
```

**Line Properties:**
- `stroke`: Line color (hex)
- `strokeWidth`: 1, 1.5, 2, 3, 4, or 6px
- `strokeDasharray`: "" (solid), "8 4" (dashed), "2 4" (dotted)

**Arrow Markers:**
- Classic: `{ "name": "classic", "size": 8 }` — Filled triangle
- Open: `{ "name": "classic", "fill": "none", "size": 8 }` — Outline triangle
- None: `{ "name": "" }` — No arrowhead

**Edge Labels:**
- One label per edge, positioned at the midpoint
- Use labels for decision outcomes ("Yes"/"No"), relationship names, or flow descriptions

## Guidelines for Creating Good Flowcharts

### Layout Principles
- **Top-to-bottom or left-to-right** — pick one direction and be consistent
- **Align nodes** — nodes at the same level should share the same x or y coordinate
- **Even spacing** — maintain consistent gaps between nodes (80–120px is a good range)
- **Minimize edge crossings** — rearrange nodes to reduce visual clutter

### Shape Conventions
Use standard flowchart shapes consistently:
- **Rounded rectangle (stadium)** → Start / End
- **Rectangle** → Process / Action
- **Diamond** → Decision (Yes/No)
- **Parallelogram** → Input / Output
- **Cylinder** → Database / Storage
- **Cloud** → External system / API

### Labeling
- **Node labels** should be short (2–5 words): "Validate Input", "Save to DB", "Send Email"
- **Edge labels** should describe the transition: "Yes", "No", "On Error", "If Valid"
- **Avoid redundant labels** — if the flow is obvious, skip the edge label

### Color Usage
- Use color to encode meaning, not decoration
- **Green** = success path, **Red** = error path, **Blue** = external systems
- Keep background colors light so text remains readable
- Use border color for emphasis, not fill color

### Complexity Management
- **Split large diagrams** — if a flowchart has >20 nodes, consider splitting into sub-diagrams
- **Use subprocess nodes** — a labeled rectangle can represent an entire sub-process
- **Cross-reference** — mention related diagrams in node labels or comments

### Common Patterns

**Linear Process:**
```
Start → Step 1 → Step 2 → Step 3 → End
```

**Decision Branch:**
```
Step → Decision ──Yes──→ Path A → Merge
              └──No──→ Path B ──↗
```

**Error Handling:**
```
Process → Check ──OK──→ Continue
              └──Error──→ Handle Error → Retry/Exit
```

**Parallel Processing:**
```
Start → Fork ──→ Task A ──→ Join → End
            └──→ Task B ──↗
```
