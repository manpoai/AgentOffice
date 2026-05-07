# Agent Permissions Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permissions configuration step to ConnectAgentsOverlay for Claude Code agents, letting users control which tool categories auto-execute vs require confirmation.

**Architecture:** When user selects Claude Code in ConnectAgentsOverlay, show a permissions panel before provisioning. The permissions object flows through IPC to AgentProvisioner, which merges them into the existing `.claude/settings.json` alongside hooks config.

**Tech Stack:** React (ConnectAgentsOverlay), Electron IPC (preload.js, main.js), Node.js (agent-provisioner.js)

---

### Task 1: Add Permissions UI to ConnectAgentsOverlay

**Files:**
- Modify: `shell/src/components/ConnectAgentsOverlay.tsx`

- [ ] **Step 1: Add permissions state and constants**

Add after the existing imports and before the component function:

```tsx
type PermissionMode = 'always' | 'ask';

interface ToolCategory {
  id: string;
  label: string;
  description: string;
  tools: string[];
  default: PermissionMode;
}

const CLAUDE_CODE_TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'aose',
    label: 'AOSE Workspace',
    description: 'Docs, tables, comments, events',
    tools: ['MCP(mcp__aose__*)'],
    default: 'always',
  },
  {
    id: 'files',
    label: 'File Operations',
    description: 'Read, edit, write files',
    tools: ['Read', 'Edit', 'Write'],
    default: 'always',
  },
  {
    id: 'shell',
    label: 'Shell Commands',
    description: 'Terminal commands (bash)',
    tools: ['Bash'],
    default: 'ask',
  },
  {
    id: 'web',
    label: 'Web Access',
    description: 'Fetch URLs, web search',
    tools: ['WebFetch', 'WebSearch'],
    default: 'ask',
  },
];
```

- [ ] **Step 2: Add permissions state inside the component**

Inside `ConnectAgentsOverlay`, after the existing state declarations, add:

```tsx
const [permissions, setPermissions] = useState<Record<string, PermissionMode>>(() => {
  const defaults: Record<string, PermissionMode> = {};
  CLAUDE_CODE_TOOL_CATEGORIES.forEach(cat => { defaults[cat.id] = cat.default; });
  return defaults;
});
const [showPermissions, setShowPermissions] = useState(false);
```

- [ ] **Step 3: Reset permissions state on overlay close**

In the existing `useEffect` that resets state when `!open`, add:

```tsx
setShowPermissions(false);
setPermissions(() => {
  const defaults: Record<string, PermissionMode> = {};
  CLAUDE_CODE_TOOL_CATEGORIES.forEach(cat => { defaults[cat.id] = cat.default; });
  return defaults;
});
```

- [ ] **Step 4: Modify handleSelectPlatform for Claude Code**

Replace the local platform handling in `handleSelectPlatform`. When `p === 'claude-code'`, instead of immediately provisioning, show the permissions step:

```tsx
async function handleSelectPlatform(p: string, isLocal: boolean) {
  if (isLocal && isElectron) {
    setSelectedPlatform(p);
    if (p === 'claude-code') {
      setShowPermissions(true);
      return;
    }
    await doProvision(p);
    return;
  }
  // ... rest of remote platform handling stays the same
}
```

- [ ] **Step 5: Extract provisioning into a separate function**

Move the provisioning logic out of `handleSelectPlatform` into `doProvision`:

```tsx
async function doProvision(p: string, perms?: Record<string, PermissionMode>) {
  setLoadingPrompt(true);
  try {
    const api = (window as any).electronAPI;
    const result = await api.provisionAgent(p, perms || null);
    const panel = (window as any).__aoseTerminalPanel;
    if (panel) {
      const welcome =
        `\x1b[1;32m✓ Agent provisioned successfully\x1b[0m\r\n\r\n` +
        `  Agent:     ${result.agentName}\r\n` +
        `  Platform:  ${platformLabel(p)}\r\n` +
        `  Directory: ${result.agentDir}\r\n` +
        `  Config:    ${result.agentDir}/.mcp.json\r\n\r\n` +
        `\x1b[1mReady.\x1b[0m Open this directory in ${platformLabel(p)} to start working.\r\n\r\n`;
      panel.addTab({
        agentId: result.agentName,
        agentName: result.agentName,
        platform: p,
        welcomeMessage: welcome,
      });
    }
    onClose();
  } catch (err: any) {
    setPromptText(`Error: ${err.message || 'Failed to provision agent'}`);
  }
  setLoadingPrompt(false);
}
```

- [ ] **Step 6: Add the permissions view**

Add a new `permissionsView` variable alongside the existing `promptView`:

```tsx
const permissionsView = (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Configure which tools auto-execute and which require confirmation.
    </p>
    {CLAUDE_CODE_TOOL_CATEGORIES.map(cat => (
      <div key={cat.id} className="flex items-center justify-between py-2">
        <div>
          <div className="text-sm font-medium">{cat.label}</div>
          <div className="text-xs text-muted-foreground">{cat.description}</div>
        </div>
        <select
          value={permissions[cat.id]}
          onChange={e => setPermissions(prev => ({ ...prev, [cat.id]: e.target.value as PermissionMode }))}
          className="text-xs px-2 py-1 rounded-md border border-border bg-background"
        >
          <option value="always">Always</option>
          <option value="ask">Ask</option>
        </select>
      </div>
    ))}
    <button
      onClick={() => doProvision('claude-code', permissions)}
      disabled={loadingPrompt}
      className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      style={{ backgroundColor: 'hsl(var(--sidebar-primary))', color: 'hsl(var(--sidebar-primary-foreground))' }}
    >
      {loadingPrompt ? 'Creating...' : 'Create Agent'}
    </button>
  </div>
);
```

- [ ] **Step 7: Wire the permissions view into the render**

In the desktop render (non-mobile), replace the content area:

```tsx
<div className="flex-1 overflow-y-auto px-5 py-4">
  {!selectedPlatform ? platformList : showPermissions ? permissionsView : promptView}
</div>
```

And in the mobile BottomSheet render:

```tsx
<div className="flex-1 overflow-y-auto px-4 py-3">
  {!selectedPlatform ? platformList : showPermissions ? permissionsView : promptView}
</div>
```

- [ ] **Step 8: Update the back button to handle permissions step**

In both desktop and mobile back buttons, update the onClick to also reset permissions state:

```tsx
onClick={() => { setSelectedPlatform(null); setPromptText(''); setCopied(false); setShowPermissions(false); }}
```

- [ ] **Step 9: Commit**

```bash
git add shell/src/components/ConnectAgentsOverlay.tsx
git commit -m "feat: add permissions config UI for Claude Code agents in ConnectAgentsOverlay"
```

---

### Task 2: Pass Permissions Through IPC

**Files:**
- Modify: `electron/preload.js:24`
- Modify: `electron/main.js:130-139`

- [ ] **Step 1: Update preload.js to accept permissions parameter**

Change line 24 from:

```js
provisionAgent: (platform) => ipcRenderer.invoke('agent:provision', platform),
```

To:

```js
provisionAgent: (platform, permissions) => ipcRenderer.invoke('agent:provision', platform, permissions),
```

- [ ] **Step 2: Update main.js IPC handler to forward permissions**

Change lines 130-139 from:

```js
ipcMain.handle('agent:provision', async (_event, platform) => {
  const result = await provisioner.provision(platform);
```

To:

```js
ipcMain.handle('agent:provision', async (_event, platform, permissions) => {
  const result = await provisioner.provision(platform, permissions);
```

- [ ] **Step 3: Commit**

```bash
git add electron/preload.js electron/main.js
git commit -m "feat: pass permissions config through IPC to agent provisioner"
```

---

### Task 3: Write Permissions to settings.json

**Files:**
- Modify: `electron/agent-provisioner.js:16,57,101-123`

- [ ] **Step 1: Update provision() to accept and pass permissions**

Change line 16 from:

```js
async provision(platform) {
```

To:

```js
async provision(platform, permissions) {
```

And change line 57 from:

```js
this._writeHookConfig(platform, agentName, agentDir);
```

To:

```js
this._writeHookConfig(platform, agentName, agentDir, permissions);
```

- [ ] **Step 2: Update _writeHookConfig to merge permissions into settings.json**

Replace the entire `_writeHookConfig` method (lines 101-123) with:

```js
_writeHookConfig(platform, agentName, agentDir, permissions) {
  if (platform === 'claude-code') {
    const claudeDir = path.join(agentDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const settings = {
      permissions: {
        allow: this._buildAllowList(permissions),
      },
      hooks: {
        Stop: [{
          matcher: '',
          hooks: [{
            type: 'command',
            command: `AOSE_AGENT_NAME=${agentName} bash ~/.aose/hooks/stop-hook-claude-local.sh`,
          }],
        }],
      },
    };
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));
  } else if (platform === 'codex') {
    const codexDir = path.join(agentDir, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    const config = `[hooks]\nstop = "AOSE_AGENT_NAME=${agentName} bash ~/.aose/hooks/stop-hook-codex-local.sh"\n`;
    fs.writeFileSync(path.join(codexDir, 'config.toml'), config);
  }
}
```

- [ ] **Step 3: Add _buildAllowList helper method**

Add this method to the `AgentProvisioner` class, after `_writeHookConfig`:

```js
_buildAllowList(permissions) {
  if (!permissions) {
    return ['MCP(mcp__aose__*)', 'Read', 'Edit', 'Write'];
  }

  const CATEGORY_TOOLS = {
    aose: ['MCP(mcp__aose__*)'],
    files: ['Read', 'Edit', 'Write'],
    shell: ['Bash'],
    web: ['WebFetch', 'WebSearch'],
  };

  const allow = [];
  for (const [catId, tools] of Object.entries(CATEGORY_TOOLS)) {
    if (permissions[catId] === 'always') {
      allow.push(...tools);
    }
  }
  return allow;
}
```

When `permissions` is null (non-Claude-Code platforms or legacy calls), defaults to AOSE + Files always allowed. When provided, builds the allow list from the user's choices.

- [ ] **Step 4: Commit**

```bash
git add electron/agent-provisioner.js
git commit -m "feat: write permissions.allow to .claude/settings.json during provisioning"
```

---

### Task 4: Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Move API dir for static build**

```bash
cd /Users/mac/Documents/asuite
mv shell/src/app/api shell/src/app/_api
```

- [ ] **Step 2: Build**

```bash
cd shell && BUILD_MODE=app npx next build
```

- [ ] **Step 3: Restore API dir**

```bash
cd /Users/mac/Documents/asuite
mv shell/src/app/_api shell/src/app/api
```

- [ ] **Step 4: Verify the settings.json output**

Manually verify by reading the provisioner code that when `permissions = { aose: 'always', files: 'always', shell: 'ask', web: 'ask' }` the output is:

```json
{
  "permissions": {
    "allow": ["MCP(mcp__aose__*)", "Read", "Edit", "Write"]
  },
  "hooks": { "Stop": [...] }
}
```

And when all are "always":

```json
{
  "permissions": {
    "allow": ["MCP(mcp__aose__*)", "Read", "Edit", "Write", "Bash", "WebFetch", "WebSearch"]
  },
  "hooks": { "Stop": [...] }
}
```

- [ ] **Step 5: Commit build artifacts if needed and push**

```bash
git push origin feat/desktop-app-sync
```
