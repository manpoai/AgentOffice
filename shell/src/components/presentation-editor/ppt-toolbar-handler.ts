import type { ToolbarHandler, ToolbarState } from '@/components/shared/FloatingToolbar/types';

interface PPTTextTarget {
  obj: any;       // Fabric.js Textbox object
  canvas: any;    // Fabric.js Canvas
}

export function createPPTTextHandler(target: PPTTextTarget): ToolbarHandler {
  const { obj, canvas } = target;

  function refresh() {
    canvas.renderAll();
    canvas.fire('object:modified', { target: obj });
  }

  return {
    getState(): ToolbarState {
      return {
        fontFamily: obj.fontFamily || 'Inter, system-ui, sans-serif',
        fontSize: String(obj.fontSize || 24),
        bold: obj.fontWeight === 'bold',
        italic: obj.fontStyle === 'italic',
        underline: !!obj.underline,
        strikethrough: !!obj.linethrough,
        align: obj.textAlign || 'left',
        textColor: typeof obj.fill === 'string' ? obj.fill : '#1f2937',
      };
    },

    execute(key: string, value?: unknown) {
      switch (key) {
        case 'fontFamily': obj.set('fontFamily', value); refresh(); break;
        case 'fontSize': obj.set('fontSize', Math.max(1, Number(value))); refresh(); break;
        case 'bold': obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold'); refresh(); break;
        case 'italic': obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic'); refresh(); break;
        case 'underline': obj.set('underline', !obj.underline); refresh(); break;
        case 'strikethrough': obj.set('linethrough', !obj.linethrough); refresh(); break;
        case 'align': obj.set('textAlign', value); refresh(); break;
        case 'textColor': obj.set('fill', value); refresh(); break;
      }
    },
  };
}
