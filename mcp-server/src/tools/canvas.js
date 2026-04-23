import { z } from 'zod';

export function registerCanvasTools(server, gw) {
  server.tool(
    'create_canvas',
    'Create a new canvas (free-form design surface). Returns the canvas_id. A canvas starts with one blank page.',
    {
      title: z.string().describe('Canvas title'),
      parent_id: z.string().optional().describe('Parent content item ID to nest under (omit for root level)'),
      width: z.number().optional().describe('First page width in px (default 1920)'),
      height: z.number().optional().describe('First page height in px (default 1080)'),
    },
    async ({ title, parent_id, width, height }) => {
      const body = { title };
      if (parent_id) body.parent_id = parent_id;
      if (width) body.width = width;
      if (height) body.height = height;
      const result = await gw.post('/canvases', body);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_canvas',
    'Read a canvas and all its pages/elements. Returns full data including page dimensions, element positions, and HTML content.',
    { canvas_id: z.string().describe('Canvas ID (without canvas: prefix)') },
    async ({ canvas_id }) => {
      const result = await gw.get(`/canvases/${canvas_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'add_page',
    'Add a new empty page to a canvas. New page inherits dimensions from the last page, or uses provided values.',
    {
      canvas_id: z.string().describe('Canvas ID'),
      title: z.string().optional().describe('Page title'),
      width: z.number().optional().describe('Page width in px'),
      height: z.number().optional().describe('Page height in px'),
    },
    async ({ canvas_id, title, width, height }) => {
      const res = await gw.get(`/canvases/${canvas_id}`);
      const data = res.data;
      const lastPage = data.pages[data.pages.length - 1];
      const newPage = {
        page_id: crypto.randomUUID(),
        title: title || `Page ${data.pages.length + 1}`,
        width: width || lastPage?.width || 1920,
        height: height || lastPage?.height || 1080,
        head_html: '',
        elements: [],
      };
      data.pages.push(newPage);
      await gw.patch(`/canvases/${canvas_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ page_id: newPage.page_id, page_index: data.pages.length - 1 }) }] };
    }
  );

  server.tool(
    'delete_page',
    'Delete a page from a canvas. Cannot delete the last remaining page.',
    {
      canvas_id: z.string().describe('Canvas ID'),
      page_id: z.string().describe('Page ID to delete'),
    },
    async ({ canvas_id, page_id }) => {
      const res = await gw.get(`/canvases/${canvas_id}`);
      const data = res.data;
      if (data.pages.length <= 1) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Cannot delete the last page' }) }] };
      }
      data.pages = data.pages.filter(p => p.page_id !== page_id);
      await gw.patch(`/canvases/${canvas_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, remaining_pages: data.pages.length }) }] };
    }
  );

  server.tool(
    'insert_element',
    'Insert a new HTML element onto a canvas page. The element is positioned absolutely at (x, y) with size (w, h). The html field accepts any valid HTML — use inline styles for styling (Shadow DOM isolates each element).',
    {
      canvas_id: z.string().describe('Canvas ID'),
      page_id: z.string().describe('Target page ID'),
      html: z.string().describe('HTML content for the element'),
      x: z.number().describe('X position in px from left edge'),
      y: z.number().describe('Y position in px from top edge'),
      w: z.number().describe('Width in px'),
      h: z.number().describe('Height in px'),
      z_index: z.number().optional().describe('Stacking order (higher = on top)'),
      locked: z.boolean().optional().describe('If true, element cannot be dragged/resized by human'),
    },
    async ({ canvas_id, page_id, html, x, y, w, h, z_index, locked }) => {
      const res = await gw.get(`/canvases/${canvas_id}`);
      const data = res.data;
      const page = data.pages.find(p => p.page_id === page_id);
      if (!page) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Page not found' }) }] };
      }
      const element = {
        id: crypto.randomUUID(),
        x, y, w, h, html,
        locked: locked ?? false,
        z_index: z_index ?? (page.elements.length > 0 ? Math.max(...page.elements.map(e => e.z_index ?? 0)) + 1 : 0),
      };
      page.elements.push(element);
      await gw.patch(`/canvases/${canvas_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ element_id: element.id, page_id }) }] };
    }
  );

  server.tool(
    'update_element',
    'Update properties of an existing canvas element. Only provided fields are changed.',
    {
      canvas_id: z.string().describe('Canvas ID'),
      page_id: z.string().describe('Page ID containing the element'),
      element_id: z.string().describe('Element ID to update'),
      html: z.string().optional().describe('New HTML content'),
      x: z.number().optional().describe('New X position'),
      y: z.number().optional().describe('New Y position'),
      w: z.number().optional().describe('New width'),
      h: z.number().optional().describe('New height'),
      z_index: z.number().optional().describe('New stacking order'),
      locked: z.boolean().optional().describe('Lock/unlock the element'),
    },
    async ({ canvas_id, page_id, element_id, html, x, y, w, h, z_index, locked }) => {
      const res = await gw.get(`/canvases/${canvas_id}`);
      const data = res.data;
      const page = data.pages.find(p => p.page_id === page_id);
      if (!page) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Page not found' }) }] };
      const el = page.elements.find(e => e.id === element_id);
      if (!el) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Element not found' }) }] };
      if (html !== undefined) el.html = html;
      if (x !== undefined) el.x = x;
      if (y !== undefined) el.y = y;
      if (w !== undefined) el.w = w;
      if (h !== undefined) el.h = h;
      if (z_index !== undefined) el.z_index = z_index;
      if (locked !== undefined) el.locked = locked;
      await gw.patch(`/canvases/${canvas_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ updated: true, element_id }) }] };
    }
  );

  server.tool(
    'delete_element',
    'Delete an element from a canvas page.',
    {
      canvas_id: z.string().describe('Canvas ID'),
      page_id: z.string().describe('Page ID containing the element'),
      element_id: z.string().describe('Element ID to delete'),
    },
    async ({ canvas_id, page_id, element_id }) => {
      const res = await gw.get(`/canvases/${canvas_id}`);
      const data = res.data;
      const page = data.pages.find(p => p.page_id === page_id);
      if (!page) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Page not found' }) }] };
      const before = page.elements.length;
      page.elements = page.elements.filter(e => e.id !== element_id);
      if (page.elements.length === before) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Element not found' }) }] };
      }
      await gw.patch(`/canvases/${canvas_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
    }
  );

  server.tool(
    'update_page',
    'Update canvas page properties (dimensions, title, head_html for shared styles).',
    {
      canvas_id: z.string().describe('Canvas ID'),
      page_id: z.string().describe('Page ID to update'),
      title: z.string().optional().describe('New page title'),
      width: z.number().optional().describe('New page width in px'),
      height: z.number().optional().describe('New page height in px'),
      head_html: z.string().optional().describe('Shared HTML/CSS injected into all elements on this page'),
    },
    async ({ canvas_id, page_id, title, width, height, head_html }) => {
      const res = await gw.get(`/canvases/${canvas_id}`);
      const data = res.data;
      const page = data.pages.find(p => p.page_id === page_id);
      if (!page) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Page not found' }) }] };
      if (title !== undefined) page.title = title;
      if (width !== undefined) page.width = width;
      if (height !== undefined) page.height = height;
      if (head_html !== undefined) page.head_html = head_html;
      await gw.patch(`/canvases/${canvas_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ updated: true, page_id }) }] };
    }
  );
}
