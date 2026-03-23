/**
 * Keyboard shortcuts for the editor.
 */
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn, chainCommands, exitCode, joinUp, joinDown, lift, selectParentNode } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import type { EditorState, Transaction } from 'prosemirror-state';
import { schema } from './schema';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/**
 * Smart Enter for list items: if the current list item is empty, lift it out
 * (outdent). Otherwise split normally. Works for both list_item and checkbox_item.
 */
function smartListEnter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { $from } = state.selection;
  // Check if we're in a list_item or checkbox_item
  const listItem = $from.node(-1);
  if (!listItem) return false;

  const isListItem = listItem.type === schema.nodes.list_item;
  const isCheckboxItem = listItem.type === schema.nodes.checkbox_item;
  if (!isListItem && !isCheckboxItem) return false;

  const nodeType = listItem.type;

  // Check if the list item content is empty (just an empty paragraph)
  if (listItem.childCount === 1 && listItem.firstChild!.type === schema.nodes.paragraph && listItem.firstChild!.content.size === 0) {
    // If we're nested (depth > 1 list), lift out one level
    return liftListItem(nodeType)(state, dispatch);
  }

  // Otherwise, split normally
  return splitListItem(nodeType)(state, dispatch);
}

/**
 * Smart Tab for list items: works for both list_item and checkbox_item.
 */
function smartListSink(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { $from } = state.selection;
  const listItem = $from.node(-1);
  if (!listItem) return false;

  if (listItem.type === schema.nodes.list_item) return sinkListItem(schema.nodes.list_item)(state, dispatch);
  if (listItem.type === schema.nodes.checkbox_item) return sinkListItem(schema.nodes.checkbox_item)(state, dispatch);
  return false;
}

/**
 * Smart Shift-Tab for list items: works for both list_item and checkbox_item.
 */
function smartListLift(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { $from } = state.selection;
  const listItem = $from.node(-1);
  if (!listItem) return false;

  if (listItem.type === schema.nodes.list_item) return liftListItem(schema.nodes.list_item)(state, dispatch);
  if (listItem.type === schema.nodes.checkbox_item) return liftListItem(schema.nodes.checkbox_item)(state, dispatch);
  return false;
}

export function buildKeymap() {
  const keys: Record<string, any> = {};

  // History
  keys['Mod-z'] = undo;
  keys['Mod-Shift-z'] = redo;
  if (!isMac) keys['Mod-y'] = redo;

  // Marks
  keys['Mod-b'] = toggleMark(schema.marks.strong);
  keys['Mod-i'] = toggleMark(schema.marks.em);
  keys['Mod-u'] = toggleMark(schema.marks.underline);
  keys['Mod-Shift-s'] = toggleMark(schema.marks.strikethrough);
  keys['Mod-e'] = toggleMark(schema.marks.code);
  keys['Mod-Shift-h'] = toggleMark(schema.marks.highlight);

  // Block types
  keys['Mod-Shift-0'] = setBlockType(schema.nodes.paragraph);
  keys['Mod-Shift-1'] = setBlockType(schema.nodes.heading, { level: 1 });
  keys['Mod-Shift-2'] = setBlockType(schema.nodes.heading, { level: 2 });
  keys['Mod-Shift-3'] = setBlockType(schema.nodes.heading, { level: 3 });

  // Lists — smart handlers for both list_item and checkbox_item
  keys['Enter'] = smartListEnter;
  keys['Tab'] = smartListSink;
  keys['Shift-Tab'] = smartListLift;
  keys['Mod-Shift-7'] = wrapIn(schema.nodes.ordered_list);
  keys['Mod-Shift-8'] = wrapIn(schema.nodes.bullet_list);

  // Blockquote
  keys['Mod-Shift-9'] = wrapIn(schema.nodes.blockquote);

  // Code block
  keys['Mod-Shift-\\'] = setBlockType(schema.nodes.code_block);

  // Exit code block with Enter
  keys['Shift-Enter'] = chainCommands(exitCode, (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
    }
    return true;
  });

  // Structural
  keys['Alt-ArrowUp'] = joinUp;
  keys['Alt-ArrowDown'] = joinDown;
  keys['Mod-BracketLeft'] = lift;
  keys['Escape'] = selectParentNode;

  return keymap(keys);
}

export function buildBaseKeymap() {
  return keymap(baseKeymap);
}
