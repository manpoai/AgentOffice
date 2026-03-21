import { z } from 'zod';

export function registerTaskTools(server, gw) {
  server.tool(
    'create_task',
    'Create a new task in Plane. Can assign to a specific agent or human.',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description'),
      assignee_name: z.string().optional().describe('Agent or user name to assign to (e.g. "zylos-thinker")'),
      priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().describe('Task priority'),
    },
    async ({ title, description, assignee_name, priority }) => {
      const body = { title };
      if (description) body.description = description;
      if (assignee_name) body.assignee_name = assignee_name;
      if (priority) body.priority = priority;
      const result = await gw.post('/api/tasks', body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_task_status',
    'Update the status of a Plane task.',
    {
      task_id: z.string().describe('Task ID to update'),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).describe('New status'),
    },
    async ({ task_id, status }) => {
      const result = await gw.patch(`/api/tasks/${task_id}/status`, { status });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'comment_on_task',
    'Add a comment to a Plane task.',
    {
      task_id: z.string().describe('Task ID to comment on'),
      text: z.string().describe('Comment text'),
    },
    async ({ task_id, text }) => {
      const result = await gw.post(`/api/tasks/${task_id}/comments`, { text });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'list_tasks',
    'List tasks from Plane. Can filter by status or assignee.',
    {
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional().describe('Filter by status'),
      assignee_name: z.string().optional().describe('Filter by assignee name'),
      limit: z.number().optional().default(25).describe('Max tasks to return (default 25)'),
    },
    async ({ status, assignee_name, limit }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.set('status', status);
      if (assignee_name) params.set('assignee_name', assignee_name);
      const result = await gw.get(`/api/tasks?${params}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'read_task',
    'Read a single task with full details from Plane.',
    {
      task_id: z.string().describe('Task ID to read'),
    },
    async ({ task_id }) => {
      const result = await gw.get(`/api/tasks/${task_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
