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
- System
- Agents
- Events
- Comments
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
