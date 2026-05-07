# Agent Permissions Configuration (Claude Code)

## Goal

Add a permissions configuration step to the ConnectAgentsOverlay flow for Claude Code agents. Users can control which tool categories are auto-allowed vs require confirmation. Configuration is stored in the agent's `.claude/settings.json` and applied on every Claude Code launch.

## Architecture

Permissions are organized into tool categories, each with two modes: "Always" (auto-execute) or "Ask" (requires user confirmation). The UI is a step in the existing ConnectAgentsOverlay flow, shown after platform selection and before agent creation. The configuration writes to `.claude/settings.json` `permissions.allow` array.

## Scope

- Claude Code only (Gemini CLI and Codex have different permission models)
- Only "Always" and "Ask" modes (no "Never"/deny)
- Stored in `.claude/settings.json` alongside existing hooks config

---

## Tool Categories

| Category | Description | Tools | Default |
|----------|-------------|-------|---------|
| AOSE Workspace | Create/read docs, tables, comments, events | `MCP(mcp__aose__*)` | Always |
| File Operations | Read and edit files in agent directory | `Read`, `Edit`, `Write` | Always |
| Shell Commands | Run terminal commands | `Bash` | Ask |
| Web Access | Fetch URLs, search the web | `WebFetch`, `WebSearch` | Ask |

"Always" = tool added to `permissions.allow` array → auto-executes without prompting.
"Ask" = tool NOT in allow list → Claude Code's default behavior (prompts user).

## Settings File Format

The provisioner already writes `.claude/settings.json` in the agent directory for hooks. The permissions section is added alongside:

```json
{
  "permissions": {
    "allow": [
      "MCP(mcp__aose__*)",
      "Read",
      "Edit",
      "Write"
    ]
  },
  "hooks": {
    "Stop": [...]
  }
}
```

When all categories are "Always":
```json
{
  "permissions": {
    "allow": [
      "MCP(mcp__aose__*)",
      "Read",
      "Edit",
      "Write",
      "Bash",
      "WebFetch",
      "WebSearch"
    ]
  }
}
```

When all categories are "Ask":
```json
{
  "permissions": {
    "allow": []
  }
}
```

## UI Design

### In ConnectAgentsOverlay

After user selects "Claude Code" platform, show a permissions panel before provisioning:

```
┌─ Agent Permissions ─────────────────────┐
│                                         │
│  AOSE Workspace Tools        [Always ▼] │
│  Docs, tables, comments, events         │
│                                         │
│  File Operations             [Always ▼] │
│  Read, edit, write files                │
│                                         │
│  Shell Commands              [  Ask  ▼] │
│  Terminal commands (bash)               │
│                                         │
│  Web Access                  [  Ask  ▼] │
│  Fetch URLs, web search                │
│                                         │
│           [ Create Agent ]              │
└─────────────────────────────────────────┘
```

Each category has a toggle/dropdown that switches between "Always" and "Ask". Defaults shown above.

### Post-creation

The permissions config is stored alongside the agent. If we later want to edit permissions, we can add an "Edit Permissions" button in AgentPanelContent — but that's out of scope for now.

## Implementation

### Modified files

1. **`shell/src/components/ConnectAgentsOverlay.tsx`** — Add permissions UI step for claude-code platform
2. **`electron/agent-provisioner.js`** — Accept permissions config, write to settings.json
3. **`electron/preload.js`** — Pass permissions through IPC (already passes platform, just add permissions object)
4. **`electron/main.js`** — Pass permissions from IPC to provisioner

### Data flow

```
ConnectAgentsOverlay (UI)
  → permissions: { aose: 'always', files: 'always', shell: 'ask', web: 'ask' }
  → electronAPI.provisionAgent('claude-code', permissions)
  → ipcMain.handle('agent:provision')
  → AgentProvisioner.provision('claude-code', permissions)
  → _writeHookConfig() now also writes permissions.allow array
  → .claude/settings.json updated with both hooks + permissions
```
