/**
 * Slash command menu plugin for ProseMirror.
 * Typing "/" at the start of a line opens a popup with block type options.
 * Aligned with Outline's block menu items.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { schema } from './schema';
import { setBlockType, wrapIn } from 'prosemirror-commands';

export const slashMenuKey = new PluginKey('slashMenu');

interface SlashMenuItem {
  label: string;
  description: string;
  icon: string;
  keywords?: string;
  command: (view: EditorView) => void;
}

const SLASH_ITEMS: SlashMenuItem[] = [
  {
    label: '标题 1', description: '大标题', icon: 'H1', keywords: 'heading h1',
    command: (view) => { setBlockType(schema.nodes.heading, { level: 1 })(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '标题 2', description: '中标题', icon: 'H2', keywords: 'heading h2',
    command: (view) => { setBlockType(schema.nodes.heading, { level: 2 })(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '标题 3', description: '小标题', icon: 'H3', keywords: 'heading h3',
    command: (view) => { setBlockType(schema.nodes.heading, { level: 3 })(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '无序列表', description: '项目符号列表', icon: '•', keywords: 'bullet list ul',
    command: (view) => { wrapIn(schema.nodes.bullet_list)(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '有序列表', description: '编号列表', icon: '1.', keywords: 'ordered list ol number',
    command: (view) => { wrapIn(schema.nodes.ordered_list)(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '待办列表', description: '任务清单', icon: '☑', keywords: 'todo task checkbox checklist',
    command: (view) => { wrapIn(schema.nodes.checkbox_list)(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '引用', description: '块引用', icon: '❝', keywords: 'quote blockquote',
    command: (view) => { wrapIn(schema.nodes.blockquote)(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '代码块', description: '代码片段', icon: '</>', keywords: 'code block pre',
    command: (view) => { setBlockType(schema.nodes.code_block)(view.state, view.dispatch); view.focus(); },
  },
  {
    label: '分割线', description: '水平线', icon: '—', keywords: 'divider horizontal rule hr',
    command: (view) => {
      const { state, dispatch } = view;
      dispatch(state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView());
      view.focus();
    },
  },
  {
    label: '表格', description: '插入表格', icon: '⊞', keywords: 'table grid',
    command: (view) => {
      const { state, dispatch } = view;
      const cell = schema.nodes.table_cell.createAndFill()!;
      const header = schema.nodes.table_header.createAndFill()!;
      const headerRow = schema.nodes.table_row.create(null, [
        header, schema.nodes.table_header.createAndFill()!, schema.nodes.table_header.createAndFill()!,
      ]);
      const row = schema.nodes.table_row.create(null, [
        cell, schema.nodes.table_cell.createAndFill()!, schema.nodes.table_cell.createAndFill()!,
      ]);
      const table = schema.nodes.table.create(null, [headerRow, row]);
      dispatch(state.tr.replaceSelectionWith(table).scrollIntoView());
      view.focus();
    },
  },
  {
    label: '图片', description: '插入图片', icon: '🖼', keywords: 'image picture photo img',
    command: (view) => {
      const url = prompt('图片 URL:');
      if (!url) return;
      const { state, dispatch } = view;
      const node = schema.nodes.image.create({ src: url, alt: '' });
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
      view.focus();
    },
  },
];

function createMenuDOM(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'slash-menu';
  el.style.cssText = `
    position: absolute; z-index: 100; display: none;
    background: hsl(240 6% 14%); border: 1px solid hsl(240 4% 20%);
    border-radius: 8px; padding: 4px; width: 260px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4); max-height: 360px; overflow-y: auto;
  `;
  return el;
}

function renderItems(
  el: HTMLDivElement,
  items: SlashMenuItem[],
  selected: number,
  onHover: (i: number) => void,
  onClick: (i: number) => void,
) {
  el.innerHTML = '';
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 6px; cursor: pointer;
      transition: background 0.1s;
      ${i === selected ? 'background: hsl(240 4% 20%);' : ''}
    `;
    row.onmouseenter = () => onHover(i);
    // Use mousedown + preventDefault to prevent editor blur
    row.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); onClick(i); };

    const icon = document.createElement('span');
    icon.style.cssText = 'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: hsl(240 4% 18%); border-radius: 6px; font-size: 13px; font-weight: 600; color: #a1a1aa; flex-shrink: 0;';
    icon.textContent = item.icon;

    const text = document.createElement('div');
    text.style.cssText = 'min-width: 0; flex: 1;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size: 13px; color: #e4e4e7; font-weight: 500; line-height: 1.3;';
    label.textContent = item.label;
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 11px; color: #71717a; line-height: 1.3;';
    desc.textContent = item.description;
    text.appendChild(label);
    text.appendChild(desc);

    row.appendChild(icon);
    row.appendChild(text);
    el.appendChild(row);
  });
}

export function slashMenuPlugin(): Plugin {
  let menuEl: HTMLDivElement | null = null;
  let active = false;
  let filterText = '';
  let selectedIndex = 0;
  let slashPos = -1;

  function getFilteredItems(): SlashMenuItem[] {
    if (!filterText) return SLASH_ITEMS;
    const q = filterText.toLowerCase();
    return SLASH_ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  }

  function show(view: EditorView) {
    if (!menuEl) return;
    active = true;
    menuEl.style.display = 'block';
    updatePosition(view);
    updateMenu(view);
  }

  function hide() {
    if (!menuEl) return;
    active = false;
    menuEl.style.display = 'none';
    filterText = '';
    selectedIndex = 0;
    slashPos = -1;
  }

  function updateMenu(view: EditorView) {
    if (!menuEl) return;
    const items = getFilteredItems();
    if (items.length === 0) { hide(); return; }
    selectedIndex = Math.min(selectedIndex, items.length - 1);
    renderItems(menuEl, items, selectedIndex,
      // onHover: just update highlight
      (i) => {
        selectedIndex = i;
        // Re-render to update highlight without re-triggering hover loop
        if (!menuEl) return;
        const rows = menuEl.children;
        for (let j = 0; j < rows.length; j++) {
          (rows[j] as HTMLElement).style.background = j === i ? 'hsl(240 4% 20%)' : '';
        }
      },
      // onClick: execute command
      (i) => {
        const filtered = getFilteredItems();
        if (filtered[i]) executeItem(view, filtered[i]);
      }
    );
  }

  function updatePosition(view: EditorView) {
    if (!menuEl || slashPos < 0) return;
    try {
      const coords = view.coordsAtPos(slashPos);
      const editorRect = view.dom.closest('.outline-editor')?.getBoundingClientRect() || view.dom.getBoundingClientRect();
      menuEl.style.left = `${coords.left - editorRect.left}px`;
      menuEl.style.top = `${coords.bottom - editorRect.top + 4}px`;
    } catch {
      // Position may be invalid if doc changed
    }
  }

  function executeItem(view: EditorView, item: SlashMenuItem) {
    // Delete the slash + filter text first
    const { state, dispatch } = view;
    const from = slashPos;
    const to = state.selection.from;
    if (from >= 0 && to >= from) {
      const tr = state.tr.delete(from, to);
      dispatch(tr);
    }
    hide();
    // Execute the command after state update
    setTimeout(() => {
      item.command(view);
    }, 10);
  }

  return new Plugin({
    key: slashMenuKey,
    view(editorView) {
      menuEl = createMenuDOM();
      const container = editorView.dom.closest('.outline-editor');
      if (container) {
        (container as HTMLElement).style.position = 'relative';
        container.appendChild(menuEl);
      }
      return {
        update(view) {
          if (active) updatePosition(view);
        },
        destroy() {
          menuEl?.remove();
          menuEl = null;
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        if (active) {
          const items = getFilteredItems();
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateMenu(view);
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateMenu(view);
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (items[selectedIndex]) executeItem(view, items[selectedIndex]);
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            hide();
            return true;
          }
          if (event.key === 'Backspace') {
            // If we'd backspace past the slash, close menu
            const { state } = view;
            if (state.selection.from <= slashPos + 1) {
              // Let backspace happen (deletes the /), then close
              setTimeout(() => hide(), 0);
              return false;
            }
            // Otherwise update filter after backspace
            setTimeout(() => {
              const { state: newState } = view;
              if (slashPos >= 0 && newState.selection.from > slashPos) {
                filterText = newState.doc.textBetween(slashPos + 1, newState.selection.from, '');
                selectedIndex = 0;
                updateMenu(view);
              }
            }, 0);
            return false;
          }
          // Let other keys pass through — handleTextInput will update filter
          return false;
        }
        return false;
      },
      handleTextInput(view, from, to, text) {
        if (text === '/') {
          const { $from } = view.state.selection;
          // Only trigger at start of line (or after whitespace)
          const before = $from.parent.textContent.slice(0, $from.parentOffset);
          if (before.trim() === '') {
            // Wait for the "/" to be inserted, then activate
            setTimeout(() => {
              slashPos = view.state.selection.from - 1;
              filterText = '';
              selectedIndex = 0;
              show(view);
            }, 0);
          }
          return false;
        }
        if (active) {
          // Update filter based on text after slash
          setTimeout(() => {
            const { state } = view;
            if (slashPos >= 0 && state.selection.from > slashPos) {
              filterText = state.doc.textBetween(slashPos + 1, state.selection.from, '');
              selectedIndex = 0;
              updateMenu(view);
            }
          }, 0);
          return false;
        }
        return false;
      },
      handleClick(view) {
        // Close menu on click elsewhere in editor
        if (active) hide();
        return false;
      },
    },
    // Close menu if cursor moved before the slash
    appendTransaction(transactions, oldState, newState) {
      if (!active) return null;
      const { selection } = newState;
      if (selection.from < slashPos) {
        hide();
      }
      return null;
    },
  });
}
