'use client';

import { useEffect, useRef } from 'react';

interface RevisionPreviewProps {
  /** ProseMirror JSON data for the selected revision */
  data: Record<string, unknown>;
  /** ProseMirror JSON data for the previous revision (for diff) */
  prevData?: Record<string, unknown>;
  /** Whether to highlight changes */
  highlightChanges: boolean;
}

/**
 * Renders a ProseMirror document from JSON in a read-only EditorView.
 * When highlightChanges is true and prevData is provided, highlights
 * text differences between the two versions.
 */
export default function RevisionPreview({ data, prevData, highlightChanges }: RevisionPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let destroyed = false;

    (async () => {
      const [
        { EditorState },
        { EditorView },
        { Decoration, DecorationSet },
        { Plugin: PMPlugin },
        { schema },
        { createNodeViews },
      ] = await Promise.all([
        import('prosemirror-state'),
        import('prosemirror-view'),
        import('prosemirror-view'),
        import('prosemirror-state'),
        import('./editor/schema'),
        import('./editor/node-views'),
      ]);

      if (destroyed) return;

      // Import Node from prosemirror-model
      const { Node } = await import('prosemirror-model');

      let doc: any;
      try {
        doc = Node.fromJSON(schema, data);
      } catch (e) {
        console.error('Failed to parse revision JSON:', e);
        if (mountRef.current) {
          mountRef.current.textContent = 'Failed to render this version';
        }
        return;
      }

      // Build diff decorations if needed
      let diffPlugin: any = null;
      if (highlightChanges && prevData) {
        try {
          const decorations = await computeDiffDecorations(Node, schema, data, prevData, doc);
          diffPlugin = new PMPlugin({
            props: {
              decorations() { return decorations; },
            },
          });
        } catch (e) {
          console.error('Diff computation failed:', e);
        }
      }

      const plugins = diffPlugin ? [diffPlugin] : [];
      const state = EditorState.create({ doc, plugins });

      if (destroyed || !mountRef.current) return;

      // Clear any existing content
      mountRef.current.innerHTML = '';

      const view = new EditorView(mountRef.current, {
        state,
        editable: () => false,
        nodeViews: createNodeViews(),
        attributes: {
          class: 'outline-editor-content',
        },
      });

      viewRef.current = view;
    })();

    return () => {
      destroyed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [data, prevData, highlightChanges]);

  return (
    <div className="outline-editor">
      <div ref={mountRef} className="outline-editor-mount" />
    </div>
  );
}

/**
 * Compute diff decorations between two ProseMirror JSON documents.
 * Uses diff-match-patch on extracted text, then maps character positions
 * back to ProseMirror positions in the target document.
 */
async function computeDiffDecorations(
  Node: any,
  schema: any,
  currentData: Record<string, unknown>,
  prevData: Record<string, unknown>,
  currentDoc: any,
): Promise<any> {
  const { Decoration, DecorationSet } = await import('prosemirror-view');
  const DiffMatchPatch = (await import('diff-match-patch')).default;

  // Extract plain text with position mapping from the current doc
  const { text: currentText, posMap } = extractTextWithPositions(currentDoc);

  // Parse prev doc and extract text
  let prevDoc: any;
  try {
    prevDoc = Node.fromJSON(schema, prevData);
  } catch {
    return DecorationSet.empty;
  }
  const { text: prevText } = extractTextWithPositions(prevDoc);

  // Compute diff
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(prevText, currentText);
  dmp.diff_cleanupSemantic(diffs);

  // Map diff ranges to ProseMirror positions in the current doc
  const decos: any[] = [];
  let currentCharIdx = 0;

  for (const [op, text] of diffs) {
    if (op === 0) {
      // Equal — advance position
      currentCharIdx += text.length;
    } else if (op === 1) {
      // Insertion in current — highlight in current doc
      const startCharIdx = currentCharIdx;
      const endCharIdx = currentCharIdx + text.length;

      // Map character indices to ProseMirror positions
      const from = charIdxToPos(startCharIdx, posMap);
      const to = charIdxToPos(endCharIdx, posMap);

      if (from !== null && to !== null && from < to) {
        decos.push(Decoration.inline(from, to, { class: 'revision-diff-added' }));
      }

      currentCharIdx += text.length;
    }
    // op === -1: deletion — skip (not in current text)
  }

  return DecorationSet.create(currentDoc, decos);
}

interface PosMapEntry {
  charIdx: number;
  pmPos: number;
}

function extractTextWithPositions(doc: any): { text: string; posMap: PosMapEntry[] } {
  const parts: string[] = [];
  const posMap: PosMapEntry[] = [];
  let charIdx = 0;

  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      posMap.push({ charIdx, pmPos: pos });
      parts.push(node.text!);
      charIdx += node.text!.length;
    } else if (node.isBlock && parts.length > 0 && !parts[parts.length - 1].endsWith('\n')) {
      parts.push('\n');
      charIdx += 1;
    }
  });

  return { text: parts.join(''), posMap };
}

function charIdxToPos(targetCharIdx: number, posMap: PosMapEntry[]): number | null {
  if (posMap.length === 0) return null;

  // Find the posMap entry that contains this character index
  for (let i = posMap.length - 1; i >= 0; i--) {
    if (posMap[i].charIdx <= targetCharIdx) {
      const offset = targetCharIdx - posMap[i].charIdx;
      return posMap[i].pmPos + offset;
    }
  }

  return posMap[0]?.pmPos || null;
}
