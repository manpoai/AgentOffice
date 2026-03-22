/**
 * Stub for @shared/editor/types
 * Used by: commands/link.ts, queries/getMarkRange.ts
 */
import type { Mark } from "prosemirror-model";

export type NodeAttrMark = Mark & {
  attrs: Record<string, unknown>;
};
