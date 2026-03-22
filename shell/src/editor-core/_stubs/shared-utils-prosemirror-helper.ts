/**
 * Stub for @shared/utils/ProsemirrorHelper
 * Used by: plugins/AnchorPlugin.ts
 */
import type { Node as ProsemirrorNode } from "prosemirror-model";

export type NodeAnchor = {
  id: string;
  pos: number;
  className: string;
};

export class ProsemirrorHelper {
  /**
   * Get all anchor points from the document (headings with ids).
   */
  static getAnchors(doc: ProsemirrorNode): NodeAnchor[] {
    const anchors: NodeAnchor[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.attrs.id) {
        anchors.push({
          id: node.attrs.id,
          pos,
          className: "heading-anchor",
        });
      }
    });
    return anchors;
  }
}
