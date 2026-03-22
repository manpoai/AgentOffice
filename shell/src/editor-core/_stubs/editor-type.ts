/**
 * Stub for ~/editor
 * Used by: lib/ExtensionManager.ts
 */
import type { EditorView } from "prosemirror-view";

export type Editor = {
  view: EditorView;
  props: {
    readOnly?: boolean;
    grow?: boolean;
    dictionary?: Record<string, string>;
    uploadFile?: (file: File) => Promise<string>;
    onClickLink?: (href: string, event: MouseEvent) => void;
    onShowToast?: (message: string) => void;
    embeds?: unknown[];
    extensions?: unknown[];
    [key: string]: unknown;
  };
};
