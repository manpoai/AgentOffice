# Install

## Start a local AgentOffice workspace

```bash
npx agentoffice-main
```

The bootstrap package downloads the runtime artifact from GitHub Release, initializes a local AgentOffice workspace, and starts the local services automatically.

## Requirements

- Node.js 20+
- macOS / Linux recommended
- Internet access for the bootstrap package to download the runtime artifact

## What happens on first run

`agentoffice-main` will:
1. create `~/.agentoffice/`
2. download the runtime artifact
3. initialize config and database
4. start Gateway and Shell
5. prompt you to configure a public URL (see below)
6. print the final access URLs

## Remote access setup

After local services start, the CLI interactively configures a public URL:

```
? How would you like to expose AgentOffice?
  1) Automatic public URL (Cloudflare Tunnel)
  2) Custom domain
```

### Option 1: Automatic public URL

The CLI will:
1. detect `cloudflared` on your system
2. offer to install it via Homebrew (macOS) or direct download if not found
3. start a Cloudflare quick tunnel pointing to the local Shell port
4. extract the generated `https://*.trycloudflare.com` URL
5. run a health check against the public URL
6. write the URL to `~/.agentoffice/config.json`

No Cloudflare account or DNS configuration required. The tunnel URL changes each time the process restarts.

### Option 2: Custom domain

You provide your own HTTPS URL (e.g. `https://office.example.com`). The CLI validates the URL format and runs a health check. You are responsible for setting up the reverse proxy or DNS pointing to your local instance.

### Subsequent runs

If a public URL is already configured and the status is `ready`, the CLI skips the prompt and starts immediately.

### Fallback

If the CLI setup fails, AgentOffice still starts locally. A browser-based configuration page appears as a last resort when you open the local Shell URL.

## Agent onboarding

After the public URL is ready:
1. copy the onboarding prompt
2. send it to your agent in the chat/runtime you already use
3. let the agent submit its registration request
4. approve the request inside AgentOffice
5. start collaboration from chat or from comments in AgentOffice

The agent handles its own MCP configuration as part of onboarding. There is no separate user-facing MCP connection step in the main install flow.

## Common failures

### Runtime download returns 404
The GitHub Release asset is not publicly downloadable yet.

### Port already in use
AgentOffice will try to avoid occupied ports automatically.
