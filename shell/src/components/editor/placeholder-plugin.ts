/**
 * Placeholder plugin for ProseMirror.
 * Shows placeholder text on empty paragraphs and a "+" block handle.
 * - When the document is completely empty: shows full placeholder on the first paragraph
 * - On any empty paragraph that has focus: shows a "+" handle on the left
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const placeholderKey = new PluginKey('placeholder');

export function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    key: placeholderKey,
    props: {
      decorations(state) {
        const { doc, selection } = state;
        const decorations: Decoration[] = [];

        // Check if entire document is empty (single empty paragraph)
        const isDocEmpty = doc.childCount === 1 &&
          doc.firstChild?.type.name === 'paragraph' &&
          doc.firstChild.content.size === 0;

        if (isDocEmpty) {
          // Show full placeholder on the first (empty) paragraph
          decorations.push(
            Decoration.node(0, doc.firstChild!.nodeSize, {
              class: 'is-empty-placeholder',
              'data-placeholder': text,
            })
          );
        }

        // Show "+" handle on the focused empty paragraph (if not the doc-empty placeholder)
        const { $from } = selection;
        const parentNode = $from.parent;
        if (parentNode.type.name === 'paragraph' && parentNode.content.size === 0 && !isDocEmpty) {
          const pos = $from.before($from.depth);
          const end = $from.after($from.depth);
          decorations.push(
            Decoration.node(pos, end, {
              class: 'is-empty-line',
            })
          );
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}
