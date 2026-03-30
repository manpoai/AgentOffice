export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface ShortcutRegistration {
  id: string;
  key: string;
  modifiers?: {
    meta?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  handler: ShortcutHandler;
  label: string;
  category?: string;
  priority?: number;
}

function isEditableTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable || el.closest('[contenteditable]')) return true;
  return false;
}

function isProseMirrorTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement;
  if (!el) return false;
  return !!(el.closest('.ProseMirror') || el.classList.contains('ProseMirror'));
}

function matchesShortcut(e: KeyboardEvent, s: ShortcutRegistration): boolean {
  if (e.key.toLowerCase() !== s.key.toLowerCase() && e.key !== s.key) return false;
  const mod = s.modifiers || {};
  if (!!mod.meta !== e.metaKey) return false;
  if (!!mod.ctrl !== e.ctrlKey) return false;
  if (!!mod.shift !== e.shiftKey) return false;
  if (!!mod.alt !== e.altKey) return false;
  return true;
}

export class KeyboardManager {
  private static instance: KeyboardManager;
  private shortcuts: Map<string, ShortcutRegistration[]> = new Map();
  private activeContext: string | null = null;
  private listening = false;

  static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }

  register(context: string, shortcut: ShortcutRegistration): () => void {
    const list = this.shortcuts.get(context) || [];
    list.push(shortcut);
    this.shortcuts.set(context, list);
    this.ensureListener();
    return () => {
      const current = this.shortcuts.get(context);
      if (current) {
        const idx = current.indexOf(shortcut);
        if (idx !== -1) current.splice(idx, 1);
        if (current.length === 0) this.shortcuts.delete(context);
      }
    };
  }

  setContext(context: string | null): void {
    this.activeContext = context;
  }

  getAllShortcuts(): { context: string; shortcuts: ShortcutRegistration[] }[] {
    const result: { context: string; shortcuts: ShortcutRegistration[] }[] = [];
    for (const [context, shortcuts] of this.shortcuts) {
      result.push({ context, shortcuts: [...shortcuts] });
    }
    return result;
  }

  handleKeyDown = (e: KeyboardEvent): void => {
    // Skip editable targets unless the shortcut uses a modifier key
    const hasModifier = e.metaKey || e.ctrlKey || e.altKey;
    if (isEditableTarget(e) && !hasModifier) return;

    // For Cmd+F and Cmd+H, skip if inside ProseMirror (editor handles its own search)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'h')) {
      if (isProseMirrorTarget(e)) return;
    }

    // Check active context shortcuts first
    if (this.activeContext) {
      const contextShortcuts = this.shortcuts.get(this.activeContext);
      if (contextShortcuts && this.tryMatch(e, contextShortcuts)) return;
    }

    // Check global shortcuts
    const globalShortcuts = this.shortcuts.get('global');
    if (globalShortcuts && this.tryMatch(e, globalShortcuts)) return;
  };

  private tryMatch(e: KeyboardEvent, shortcuts: ShortcutRegistration[]): boolean {
    const sorted = [...shortcuts].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const s of sorted) {
      if (matchesShortcut(e, s)) {
        e.preventDefault();
        s.handler(e);
        return true;
      }
    }
    return false;
  }

  private ensureListener(): void {
    if (this.listening) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown);
    this.listening = true;
  }
}
