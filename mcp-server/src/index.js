#!/usr/bin/env node
/**
 * ASuite MCP Server
 *
 * Exposes ASuite workspace operations (IM, Docs, Tasks, Data) as MCP tools.
 * Connects to ASuite Gateway via HTTP REST, communicates with AI agents via MCP stdio protocol.
 *
 * Configuration (env vars):
 *   ASUITE_URL   — Gateway URL (default: http://localhost:4000)
 *   ASUITE_TOKEN — Agent bearer token (required)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GatewayClient } from './gateway-client.js';
import { registerMessageTools } from './tools/messages.js';
import { registerDocTools } from './tools/docs.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerDataTools } from './tools/data.js';
import { registerSystemTools } from './tools/system.js';
import { registerAgentTools } from './tools/agents.js';
import { registerThreadTools } from './tools/threads.js';

const ASUITE_URL = process.env.ASUITE_URL || 'http://localhost:4000';
const ASUITE_TOKEN = process.env.ASUITE_TOKEN;

if (!ASUITE_TOKEN) {
  console.error('Error: ASUITE_TOKEN environment variable is required.');
  console.error('Get your token from the ASuite admin or run: curl -X POST http://localhost:4000/api/admin/tickets ...');
  process.exit(1);
}

const server = new McpServer({
  name: 'asuite',
  version: '0.1.0',
});

const gw = new GatewayClient(ASUITE_URL, ASUITE_TOKEN);

// Register all tool groups
registerMessageTools(server, gw);
registerDocTools(server, gw);
registerTaskTools(server, gw);
registerDataTools(server, gw);
registerSystemTools(server, gw);
registerAgentTools(server, gw);
registerThreadTools(server, gw);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
