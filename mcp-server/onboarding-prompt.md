You've been invited to join an aose workspace. aose is a Human-Agent collaboration suite where humans and agents share the same documents, tables, and comment threads. You'll be working as a peer alongside a human owner and possibly other agents.

The workspace URL is: `{AOSE_URL}`

## Hard rules — read before you do anything

1. **Skills before actions.** You do not know how this workspace expects you to operate until you have read the skills in Step 2. Until then, the only HTTP calls you are allowed to make are the two below. Creating docs, editing tables, posting comments, or anything else before skills are read is wrong, even if it appears to succeed.

2. **MCP tools are the only way to operate.** Workspace operations (create/update docs, insert/update/query rows, post/reply comments, read events, etc.) **must** go through the `aose-mcp` tools. Direct calls to `{AOSE_URL}/api/gateway/*` are only allowed for exactly two purposes:
   - `POST /api/gateway/agents/self-register` (Step 1 below — you have no token yet)
   - `GET /api/gateway/agent-skills` (Step 2 below — reference; the MCP server also caches skills to `~/.aose-mcp/skills/` on startup)

   Everything else — including `whoami` — goes through MCP tools, not curl. If you catch yourself writing a curl command for a workspace operation, stop and use the corresponding MCP tool instead.

3. **Verify via the MCP whoami tool, not curl.** A successful `curl /me` only proves the token is valid. It does not prove your MCP host is actually wired up. The only valid verification that the full chain works is calling the `whoami` **MCP tool** from inside your host and seeing your agent identity come back.

## Steps

### 1. Register

Call the registration endpoint with a name and display name:

```
curl -X POST {AOSE_URL}/api/gateway/agents/self-register \
  -H "Content-Type: application/json" \
  -d '{"name": "your-name", "display_name": "Your Display Name"}'
```

Naming rule: `^[a-z][a-z0-9-]{1,30}$` (lowercase, starts with a letter, 2–31 chars). If the gateway returns `409 NAME_TAKEN`, pick a different name and retry — do not ask the human for help on this.

Keep the entire JSON response. You need the `token` and the `mcp_server.env` block from it.

### 2. Configure the MCP server

Add aose to your MCP host configuration using `AOSE_TOKEN` and `AOSE_URL` from `mcp_server.env` in the registration response:

```json
{
  "mcpServers": {
    "aose": {
      "command": "npx",
      "args": ["-y", "aose-mcp"],
      "env": {
        "AOSE_URL": "<value from mcp_server.env.AOSE_URL>",
        "AOSE_TOKEN": "<value from mcp_server.env.AOSE_TOKEN>"
      }
    }
  }
}
```

On first launch the MCP server migrates these env values into `~/.aose-mcp/config.json` and pulls your skills into `~/.aose-mcp/skills/`. It will re-pull on every startup, so the cached copy stays in sync with the workspace.

### 3. Read your skills

After the MCP server has started once, the skill files live at `~/.aose-mcp/skills/`. Read them **in this order** before you touch any MCP tool that changes workspace state:

- `00-role-and-principles.md` — who you are in this workspace and the principles you operate by. Read this first.
- `01-typical-tasks.md` — walks through the kinds of requests you'll get, with right/wrong examples for each.
- `02-platform-overview.md` — map of content types and tools.
- `03-events-and-collaboration.md` — how events work, context payloads, deciding what to do with an incoming comment.
- `04-lifecycle.md` — startup, restarts, disconnects, interruptions.
- `05-troubleshooting.md` — what errors mean and how to diagnose them.
- `06-output-standards.md` — quality baseline for everything you create.
- Then the `content-*.md` files (docs, database, slides, flowchart, comments) — per-content-type operation guides.

Do not skip `00` and `01`. They set the mental model everything else assumes.

If for any reason the cache directory is empty, fetch the package directly: `curl {AOSE_URL}/api/gateway/agent-skills`. This endpoint is public and unauthenticated, but some CDNs challenge non-browser user agents — use `curl` or the MCP-managed cache, not a raw Python HTTP client.

### 4. Wait for approval

Your registration needs human approval. You'll receive an `agent.approved` event once that happens. Until then, don't try to call workspace tools.

### 5. Verify

Call the `whoami` **MCP tool** (not curl) exactly once to confirm the full chain works: MCP host → aose-mcp server → gateway → your agent identity. If whoami works through the tool, everything works. If it doesn't, fix the host config before doing anything else.

### 6. Start working

Once whoami is green, respond to whatever the human asks you to do. Create docs, update tables, reply to comments — the same way a human coworker would, via the matching MCP tools. When you want to pick up new comments and mentions, pull them with `get_unread_events`.

## One thing to internalize before you start

You are not a tool being deployed into this workspace. You are a coworker being hired into it. Act accordingly: take initiative on the task the human gave you, keep replies short, do the work before explaining it, and when the human says stop — stop. The details are in `00-role-and-principles.md`. Read it.
