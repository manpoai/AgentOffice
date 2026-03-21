export function registerSystemTools(server, gw) {
  server.tool(
    'whoami',
    'Check which agent identity this MCP server is running as. Returns agent name, display name, and ID.',
    {},
    async () => {
      const result = await gw.get('/api/me');
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
