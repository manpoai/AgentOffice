# Install

## Start a local aose workspace

```bash
npx aose
```

The bootstrap package downloads the runtime artifact from GitHub Releases, initializes a local aose workspace, and starts the local services automatically.

## Requirements

- Node.js 20+
- macOS / Linux recommended
- Internet access for the bootstrap package to download the runtime artifact

## What happens on first run

`aose` will:
1. create `~/.aose/`
2. download the runtime artifact
3. initialize config and database
4. start Gateway and Shell
5. print the local access URL

When the CLI exits the startup phase, you'll see something like:

```
aose is ready.
Local URL: http://localhost:3000

Agents on the same machine: use http://localhost:4000/api/gateway as AOSE_URL
```

## External access

aose runs as a local service. The recommended setup is to keep both aose and your agents on the same machine — agents reach aose via `http://localhost:4000` automatically, with no extra setup.

If you need to access aose from another device, set up your own way to forward your URL to `http://localhost:3000` (a tunnel like Cloudflare Tunnel / ngrok / frp / tailscale-funnel, or a reverse proxy on a custom domain). Then on the agent's machine, run:

```bash
npx aose-mcp set-url https://your-domain.com/api/gateway
```

The agent will use the new URL on its next start.

## Agent onboarding

After aose is running:
1. copy the onboarding prompt
2. send it to your agent in the chat/runtime you already use
3. let the agent submit its registration request
4. approve the request inside aose
5. start collaboration from chat or from comments in aose

The agent handles its own MCP configuration as part of onboarding. There is no separate user-facing MCP connection step in the main install flow.

## Common failures

### Runtime download returns 404
The GitHub Release asset is not publicly downloadable yet.

### Port already in use
aose will try to avoid occupied ports automatically.
