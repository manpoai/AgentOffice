# Content: Flowcharts (Diagrams)

Reference for working with AgentOffice flowcharts. Assumes you've read `00-role-and-principles.md`, `01-typical-tasks.md`, `02-platform-overview.md`, and `03-events-and-collaboration.md`.

## What It Is

Flowcharts are node-and-edge diagrams built on AntV X6. A diagram is a **cells** array — an ordered list of nodes and edges in JSON format. Nodes are positioned shapes with labels; edges connect nodes via ports (top, bottom, left, right) with optional labels and styled connectors.

Use flowcharts for process flows, system architectures, decision trees, and state machines — things that have structure beyond a list.

## When to Use

Create a flowchart when:

- The content has **decision branches** — "if X then A, else B".
- There are **parallel paths** that merge later.
- There are **cycles** (retry loops, state transitions).
- You need to show **relationships between components** (architecture diagrams).

Don't create a flowchart when:

- The content is a **linear sequence of steps** — use a numbered list in a document.
- It's a **hierarchy** (org chart, taxonomy) — use nested lists in a doc, unless it has non-tree edges.
- A **mermaid diagram in a document** would suffice — simple flows can live inline in a doc without a standalone flowchart file.

## Typical Patterns

### Pattern 1: Create a new flowchart from a description

The human describes a process: "create a flowchart for the order approval workflow."

1. Identify the nodes: start, each step, decisions, end.
2. Lay them out in a consistent direction (top-to-bottom or left-to-right).
3. Assign coordinates so nodes at the same level share an axis.
4. Build the edges connecting ports.
5. Create the diagram with the cells array.
6. Report: the diagram title, number of nodes/edges, overall shape.

### Pattern 2: Update a single node or edge

The human says "change the 'Reject' step to 'Request Changes'" or comments on a specific node.

1. Read the current cells array (or use the event payload's anchor).
2. Find the cell by ID.
3. Replace only that cell; leave the rest untouched.
4. Write the cells back.
5. Report what changed.

### Pattern 3: Extend an existing flowchart

The human says "add an error handling branch after the validation step."

1. Read the diagram.
2. Compute new node(s) with coordinates that fit the existing layout.
3. Add new edge(s) connecting them.
4. Write back.
5. Report the addition.

## Node Structure

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

### Shape Types (24)

**Basic:** `rectangle`, `rounded-rect`, `circle`, `ellipse`, `triangle`

**Flowchart:**
- `parallelogram` — Input / Output
- `trapezoid` — Manual operation
- `stadium` — Start / End terminal
- `hexagon` — Preparation
- `pentagon`, `octagon` — General polygons
- `star` — Marker
- `cross` — Plus/intersection
- `cloud` — External system
- `cylinder` — Database / storage
- `diamond` — Decision

**Arrows:** `arrow-right`, `arrow-left`, `double-arrow`, `chevron-right`, `chevron-left`

**Annotation:** `callout`, `left-brace`, `right-brace`

### Visual Properties
- `bgColor`: fill color (hex, or `"transparent"`)
- `borderColor`: stroke color
- `textColor`: label text color
- `fontSize`: `12`, `14`, `16`, `18`, `20`, `24`, `28`, or `32`
- `fontWeight`: `"normal"` or `"bold"`
- `fontStyle`: `"normal"` or `"italic"`
- `textDecoration`: `""`, `"line-through"`, or `"underline"`
- `textAlign`: `"left"`, `"center"`, or `"right"`

### Ports
Every node has 4 ports: `top`, `bottom`, `left`, `right`. Edges connect from one port on the source to one port on the target.

## Edge Structure

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

### Connector Styles

| Style | For |
|-------|-----|
| `manhattan` | Orthogonal right-angle — default, clean flowcharts |
| `rounded` | Orthogonal with rounded corners |
| `straight` | Direct line — simple connections |
| `smooth` | Curved bezier — organic diagrams |

### Line Properties
- `stroke`: color (hex)
- `strokeWidth`: `1`, `1.5`, `2`, `3`, `4`, or `6`
- `strokeDasharray`: `""` (solid), `"8 4"` (dashed), `"2 4"` (dotted)

### Arrow Markers
- Classic filled: `{ "name": "classic", "size": 8 }`
- Classic outline: `{ "name": "classic", "fill": "none", "size": 8 }`
- None: `{ "name": "" }`

### Edge Labels
- One label per edge, positioned at the midpoint
- Use for decision outcomes (`"Yes"`/`"No"`), relationship names, or flow descriptions
- Leave obvious linear edges unlabeled

## Shape Conventions

Follow standard flowchart shape semantics — they're not decoration, they carry meaning:

- **Stadium / rounded rectangle** → Start, End, or terminal
- **Rectangle** → Process / action
- **Diamond** → Decision (yes/no outgoing edges)
- **Parallelogram** → Input / output
- **Cylinder** → Database / storage
- **Cloud** → External system / API

A reader who knows flowcharts should be able to read yours. Random shape choice breaks that contract.

## Layout Principles

- **Pick one direction** (top-to-bottom or left-to-right) and be consistent across the diagram.
- **Align nodes at the same level** — nodes in the same "row" or "column" should share x or y coordinates.
- **Consistent spacing** — 80–120px between nodes is a good range.
- **Minimize edge crossings** — rearrange nodes to reduce visual clutter.
- **Use color for meaning, not decoration** — green for success paths, red for errors, blue for external systems.

See `06-output-standards.md` for the full quality baseline.

## Common Patterns

**Linear process:**
```
Start → Step 1 → Step 2 → Step 3 → End
```

**Decision branch:**
```
Step → Decision ──Yes──→ Path A → Merge
              └──No──→ Path B ──↗
```

**Error handling:**
```
Process → Check ──OK──→ Continue
              └──Error──→ Handle Error → Retry/Exit
```

**Parallel processing:**
```
Start → Fork ──→ Task A ──→ Join → End
            └──→ Task B ──↗
```

## Edge Cases

- **Very large diagrams.** More than ~20 nodes becomes hard to read. Split into sub-diagrams and cross-reference.
- **Overlapping nodes.** Coordinates that collide make the diagram unreadable. Check positions before writing.
- **Orphan nodes.** A node with no edges is usually a mistake — either it should be connected, or it shouldn't be there.
- **Dead edges.** An edge whose source or target ID doesn't exist in the cells array breaks rendering. Verify IDs when assembling the cells.
- **Shape mismatches.** Using `diamond` for a non-decision or `rectangle` for start/end breaks convention — the diagram still renders but readers will be confused.

## Anti-Patterns

- **Don't reach for a flowchart when prose or a list will do.** A straight sequence of 5 steps is a list.
- **Don't rebuild the diagram to change one node.** Update the cell you need, leave the rest.
- **Don't embed a mermaid diagram in a doc AND create a standalone flowchart for the same content.** Pick one home.
- **Don't use a flowchart for a pure hierarchy.** Trees belong in nested lists unless there are non-tree edges.
- **Don't use random shapes for variety.** The shape is information; breaking convention confuses the reader.
- **Don't use color decoratively.** Color should encode meaning — success/error/external. Arbitrary color makes the diagram harder to read.
- **Don't leave node labels as `"Node 1"`, `"Step"`, or empty.** Labels should be 2–5 meaningful words.
