# v2.0.0 — Rebrand to aose

**This is a major version with breaking changes.** The rebrand is complete — no compatibility shims, no grace period.

## Highlights

- Renamed from `agentoffice-main` to `aose` (short for **a**gent **o**ffice **s**uit**e**)
- MCP package renamed from `agentoffice-mcp` to `aose-mcp`
- Editor naming unified across locales: **Docs / Database / Slides / Flowchart**
- GitHub repository renamed to `manpoai/AgentOfficeSuite` (old URLs 301-redirect)

## Breaking Changes

1. **Package renamed**: `agentoffice-main` → `aose`
2. **Command renamed**: `agentoffice-main` → `aose`
3. **MCP package renamed**: `agentoffice-mcp` → `aose-mcp`
4. **Data directory renamed**: `~/.agentoffice/` → `~/.aose/`
5. **MCP config directory renamed**: `~/.agentoffice-mcp/` → `~/.aose-mcp/`
6. **Environment variables renamed**:
   - `AGENTOFFICE_HOME` → `AOSE_HOME`
   - `AGENTOFFICE_ARTIFACT_URL` → `AOSE_ARTIFACT_URL`
   - `ASUITE_URL` → `AOSE_URL`
   - `ASUITE_TOKEN` → `AOSE_TOKEN`

## Migration Guide

```bash
# Uninstall old
npm uninstall -g agentoffice-main
npm uninstall -g agentoffice-mcp

# Install new
npm install -g aose
npm install -g aose-mcp

# Start
aose start -d
```

For agents with MCP already configured, update both the command and the env vars:

```json
{
  "mcpServers": {
    "aose": {
      "command": "npx",
      "args": ["-y", "aose-mcp"],
      "env": { "AOSE_URL": "...", "AOSE_TOKEN": "..." }
    }
  }
}
```

If you have existing data in `~/.agentoffice/` and want to keep it, rename the directory before starting v2.0.0:

```bash
mv ~/.agentoffice ~/.aose
mv ~/.agentoffice-mcp ~/.aose-mcp
```

## Deprecation of Old Packages

`agentoffice-main` and `agentoffice-mcp` remain on npm as the final v1.x release for historical reference, but will receive no further updates. Install `aose` / `aose-mcp` going forward.
