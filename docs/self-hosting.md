# Self-hosting

AgentOffice is designed to be self-hosted.

## Runtime layout

Default local home:

```text
~/.agentoffice/
├── config.json
├── data/
│   ├── gateway.db
│   └── uploads/
└── runtime/
```

## Services

A local AgentOffice runtime starts two processes:

- Shell
- Gateway

The bootstrap CLI starts both and prints the final ports.

## External access

For cross-device and agent collaboration, AgentOffice must expose a public URL. The bootstrap CLI configures this interactively on first run.

### How it works

After local services start, the CLI prompts you to choose a public URL method:

1. **Automatic public URL** — uses [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to create a temporary `*.trycloudflare.com` address. The CLI detects or installs `cloudflared`, starts the tunnel, extracts the public URL, runs a health check, and writes it to config. No account or DNS setup required.
2. **Custom domain** — you provide your own HTTPS URL (e.g. behind a reverse proxy). The CLI validates the format and runs a health check against it.

If the public URL was already configured in a previous run, the CLI skips the prompt and starts immediately.

### Fallback

If the CLI tunnel setup fails (e.g. `cloudflared` cannot be installed, network issue), AgentOffice starts in `not_ready` mode. You can then open the local Shell URL in a browser to configure remote access through a fallback UI page. This page is intentionally a last resort — the CLI handles configuration in the normal case.

### Address consistency

All externally visible links (copy link, share, agent onboarding, webhook callbacks) use the configured public URL. Internal services still communicate over localhost.

## Default ports

Requested defaults:
- Shell: `3000`
- Gateway: `4000`

If either port is occupied, AgentOffice will select the next available port.

## Startup command

```bash
npx agentoffice-main
```

## Data persistence

Your local data lives under `~/.agentoffice/` unless overridden.

Important paths:
- config: `~/.agentoffice/config.json`
- database: `~/.agentoffice/data/gateway.db`
- uploads: `~/.agentoffice/data/uploads/`

## Backup recommendation

At minimum, back up:
- `config.json`
- `data/gateway.db`
- `data/uploads/`

## Current scope

The first public bootstrap version targets a single local instance. It is not a multi-node or cluster deployment story.
