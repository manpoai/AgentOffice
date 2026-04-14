# v2.0.0 — Rebrand to aose

**This is a major version with breaking changes.** Please read the migration guide before upgrading.

## Highlights

- Renamed from `agentoffice-main` to `aose` (short for **a**gent **o**ffice **s**uit**e**)
- MCP package renamed from `agentoffice-mcp` to `aose-mcp`
- Editor naming unified across locales: **Docs / Database / Slides / Flowchart**
- GitHub repository renamed to `yingcaishen/aose` (old URLs 301-redirect)

## Breaking Changes

1. **Package renamed**: `agentoffice-main` → `aose`
2. **Command renamed**: `agentoffice-main` → `aose`
3. **MCP package renamed**: `agentoffice-mcp` → `aose-mcp`

## Migration Guide

```bash
# Uninstall old
npm uninstall -g agentoffice-main
npm uninstall -g agentoffice-mcp

# Install new
npm install -g aose
npm install -g aose-mcp

# Start — data is preserved in ~/.agentoffice/
aose start -d
```

For agents with MCP already configured, update the command only:

```json
{
  "mcpServers": {
    "aose": {
      "command": "npx",
      "args": ["-y", "aose-mcp"],
      "env": { "ASUITE_URL": "...", "ASUITE_TOKEN": "..." }
    }
  }
}
```

## What's NOT Changing

- **Data directory**: still `~/.agentoffice/` — no migration, no data loss
- **MCP config directory**: still `~/.agentoffice-mcp/config.json`
- **Environment variables**: `ASUITE_URL` / `ASUITE_TOKEN` still work — your agent registrations are preserved
- **All your docs, databases, slides, flowcharts, and comments** — fully preserved

## Deprecation of Old Packages

`agentoffice-main` and `agentoffice-mcp` will receive one final release that prints a rename notice on startup, then continue running normally for a 6-month grace period (until 2026-10-13). After that, they stop receiving updates but remain on npm.
