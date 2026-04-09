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
