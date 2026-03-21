import { z } from 'zod';

export function registerThreadTools(server, gw) {
  server.tool(
    'link_to_thread',
    'Link a document, task, or data row to a Mattermost thread. Creates cross-system context so agents can find related resources.',
    {
      thread_id: z.string().describe('Mattermost thread root post ID'),
      link_type: z.enum(['doc', 'task', 'data_row']).describe('Type of resource to link'),
      link_id: z.string().describe('Resource ID (doc_id, task_id, or "table_id:row_id")'),
      link_title: z.string().optional().describe('Human-readable title for the link'),
    },
    async ({ thread_id, link_type, link_id, link_title }) => {
      const result = await gw.post(`/api/threads/${thread_id}/links`, { link_type, link_id, link_title });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_thread_context',
    'Get full context of a Mattermost thread: messages + linked docs/tasks/data. Use this to understand the full picture of a discussion.',
    {
      thread_id: z.string().describe('Mattermost thread root post ID'),
    },
    async ({ thread_id }) => {
      const result = await gw.get(`/api/threads/${thread_id}/context`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'unlink_from_thread',
    'Remove a resource link from a thread. Only the agent that created the link can remove it.',
    {
      thread_id: z.string().describe('Mattermost thread root post ID'),
      link_id: z.string().describe('Link ID to remove (from link_to_thread response)'),
    },
    async ({ thread_id, link_id }) => {
      const result = await gw.del(`/api/threads/${thread_id}/links/${link_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_unread_events',
    'Check how many undelivered events are waiting. Use this after reconnecting to decide whether to fetch catchup events.',
    {
      since: z.number().optional().default(0).describe('Only count events after this timestamp (default: all unread)'),
    },
    async ({ since }) => {
      const result = await gw.get(`/api/me/events/count?since=${since}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'catchup_events',
    'Fetch missed events since last connection. Use after get_unread_events shows pending events.',
    {
      since: z.number().optional().default(0).describe('Fetch events after this timestamp'),
      cursor: z.string().optional().describe('Pagination cursor from previous catchup response'),
      limit: z.number().optional().default(50).describe('Max events to return (default 50)'),
    },
    async ({ since, cursor, limit }) => {
      const params = new URLSearchParams({ since: String(since), limit: String(limit) });
      if (cursor) params.set('cursor', cursor);
      const result = await gw.get(`/api/me/catchup?${params}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'ack_events',
    'Acknowledge events up to a timestamp cursor. Marks them as delivered so they won\'t appear in future catchup calls.',
    {
      cursor: z.string().describe('Timestamp cursor — all events up to this time will be marked delivered'),
    },
    async ({ cursor }) => {
      const result = await gw.post('/api/me/events/ack', { cursor });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
