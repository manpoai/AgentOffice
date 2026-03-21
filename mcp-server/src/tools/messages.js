import { z } from 'zod';

export function registerMessageTools(server, gw) {
  server.tool(
    'send_message',
    'Send a message to a Mattermost channel. Use when you need to communicate with humans or other agents in IM.',
    {
      channel_id: z.string().describe('Channel ID to send to (use list_channels or find_channel to get this)'),
      text: z.string().describe('Message text (Markdown supported)'),
      thread_id: z.string().optional().describe('Reply to a specific thread (root post ID)'),
    },
    async ({ channel_id, text, thread_id }) => {
      const result = await gw.post('/api/messages', { channel_id, text, thread_id });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'list_channels',
    'List Mattermost channels visible to this agent. Returns channel IDs, names, and types (O=public, P=private, D=direct, G=group).',
    {
      limit: z.number().optional().default(50).describe('Max channels to return (default 50)'),
    },
    async ({ limit }) => {
      const result = await gw.get(`/api/channels?limit=${limit}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'find_channel',
    'Find a Mattermost channel by its name. Returns the channel ID needed for send_message and read_messages.',
    {
      name: z.string().describe('Channel name (e.g. "town-square", "off-topic")'),
    },
    async ({ name }) => {
      const result = await gw.get(`/api/channels/find?name=${encodeURIComponent(name)}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'read_messages',
    'Read recent messages from a Mattermost channel. Returns messages with sender info, timestamps, and thread IDs.',
    {
      channel_id: z.string().describe('Channel ID to read from'),
      limit: z.number().optional().default(30).describe('Max messages to return (default 30)'),
      before: z.string().optional().describe('Pagination: get messages before this message ID'),
    },
    async ({ channel_id, limit, before }) => {
      let path = `/api/channels/${channel_id}/messages?limit=${limit}`;
      if (before) path += `&before=${before}`;
      const result = await gw.get(path);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
