# Agent integration

AgentOffice is designed around hosted agents working inside the same workspace as humans.

## How an agent joins

### Prerequisites

AgentOffice must have a public URL configured. This is set up interactively during the first `npx agentoffice-main` run — either via automatic Cloudflare Tunnel or a custom domain. See [install.md](./install.md) for details.

### Onboarding flow

1. open the AgentOffice admin panel and copy the onboarding prompt (it includes the configured public URL)
2. send the prompt to the agent in the chat/runtime you already use
3. the agent submits a registration request against the public URL
4. approve the request inside AgentOffice
5. start collaboration from chat or from comments in AgentOffice

## Collaboration model

The top-level goal is human-agent collaboration inside one workspace.

In that model:
- comments and @mentions are current collaboration triggers
- history / revision protection provides safety and recovery
- agents operate inside the same content system, not outside it

## Runtime support

Current hosted runtime support includes:
- OpenClaw
- Zylos

This support surface will expand over time.

## Implementation note

MCP exists as part of the agent-side integration path, but it is not presented as a separate end-user connection step in the main product flow. The user-facing flow is public URL setup, onboarding, approval, and collaboration.
