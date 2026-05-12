import { z } from 'zod';

export function registerMemoryTools(server, gw) {
  server.tool(
    'list_memories',
    'List memories, optionally filtered by agent or tag.',
    {
      agent_id: z.string().optional().describe('Filter by agent ID'),
      source: z.enum(['agent', 'human']).optional().describe('Filter by who created it'),
      tag: z.string().optional().describe('Filter by tag'),
      limit: z.number().optional().default(25).describe('Max results'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
    },
    async ({ agent_id, source, tag, limit, offset }) => {
      const params = new URLSearchParams();
      if (agent_id) params.set('agent_id', agent_id);
      if (source) params.set('source', source);
      if (tag) params.set('tag', tag);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const result = await gw.get(`/memories?${params}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_memory',
    'Read a single memory entry by ID.',
    {
      memory_id: z.string().describe('Memory ID'),
    },
    async ({ memory_id }) => {
      const result = await gw.get(`/memories/${memory_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_memory',
    'Create a new memory entry. Agents create source=agent memories; humans create source=human.',
    {
      title: z.string().describe('Memory title'),
      content: z.string().describe('Memory content'),
      agent_id: z.string().optional().describe('Agent this memory belongs to (defaults to caller)'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      related_task_id: z.string().optional().describe('Related task ID'),
    },
    async ({ title, content, agent_id, tags, related_task_id }) => {
      const body = { title, content };
      if (agent_id) body.agent_id = agent_id;
      if (tags) body.tags = tags;
      if (related_task_id) body.related_task_id = related_task_id;
      const result = await gw.post('/memories', body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_memory',
    'Update a memory\'s title, content, or tags.',
    {
      memory_id: z.string().describe('Memory ID'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content'),
      tags: z.array(z.string()).optional().describe('New tags (replaces all)'),
    },
    async ({ memory_id, title, content, tags }) => {
      const body = {};
      if (title) body.title = title;
      if (content) body.content = content;
      if (tags) body.tags = tags;
      const result = await gw.patch(`/memories/${memory_id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'delete_memory',
    'Delete a memory entry.',
    {
      memory_id: z.string().describe('Memory ID'),
    },
    async ({ memory_id }) => {
      const result = await gw.del(`/memories/${memory_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'search_memories',
    'Search memories by text query. Searches titles and content.',
    {
      query: z.string().describe('Search query'),
      agent_id: z.string().optional().describe('Filter by agent ID'),
      limit: z.number().optional().default(25).describe('Max results'),
    },
    async ({ query, agent_id, limit }) => {
      const params = new URLSearchParams({ q: query });
      if (agent_id) params.set('agent_id', agent_id);
      if (limit) params.set('limit', String(limit));
      const result = await gw.get(`/memories/search?${params}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
