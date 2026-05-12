import { z } from 'zod';

export function registerSkillTools(server, gw) {
  server.tool(
    'list_skills',
    'List skills. Builtin skills are platform documentation; user skills are custom.',
    {
      source: z.enum(['builtin', 'user']).optional().describe('Filter by source type'),
      limit: z.number().optional().default(50).describe('Max results'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
    },
    async ({ source, limit, offset }) => {
      const params = new URLSearchParams();
      if (source) params.set('source', source);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const result = await gw.get(`/skills?${params}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_skill',
    'Read a skill\'s full content (markdown). Use this to learn how to perform a task.',
    {
      skill_id: z.string().describe('Skill ID'),
    },
    async ({ skill_id }) => {
      const result = await gw.get(`/skills/${skill_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_skill',
    'Create a new user skill with markdown content.',
    {
      title: z.string().describe('Skill title'),
      text: z.string().describe('Skill content in markdown'),
    },
    async ({ title, text }) => {
      const result = await gw.post('/skills', { title, text });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_skill',
    'Update a user skill\'s title or content. Cannot edit builtin skills.',
    {
      skill_id: z.string().describe('Skill ID'),
      title: z.string().optional().describe('New title'),
      text: z.string().optional().describe('New markdown content'),
    },
    async ({ skill_id, title, text }) => {
      const body = {};
      if (title) body.title = title;
      if (text) body.text = text;
      const result = await gw.patch(`/skills/${skill_id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
