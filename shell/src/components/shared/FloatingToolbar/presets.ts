import {
  Bold, Italic, Strikethrough, Underline, Highlighter, Code2, Quote,
  Heading1, Heading2, Heading3, ListTodo, ListOrdered, List,
  Link, MessageSquare, Type, Palette,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import type { ToolbarItem } from './types';
import { createElement } from 'react';

const icon = (Icon: any) => createElement(Icon, { className: 'h-4 w-4' });

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'hsl(50 90% 60% / 0.3)' },
  { name: 'Orange', value: 'hsl(25 90% 60% / 0.3)' },
  { name: 'Red', value: 'hsl(0 80% 60% / 0.3)' },
  { name: 'Pink', value: 'hsl(330 80% 65% / 0.3)' },
  { name: 'Purple', value: 'hsl(270 60% 60% / 0.3)' },
  { name: 'Blue', value: 'hsl(210 70% 55% / 0.3)' },
  { name: 'Green', value: 'hsl(142 50% 50% / 0.3)' },
];

export const DOCS_TEXT_ITEMS: ToolbarItem[] = [
  { key: 'bold', type: 'toggle', icon: icon(Bold), label: 'Bold (Cmd+B)', group: 'inline' },
  { key: 'italic', type: 'toggle', icon: icon(Italic), label: 'Italic (Cmd+I)', group: 'inline' },
  { key: 'strikethrough', type: 'toggle', icon: icon(Strikethrough), label: 'Strikethrough', group: 'inline' },
  { key: 'underline', type: 'toggle', icon: icon(Underline), label: 'Underline (Cmd+U)', group: 'inline' },
  { key: 'highlight', type: 'color', icon: icon(Highlighter), label: 'Highlight', group: 'style', colors: HIGHLIGHT_COLORS, colorClearable: true },
  { key: 'code', type: 'toggle', icon: icon(Code2), label: 'Inline code', group: 'style' },
  { key: 'blockquote', type: 'toggle', icon: icon(Quote), label: 'Quote', group: 'style' },
  { key: 'heading1', type: 'toggle', icon: icon(Heading1), label: 'Heading 1', group: 'heading' },
  { key: 'heading2', type: 'toggle', icon: icon(Heading2), label: 'Heading 2', group: 'heading' },
  { key: 'heading3', type: 'toggle', icon: icon(Heading3), label: 'Heading 3', group: 'heading' },
  { key: 'checkboxList', type: 'toggle', icon: icon(ListTodo), label: 'Checkbox list', group: 'list' },
  { key: 'orderedList', type: 'toggle', icon: icon(ListOrdered), label: 'Ordered list', group: 'list' },
  { key: 'bulletList', type: 'toggle', icon: icon(List), label: 'Bullet list', group: 'list' },
  { key: 'link', type: 'action', icon: icon(Link), label: 'Link', group: 'insert' },
  { key: 'comment', type: 'action', icon: icon(MessageSquare), label: 'Comment', group: 'insert' },
];

// ── PPT Text Toolbar ──

const TEXT_COLORS = [
  { name: 'Black', value: '#1f2937' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

const FONT_FAMILIES = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
  { value: '"Noto Sans SC", "Source Han Sans SC", sans-serif', label: '思源黑体' },
  { value: '"Noto Serif SC", "Source Han Serif SC", serif', label: '思源宋体' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: '"PingFang SC", sans-serif', label: '苹果苹方' },
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96].map(
  s => ({ value: String(s), label: String(s) }),
);

export const PPT_TEXT_ITEMS: ToolbarItem[] = [
  { key: 'fontFamily', type: 'dropdown', icon: null, label: 'Font', group: 'font', options: FONT_FAMILIES },
  { key: 'fontSize', type: 'dropdown', icon: null, label: 'Size', group: 'font', options: FONT_SIZES },
  { key: 'bold', type: 'toggle', icon: icon(Bold), label: 'Bold', group: 'format' },
  { key: 'italic', type: 'toggle', icon: icon(Italic), label: 'Italic', group: 'format' },
  { key: 'underline', type: 'toggle', icon: icon(Underline), label: 'Underline', group: 'format' },
  { key: 'strikethrough', type: 'toggle', icon: icon(Strikethrough), label: 'Strikethrough', group: 'format' },
  { key: 'align', type: 'dropdown', icon: icon(AlignLeft), label: 'Alignment', group: 'align',
    options: [
      { value: 'left', label: 'Left', icon: icon(AlignLeft) },
      { value: 'center', label: 'Center', icon: icon(AlignCenter) },
      { value: 'right', label: 'Right', icon: icon(AlignRight) },
    ]},
  { key: 'textColor', type: 'color', icon: icon(Palette), label: 'Text color', group: 'color', colors: TEXT_COLORS },
];
