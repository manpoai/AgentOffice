# Configuration

## AgentOffice bootstrap

### `AGENTOFFICE_HOME`
Override the local data/runtime directory.

Default:

```bash
~/.agentoffice
```

### `PORT`
Requested Shell port.

Default:

```bash
3000
```

### `GATEWAY_PORT`
Requested Gateway port.

Default:

```bash
4000
```

### `AGENTOFFICE_ARTIFACT_URL`
Override the runtime artifact download URL used by `agentoffice-main`.

Default points to the GitHub Release asset for the current public bootstrap flow.

### `PUBLIC_BASE_URL`
If set before startup, the CLI skips the interactive remote access prompt and uses this value directly. Useful for automated deployments.

Example:

```bash
PUBLIC_BASE_URL=https://office.example.com npx agentoffice-main
```

## Runtime-generated config

On first start, AgentOffice writes:

```text
~/.agentoffice/config.json
```

Current fields include:
- `jwt_secret`
- `admin_password`
- `shell_port`
- `gateway_port`
- `remoteAccess.publicBaseUrl` — the configured public URL (set by CLI or browser fallback)
- `remoteAccess.mode` — `public_tunnel` or `public_custom_domain`
- `remoteAccess.status` — `not_ready`, `configuring`, `ready`, or `failed`

Treat this file as sensitive.

## Agent-side environment

The agent-side integration path may use environment variables such as `ASUITE_TOKEN` and `ASUITE_URL`, but those belong to the agent onboarding/runtime path rather than the main end-user workspace bootstrap flow.
