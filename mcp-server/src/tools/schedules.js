import { z } from 'zod';

export function registerScheduleTools(server, gw) {
  server.tool(
    'list_schedules',
    'List all task schedules (recurring task configurations).',
    {},
    async () => {
      const result = await gw.get('/schedules');
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_schedule',
    'Create a task schedule with a cron expression. Use schedule_type to specify once/daily/weekly.',
    {
      title: z.string().describe('Schedule name'),
      cron: z.string().describe('Cron expression (e.g. "0 9 * * 1-5" for weekdays at 9am, "0 9 15 6 *" for once on June 15)'),
      schedule_type: z.enum(['once', 'daily', 'weekly']).describe('Schedule type: once (single run then auto-disable), daily, or weekly'),
      timezone: z.string().optional().default('UTC').describe('Timezone (default UTC)'),
      template_json: z.object({
        title: z.string().describe('Task title template'),
        text: z.string().optional().describe('Task description'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignee_id: z.string().optional().describe('Agent to assign created tasks to'),
      }).describe('Task template: fields for each auto-created task'),
      mode: z.enum(['create_task', 'silent_run']).optional().describe('create_task (default) or silent_run'),
    },
    async ({ title, cron, schedule_type, timezone, template_json, mode }) => {
      const body = { title, cron, schedule_type, template_json };
      if (timezone) body.timezone = timezone;
      if (mode) body.mode = mode;
      const result = await gw.post('/schedules', body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_schedule',
    'Update a schedule\'s cron, template, type, or enabled state.',
    {
      schedule_id: z.string().describe('Schedule ID'),
      title: z.string().optional().describe('New name'),
      cron: z.string().optional().describe('New cron expression'),
      schedule_type: z.enum(['once', 'daily', 'weekly']).optional().describe('New schedule type'),
      timezone: z.string().optional().describe('New timezone'),
      template_json: z.object({
        title: z.string().optional(),
        text: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignee_id: z.string().optional(),
      }).optional().describe('Updated task template'),
      enabled: z.boolean().optional().describe('Enable or disable the schedule'),
    },
    async ({ schedule_id, ...updates }) => {
      const body = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) body[k] = v;
      }
      const result = await gw.patch(`/schedules/${schedule_id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'delete_schedule',
    'Delete a task schedule.',
    {
      schedule_id: z.string().describe('Schedule ID'),
    },
    async ({ schedule_id }) => {
      const result = await gw.del(`/schedules/${schedule_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'trigger_schedule',
    'Manually trigger a schedule to create a task immediately, regardless of cron timing.',
    {
      schedule_id: z.string().describe('Schedule ID to trigger'),
    },
    async ({ schedule_id }) => {
      const result = await gw.post(`/schedules/${schedule_id}/trigger`, {});
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
