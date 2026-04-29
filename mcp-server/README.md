# aose-mcp

MCP Server for aose — connect AI agents to your workspace.

## Quick Start

Add aose to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "aose": {
      "command": "npx",
      "args": ["-y", "aose-mcp"],
      "env": {
        "AOSE_URL": "https://your-aose-domain/api/gateway",
        "AOSE_TOKEN": "your-agent-token"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AOSE_TOKEN` | Yes | — | Agent bearer token |
| `AOSE_URL` | Yes | — | aose public gateway base URL |

## Available Tool Groups

Current tool groups registered in code:

- Docs
- Data
- Presentations
- Diagrams
- Canvas
- Video
- Comments
- Events
- Search
- Revisions
- System
- Agents
- Content

## Typical Operations

### Docs
- `create_doc`
- `read_doc`
- `update_doc`
- `list_docs`

### Data
- `list_tables`
- `describe_table`
- `query_rows`
- `insert_row`
- `update_row`
- `delete_row`

### Comments
- `list_comments`
- `reply_to_comment`
- `resolve_comment`
- `unresolve_comment`

### Events
- `get_unread_events`
- `catchup_events`
- `ack_events`

### Canvas
- `create_canvas` / `update_canvas` / `get_canvas`
- `add_canvas_element` / `update_canvas_element` / `delete_canvas_element`
- `add_canvas_page` / `delete_canvas_page`
- `batch_canvas_operations`

### Video
- `create_video` / `update_video` / `get_video`
- `add_video_element` / `update_video_element` / `delete_video_element`
- `add_video_scene` / `delete_video_scene`

### Presentations
- `create_presentation` / `get_presentation` / `update_slide`
- `add_slide` / `delete_slide` / `reorder_slides`
- `insert_slide_element` / `update_slide_element` / `delete_slide_element`

### Diagrams
- `create_diagram` / `get_diagram` / `update_diagram`
- `add_node` / `update_node` / `delete_node`
- `add_edge` / `update_edge` / `delete_edge`
- `auto_layout` / `build_diagram`

### Search / Revisions
- `search_content`
- `list_revisions` / `create_revision` / `restore_revision`

### System / Agents / Content
- `whoami`
- `update_profile`
- `list_agents`
- `get_agent_info`
- `list_content_items`

## Local Development

```bash
cd mcp-server
npm install
AOSE_URL=https://your-aose-domain/api/gateway AOSE_TOKEN=your-token node src/index.js
```

## Publish Verification

After publish, this command should start the MCP server and fail only if required env vars are missing:

```bash
npx -y aose-mcp
```

## License

AGPL-3.0-or-later
