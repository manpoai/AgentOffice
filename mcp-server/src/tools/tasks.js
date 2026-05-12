import { z } from 'zod';

export function registerTaskTools(server, gw) {
  server.tool(
    'list_tasks',
    'List tasks with optional filters. Returns task summaries (no description body).',
    {
      status: z.enum(['todo', 'in_progress', 'done', 'failed', 'cancelled']).optional().describe('Filter by status. Preferred values: todo, in_progress, done'),
      assignee_id: z.string().optional().describe('Filter by assignee agent ID'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Filter by priority'),
      limit: z.number().optional().default(25).describe('Max results (default 25)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
    },
    async ({ status, assignee_id, priority, limit, offset }) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (assignee_id) params.set('assignee_id', assignee_id);
      if (priority) params.set('priority', priority);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const result = await gw.get(`/tasks?${params}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_task',
    'Get a single task by ID, including its attachments (linked skills, memories, and content items).',
    {
      task_id: z.string().describe('Task ID'),
    },
    async ({ task_id }) => {
      const result = await gw.get(`/tasks/${task_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_task',
    'Create a new task. Optionally assign to an agent.',
    {
      title: z.string().describe('Task title'),
      text: z.string().optional().describe('Task description (markdown)'),
      status: z.enum(['todo', 'in_progress', 'done', 'failed', 'cancelled']).optional().describe('Initial status (default: todo)'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority (default: medium)'),
      assignee_id: z.string().optional().describe('Agent ID to assign the task to'),
      due_at: z.number().optional().describe('Due date as Unix timestamp (ms)'),
      parent_task_id: z.string().optional().describe('Parent task ID for subtasks'),
    },
    async ({ title, text, status, priority, assignee_id, due_at, parent_task_id }) => {
      const body = { title };
      if (text) body.text = text;
      if (status) body.status = status;
      if (priority) body.priority = priority;
      if (assignee_id) body.assignee_id = assignee_id;
      if (due_at) body.due_at = due_at;
      if (parent_task_id) body.parent_task_id = parent_task_id;
      const result = await gw.post('/tasks', body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_task',
    'Update a task\'s title, status, priority, assignee, or description.',
    {
      task_id: z.string().describe('Task ID to update'),
      title: z.string().optional().describe('New title'),
      text: z.string().optional().describe('New description (markdown)'),
      status: z.enum(['todo', 'in_progress', 'done', 'failed', 'cancelled']).optional().describe('New status. Preferred values: todo, in_progress, done'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('New priority'),
      assignee_id: z.string().optional().describe('New assignee agent ID'),
      due_at: z.number().optional().describe('New due date (ms timestamp)'),
    },
    async ({ task_id, ...updates }) => {
      const body = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) body[k] = v;
      }
      const result = await gw.patch(`/tasks/${task_id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'add_task_attachment',
    'Attach a skill, memory, or content item to a task.',
    {
      task_id: z.string().describe('Task ID'),
      attachment_type: z.enum(['content', 'skill', 'memory']).describe('Type of attachment'),
      attachment_id: z.string().describe('ID of the item to attach'),
    },
    async ({ task_id, attachment_type, attachment_id }) => {
      const result = await gw.post(`/tasks/${task_id}/attachments`, { attachment_type, attachment_id });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_task_status',
    'Update only the status of a task. Shortcut for status-only changes.',
    {
      task_id: z.string().describe('Task ID'),
      status: z.enum(['todo', 'in_progress', 'done', 'failed', 'cancelled']).describe('New status'),
    },
    async ({ task_id, status }) => {
      const result = await gw.patch(`/tasks/${task_id}/status`, { status });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'comment_on_task',
    'Add a comment to a task. Notifies the assignee.',
    {
      task_id: z.string().describe('Task ID'),
      text: z.string().describe('Comment text'),
    },
    async ({ task_id, text }) => {
      const result = await gw.post(`/tasks/${task_id}/comments`, { text });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
