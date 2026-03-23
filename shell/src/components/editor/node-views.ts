/**
 * Custom ProseMirror NodeViews for rendering:
 * - math_block: KaTeX rendered LaTeX
 */
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

/**
 * Math block NodeView — renders LaTeX via KaTeX.
 * The math_block node is atom:true, so ProseMirror does not manage its content directly.
 */
class MathBlockView implements NodeView {
  dom: HTMLElement;

  constructor(private node: PMNode, private view: EditorView, private getPos: () => number | undefined) {
    this.dom = document.createElement('div');
    this.dom.className = 'math-block';
    this.renderKatex();
  }

  private async renderKatex() {
    const tex = this.node.textContent.trim();
    if (!tex) {
      this.dom.innerHTML = '<span style="color: hsl(0 0% 60%); font-style: italic;">Empty math block</span>';
      return;
    }

    try {
      const katex = (await import('katex')).default;
      this.dom.innerHTML = katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      // Fallback: show raw source in a code element
      this.dom.textContent = '';
      const code = document.createElement('code');
      code.textContent = tex;
      this.dom.appendChild(code);
    }
  }

  update(node: PMNode) {
    if (node.type.name !== 'math_block') return false;
    this.node = node;
    this.renderKatex();
    return true;
  }

  stopEvent() { return true; }
  ignoreMutation() { return true; }
}

/**
 * Factory function to create nodeViews map for ProseMirror EditorView.
 */
export function createNodeViews() {
  return {
    math_block: (node: PMNode, view: EditorView, getPos: () => number | undefined) =>
      new MathBlockView(node, view, getPos),
  };
}
