import { z } from 'zod';

const LayoutEnum = z.enum(['title', 'title-content', 'title-image', 'two-column', 'blank']);
const LayoutFields = {
  layout: LayoutEnum.optional().describe('Slide layout template'),
  title: z.string().optional().describe('Slide title text'),
  bullets: z.array(z.string()).optional().describe('Bullet points (title-content layout)'),
  left_content: z.string().optional().describe('Left column text (two-column layout)'),
  right_content: z.string().optional().describe('Right column text (two-column layout)'),
  image: z.string().optional().describe('Image URL (title-image layout)'),
  background: z.string().optional().describe('Background color hex, e.g. "#ffffff"'),
  notes: z.string().optional().describe('Speaker notes'),
};

function buildLayoutBody({ layout, title, bullets, left_content, right_content, image, background, notes }) {
  const body = {};
  if (layout) body.layout = layout;
  if (title) body.title = title;
  if (bullets) body.bullets = bullets;
  if (left_content) body.left_content = left_content;
  if (right_content) body.right_content = right_content;
  if (image) body.image = image;
  if (background) body.background = background;
  if (notes) body.notes = notes;
  return body;
}

export function registerPresentationTools(server, gw) {
  server.tool(
    'create_presentation',
    'Create a new presentation (slide deck). Returns the presentation_id.',
    { title: z.string().describe('Presentation title') },
    async ({ title }) => {
      const result = await gw.post('/presentations', { title });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_presentation',
    'Read a presentation and all its slides. Returns full data including slide IDs, elements, backgrounds, and notes.',
    { presentation_id: z.string().describe('Presentation ID') },
    async ({ presentation_id }) => {
      const result = await gw.get(`/presentations/${presentation_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'list_slides',
    'List all slides in a presentation with their slide_ids, element counts, and notes previews. Use this to get slide_ids before using slide-level tools.',
    { presentation_id: z.string().describe('Presentation ID') },
    async ({ presentation_id }) => {
      const result = await gw.get(`/presentations/${presentation_id}/slides`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'read_slide',
    'Read a single slide by its stable slide_id. Returns all elements, background, and notes.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id: z.string().describe('Slide ID (from list_slides)'),
    },
    async ({ presentation_id, slide_id }) => {
      const result = await gw.get(`/presentations/${presentation_id}/slides/by-id/${slide_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'add_slide',
    'Add a new slide to a presentation using a layout template. Available layouts: "title", "title-content", "title-image", "two-column", "blank".',
    {
      presentation_id: z.string().describe('Presentation ID'),
      ...LayoutFields,
    },
    async ({ presentation_id, ...opts }) => {
      const result = await gw.post(`/presentations/${presentation_id}/slides`, buildLayoutBody(opts));
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_slide',
    'Update a slide by stable slide_id. Applies a layout template (replaces content) or patches specific fields. Other slides are untouched.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id: z.string().describe('Slide ID (from list_slides)'),
      ...LayoutFields,
    },
    async ({ presentation_id, slide_id, ...opts }) => {
      const result = await gw.patch(`/presentations/${presentation_id}/slides/by-id/${slide_id}`, buildLayoutBody(opts));
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'delete_slide',
    'Delete a slide by stable slide_id. Other slides are untouched.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id: z.string().describe('Slide ID to delete (from list_slides)'),
    },
    async ({ presentation_id, slide_id }) => {
      const result = await gw.del(`/presentations/${presentation_id}/slides/by-id/${slide_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'reorder_slides',
    'Reorder slides by specifying slide IDs in the new order. Slides not mentioned are appended at the end unchanged.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id_order: z.array(z.string()).describe('Slide IDs in the desired order (from list_slides)'),
    },
    async ({ presentation_id, slide_id_order }) => {
      const result = await gw.put(`/presentations/${presentation_id}/slides/reorder`, { slide_id_order });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_slide_element',
    'Update a specific element on a slide by index. Use read_slide to see current elements and their indices.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id: z.string().describe('Slide ID (from list_slides)'),
      element_index: z.number().int().min(0).describe('Zero-based element index (from read_slide)'),
      text: z.string().optional().describe('New text content'),
      left: z.number().optional().describe('X position in pixels'),
      top: z.number().optional().describe('Y position in pixels'),
      width: z.number().optional().describe('Width in pixels'),
      height: z.number().optional().describe('Height in pixels'),
      fill: z.string().optional().describe('Text/fill color hex'),
      fontSize: z.number().optional().describe('Font size'),
      fontWeight: z.string().optional().describe('"normal" or "bold"'),
    },
    async ({ presentation_id, slide_id, element_index, ...patch }) => {
      const result = await gw.patch(
        `/presentations/${presentation_id}/slides/by-id/${slide_id}/elements/${element_index}`,
        patch
      );
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'insert_slide_element',
    'Insert a new element onto a slide. Elements are Fabric.js objects: textbox, image, rect, circle, triangle, or line.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id: z.string().describe('Slide ID (from list_slides)'),
      after_index: z.number().int().min(0).optional().describe('Insert after this element index (omit to append)'),
      type: z.enum(['textbox', 'image', 'rect', 'circle', 'triangle', 'line']).describe('Element type'),
      text: z.string().optional().describe('Text content (for textbox)'),
      left: z.number().optional().default(100).describe('X position in pixels'),
      top: z.number().optional().default(100).describe('Y position in pixels'),
      width: z.number().optional().default(200).describe('Width in pixels'),
      height: z.number().optional().default(60).describe('Height in pixels'),
      fill: z.string().optional().describe('Fill/text color hex'),
      src: z.string().optional().describe('Image URL (for image type)'),
    },
    async ({ presentation_id, slide_id, after_index, ...element }) => {
      const body = { ...element };
      if (after_index !== undefined) body.after_index = after_index;
      const result = await gw.post(
        `/presentations/${presentation_id}/slides/by-id/${slide_id}/elements`,
        body
      );
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'delete_slide_element',
    'Delete an element from a slide by its index. Other elements shift left.',
    {
      presentation_id: z.string().describe('Presentation ID'),
      slide_id: z.string().describe('Slide ID (from list_slides)'),
      element_index: z.number().int().min(0).describe('Zero-based element index to delete'),
    },
    async ({ presentation_id, slide_id, element_index }) => {
      const result = await gw.del(
        `/presentations/${presentation_id}/slides/by-id/${slide_id}/elements/${element_index}`
      );
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
