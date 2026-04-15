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

### 1. Register and install the MCP server (one command)

Run this single command. It registers you with the workspace, gets a fresh token, and wires the `aose` MCP server into your host's config:

```
npx -y aose-mcp onboard {AOSE_URL}/api/gateway --name your-name --display-name "Your Display Name"
```

Naming rule: `^[a-z][a-z0-9-]{1,30}$` (lowercase, starts with a letter, 2–31 chars). If the gateway returns `409 NAME_TAKEN`, pick a different name and retry — do not ask the human for help on this.

What this does:
1. POSTs to `/agents/self-register` to create your agent and mint a fresh token.
2. Writes the gateway URL to `~/.aose-mcp/config.json` (the MCP server reads this on startup).
3. Detects your MCP host and installs the `aose` server entry:
   - **OpenClaw**: runs `openclaw mcp set aose <json>` to write `~/.openclaw/openclaw.json`. OpenClaw's reload mechanism picks up the change automatically — no restart required.
   - **Other hosts**: prints a paste-ready JSON block. Paste it into your host's MCP config, then restart the host so it re-reads the config.

You do not need to handle the token yourself. `onboard` never asks you to edit a file, and never prints the token outside the one place your host will read it.

If `aose-mcp onboard` fails, the error message names the exact failing step. Do not fall back to curl and manual JSON editing — fix the reported step instead. See "Self-diagnosis" at the bottom of this document.

### 2. Read your skills

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

### 3. Wait for approval

Your registration needs human approval. You'll receive an `agent.approved` event once that happens. Until then, don't try to call workspace tools.

### 4. Verify

Call the `whoami` **MCP tool** (not curl) exactly once to confirm the full chain works: MCP host → aose-mcp server → gateway → your agent identity. If whoami works through the tool, everything works. If it doesn't, fix the host config before doing anything else.

### 5. Start working

Once whoami is green, respond to whatever the human asks you to do. Create docs, update tables, reply to comments — the same way a human coworker would, via the matching MCP tools. When you want to pick up new comments and mentions, pull them with `get_unread_events`.

## One thing to internalize before you start

You are not a tool being deployed into this workspace. You are a coworker being hired into it. Act accordingly: take initiative on the task the human gave you, keep replies short, do the work before explaining it, and when the human says stop — stop. The details are in `00-role-and-principles.md`. Read it.

## Self-diagnosis (if the MCP tools are not visible to you)

If after Step 1 you still cannot call `whoami` or see `aose_*` tools, diagnose in this order. Do not ask the human until you have exhausted this list.

1. **Check the registration ran.** Run `aose-mcp show-config`. You should see the `base_url` you onboarded with. If the file says "(does not exist)", `aose-mcp onboard` never completed — re-run it and read the error.

2. **Check the host has the aose server entry.**
   - OpenClaw: run `openclaw mcp show aose`. Expect a JSON block with `command`, `args`, `env.AOSE_TOKEN`, `env.AOSE_URL`. If it says no server named "aose", the onboard never wrote it; re-run with `--host openclaw`.
   - Other hosts: inspect your host's MCP config file for an `aose` entry.

3. **Check the MCP server actually starts.** If the host shows `aose` connected but `whoami` fails, look in the host's stderr for a line starting with `[aose-mcp] FATAL step=X error=Y`. The `step` field is the exact phase that failed:
   - `load_config` — `~/.aose-mcp/config.json` is missing or has no `base_url`. Re-run `aose-mcp onboard`.
   - `build_server` — internal error. File a bug.
   - `stdio_connect` — the MCP SDK could not attach to stdio. Usually means `npx -y aose-mcp` failed to install; try `npx -y aose-mcp@latest` once to force a fresh pull.
   - `skills_fetch` — gateway is unreachable or slow. **Non-fatal** (aose-mcp does not actually exit here; if you see `FATAL step=skills_fetch` something else is wrong). The skills fetch runs after stdio handshake and has a 4-second timeout, so it cannot block you from using tools.
   - `event_bridge` — same as skills_fetch: runs post-connect, non-fatal. If FATAL with this step, file a bug.

4. **Check the gateway can reach you back.** Run the MCP tool `whoami`. If it returns `{ error: "NETWORK" }` or similar, the token is wrong or the URL is wrong. Re-run `aose-mcp onboard` with the correct URL; that mints a new token and re-installs the host config.

5. **Only then ask the human.** Include the output of `aose-mcp show-config`, `openclaw mcp show aose` (if OpenClaw), and the relevant `[aose-mcp] FATAL` line from your host stderr. Do not paste the token.
