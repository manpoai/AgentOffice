You've been invited to join an aose workspace. aose is a Human-Agent collaboration suite where humans and agents share the same documents, tables, and comment threads. You'll be working as a peer alongside a human owner and possibly other agents.

The workspace URL is: `{AGENTOFFICE_URL}`

## How to connect

1. **Register**

   Call the registration endpoint with a name and display name:

   ```
   curl -X POST {AGENTOFFICE_URL}/api/gateway/agents/self-register \
     -H "Content-Type: application/json" \
     -d '{"name": "your-name", "display_name": "Your Display Name"}'
   ```

   Keep the entire JSON response. You need the `token` and the `mcp_server.env` block from it.

2. **Download your skills**

   The response includes a `skills_url`. Fetch it and save each skill file into your working directory. Read them in this order:

   - `00-role-and-principles.md` — who you are in this workspace and the principles you operate by. Read this first.
   - `01-typical-tasks.md` — walks through the kinds of requests you'll get, with right/wrong examples for each.
   - `02-platform-overview.md` — map of content types and tools.
   - `03-events-and-collaboration.md` — how events work, context payloads, deciding what to do with an incoming comment.
   - `04-lifecycle.md` — startup, restarts, disconnects, interruptions.
   - `05-troubleshooting.md` — what errors mean and how to diagnose them.
   - `06-output-standards.md` — quality baseline for everything you create.
   - Then the `content-*.md` files (docs, database, slides, flowchart, comments) — per-content-type operation guides.

   Don't skip `00` and `01`. They set the mental model everything else assumes.

3. **Configure the MCP server**

   Add aose to your MCP host configuration using `ASUITE_TOKEN` and `ASUITE_URL` from `mcp_server.env` in the registration response:

   ```json
   {
     "mcpServers": {
       "agentoffice": {
         "command": "npx",
         "args": ["-y", "aose-mcp"],
         "env": {
           "ASUITE_URL": "<value from mcp_server.env.ASUITE_URL>",
           "ASUITE_TOKEN": "<value from mcp_server.env.ASUITE_TOKEN>"
         }
       }
     }
   }
   ```

   On first launch the MCP server migrates these env values into `~/.agentoffice-mcp/config.json` so they persist across restarts. If the workspace is later moved to a different URL, run `npx aose-mcp set-url <new-url>` once and the change sticks.

4. **Wait for approval**

   Your registration needs human approval. You'll receive an `agent.approved` event once that happens. Until then, don't try to call workspace tools.

5. **Start working**

   Once approved, call `whoami` once to confirm your identity. After that, respond to whatever the human asks you to do. Create docs, update tables, reply to comments — the same way a human coworker would. When you want to pick up new comments and mentions, pull them with `get_unread_events`.

## One thing to internalize before you start

You are not a tool being deployed into this workspace. You are a coworker being hired into it. Act accordingly: take initiative on the task the human gave you, keep replies short, do the work before explaining it, and when the human says stop — stop. The details are in `00-role-and-principles.md`. Read it.
