import { z } from 'zod';

const KeyframeSchema = z.object({
  t: z.number().describe('Time in element-local seconds (0 = element start)'),
  value: z.number().describe('Property value at this keyframe'),
  easing: z.enum(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']).optional().describe('Easing into this keyframe (default: ease)'),
});

const KeyframesMapSchema = z.record(
  z.enum(['x', 'y', 'w', 'h', 'opacity', 'scale', 'rotation', 'fillColor', 'strokeColor', 'textColor', 'fontSize']),
  z.array(KeyframeSchema),
).optional().describe('Per-property keyframe lists. Keys are property names, values are sorted keyframe arrays. The t=0 value comes from the element\'s static fields — only keyframes at t>0 go here.');

const VideoElementSchema = z.object({
  html: z.string().describe('HTML content for the element (inline styles, Shadow DOM isolated)'),
  x: z.number().describe('X position in px'),
  y: z.number().describe('Y position in px'),
  w: z.number().describe('Width in px'),
  h: z.number().describe('Height in px'),
  start: z.number().describe('Global time (seconds) when element appears'),
  duration: z.number().describe('How long element is visible (seconds)'),
  type: z.string().optional().describe('Element type: "shape", "text", "image", "svg" (default: "shape")'),
  name: z.string().optional().describe('Display name in timeline'),
  z_index: z.number().optional().describe('Stacking order (higher = on top)'),
  opacity: z.number().optional().describe('Static opacity 0–1 (default 1)'),
  scale: z.number().optional().describe('Static scale (default 1)'),
  fillColor: z.number().optional().describe('Static fill color as packed RGB integer (0xRRGGBB)'),
  strokeColor: z.number().optional().describe('Static stroke color as packed RGB integer'),
  textColor: z.number().optional().describe('Static text color as packed RGB integer'),
  fontSize: z.number().optional().describe('Static font size in px'),
  keyframes: KeyframesMapSchema,
  markers: z.array(z.number()).optional().describe('User-declared time anchors in element-local seconds'),
});

function materializeVideoElement(spec, existingElements) {
  return {
    id: crypto.randomUUID(),
    type: spec.type || 'shape',
    name: spec.name || 'Element',
    html: spec.html,
    x: spec.x, y: spec.y, w: spec.w, h: spec.h,
    start: spec.start, duration: spec.duration,
    z_index: spec.z_index ?? (existingElements.length > 0
      ? Math.max(...existingElements.map(e => e.z_index ?? 0)) + 1
      : 0),
    opacity: spec.opacity,
    scale: spec.scale,
    fillColor: spec.fillColor,
    strokeColor: spec.strokeColor,
    textColor: spec.textColor,
    fontSize: spec.fontSize,
    keyframes: spec.keyframes || {},
    markers: spec.markers || [],
  };
}

export function registerVideoTools(server, gw) {
  server.tool(
    'create_video',
    'Create a new video project. Returns the video_id. A video starts empty — add elements to build the timeline.',
    {
      title: z.string().describe('Video title'),
      parent_id: z.string().optional().describe('Parent content item ID to nest under (omit for root level)'),
      width: z.number().optional().describe('Video width in px (default 1920)'),
      height: z.number().optional().describe('Video height in px (default 1080)'),
      fps: z.number().optional().describe('Frames per second (default 30)'),
      background_color: z.string().optional().describe('Background color as hex string e.g. "#000000"'),
    },
    async ({ title, parent_id, width, height, fps, background_color }) => {
      const body = { title };
      if (parent_id) body.parent_id = parent_id;
      if (width) body.width = width;
      if (height) body.height = height;
      const result = await gw.post('/videos', body);
      if (fps || background_color) {
        const res = await gw.get(`/videos/${result.video_id}`);
        const data = res.data;
        if (fps) data.settings.fps = fps;
        if (background_color) data.settings.background_color = background_color;
        await gw.patch(`/videos/${result.video_id}`, { data });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_video',
    'Read a video project. Returns settings (width, height, fps, background_color) and all elements with their timeline properties and keyframes.',
    { video_id: z.string().describe('Video ID (without video: prefix)') },
    async ({ video_id }) => {
      const result = await gw.get(`/videos/${video_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'insert_video_element',
    'Insert a single element into a video timeline. The element appears at `start` seconds and lasts `duration` seconds. For adding many elements at once, prefer batch_insert_video_elements.',
    {
      video_id: z.string().describe('Video ID'),
      html: z.string().describe('HTML content for the element'),
      x: z.number().describe('X position in px'),
      y: z.number().describe('Y position in px'),
      w: z.number().describe('Width in px'),
      h: z.number().describe('Height in px'),
      start: z.number().describe('Global time (seconds) when element appears'),
      duration: z.number().describe('How long element is visible (seconds)'),
      type: z.string().optional().describe('Element type: "shape", "text", "image", "svg"'),
      name: z.string().optional().describe('Display name in timeline'),
      z_index: z.number().optional().describe('Stacking order'),
      opacity: z.number().optional().describe('Static opacity 0–1'),
      scale: z.number().optional().describe('Static scale'),
      keyframes: KeyframesMapSchema,
    },
    async ({ video_id, ...spec }) => {
      const res = await gw.get(`/videos/${video_id}`);
      const data = res.data;
      const el = materializeVideoElement(spec, data.elements);
      data.elements.push(el);
      await gw.patch(`/videos/${video_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ element_id: el.id }) }] };
    }
  );

  server.tool(
    'batch_insert_video_elements',
    'Insert multiple elements into a video timeline in one call. This is the preferred way to populate a video — design all elements and their animations together, then insert them all at once.',
    {
      video_id: z.string().describe('Video ID'),
      elements: z.array(VideoElementSchema).describe('Array of elements to insert'),
    },
    async ({ video_id, elements }) => {
      const res = await gw.get(`/videos/${video_id}`);
      const data = res.data;
      const ids = [];
      for (const spec of elements) {
        const el = materializeVideoElement(spec, data.elements);
        data.elements.push(el);
        ids.push(el.id);
      }
      await gw.patch(`/videos/${video_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ inserted: ids.length, element_ids: ids }) }] };
    }
  );

  server.tool(
    'update_video_element',
    'Update properties of an existing video element. Only provided fields are changed. Use this for tweaking individual elements — position, timing, HTML content, or animation keyframes.',
    {
      video_id: z.string().describe('Video ID'),
      element_id: z.string().describe('Element ID to update'),
      html: z.string().optional().describe('New HTML content'),
      x: z.number().optional().describe('New X position'),
      y: z.number().optional().describe('New Y position'),
      w: z.number().optional().describe('New width'),
      h: z.number().optional().describe('New height'),
      start: z.number().optional().describe('New start time (seconds)'),
      duration: z.number().optional().describe('New duration (seconds)'),
      name: z.string().optional().describe('New display name'),
      z_index: z.number().optional().describe('New stacking order'),
      opacity: z.number().optional().describe('New static opacity'),
      scale: z.number().optional().describe('New static scale'),
      fillColor: z.number().optional().describe('New fill color (packed RGB)'),
      strokeColor: z.number().optional().describe('New stroke color (packed RGB)'),
      textColor: z.number().optional().describe('New text color (packed RGB)'),
      fontSize: z.number().optional().describe('New font size in px'),
      keyframes: KeyframesMapSchema,
      markers: z.array(z.number()).optional().describe('New markers array'),
    },
    async ({ video_id, element_id, ...updates }) => {
      const res = await gw.get(`/videos/${video_id}`);
      const data = res.data;
      const el = data.elements.find(e => e.id === element_id);
      if (!el) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Element not found' }) }] };
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) el[key] = val;
      }
      await gw.patch(`/videos/${video_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ updated: true, element_id }) }] };
    }
  );

  server.tool(
    'delete_video_element',
    'Delete an element from a video timeline.',
    {
      video_id: z.string().describe('Video ID'),
      element_id: z.string().describe('Element ID to delete'),
    },
    async ({ video_id, element_id }) => {
      const res = await gw.get(`/videos/${video_id}`);
      const data = res.data;
      const before = data.elements.length;
      data.elements = data.elements.filter(e => e.id !== element_id);
      if (data.elements.length === before) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Element not found' }) }] };
      }
      await gw.patch(`/videos/${video_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
    }
  );

  server.tool(
    'replace_video_elements',
    'Replace ALL elements in a video. Use this when redesigning the entire video composition. More efficient than deleting and re-inserting individually.',
    {
      video_id: z.string().describe('Video ID'),
      elements: z.array(VideoElementSchema).describe('New elements array. Replaces all existing elements.'),
    },
    async ({ video_id, elements }) => {
      const res = await gw.get(`/videos/${video_id}`);
      const data = res.data;
      const oldCount = data.elements.length;
      data.elements = [];
      const ids = [];
      for (const spec of elements) {
        const el = materializeVideoElement(spec, data.elements);
        data.elements.push(el);
        ids.push(el.id);
      }
      await gw.patch(`/videos/${video_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ replaced: true, old_count: oldCount, new_count: ids.length, element_ids: ids }) }] };
    }
  );

  server.tool(
    'update_video_settings',
    'Update video project settings (resolution, fps, background color).',
    {
      video_id: z.string().describe('Video ID'),
      width: z.number().optional().describe('New video width in px'),
      height: z.number().optional().describe('New video height in px'),
      fps: z.number().optional().describe('New frames per second'),
      background_color: z.string().optional().describe('New background color (hex string e.g. "#000000")'),
    },
    async ({ video_id, width, height, fps, background_color }) => {
      const res = await gw.get(`/videos/${video_id}`);
      const data = res.data;
      if (width !== undefined) data.settings.width = width;
      if (height !== undefined) data.settings.height = height;
      if (fps !== undefined) data.settings.fps = fps;
      if (background_color !== undefined) data.settings.background_color = background_color;
      await gw.patch(`/videos/${video_id}`, { data });
      return { content: [{ type: 'text', text: JSON.stringify({ updated: true, settings: data.settings }) }] };
    }
  );
}
