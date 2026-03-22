'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ol from '@/lib/api/outline';
import * as nc from '@/lib/api/nocodb';
import { FileText, Table2, Plus, ArrowLeft, Trash2, X, Search, Clock, MoreHorizontal, MessageSquare as MessageSquareIcon, Star, Copy, Download, ChevronRight, Share2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Editor } from '@/components/editor';
import { Comments } from '@/components/comments/Comments';
import { TableEditor } from '@/components/table-editor/TableEditor';
import * as gw from '@/lib/api/gateway';
import { useT } from '@/lib/i18n';

type ContentItem = { type: 'doc'; id: string; title: string; subtitle: string; emoji?: string; updatedAt?: string; sortTime: number; parentDocumentId?: string | null }
  | { type: 'table'; id: string; title: string; sortTime: number };

type Selection = { type: 'doc'; id: string } | { type: 'table'; id: string } | null;

export default function ContentPage() {
  const { t } = useT();
  const [selection, setSelection] = useState<Selection>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['outline-docs'],
    queryFn: () => ol.listDocuments(),
  });

  const { data: collections } = useQuery({
    queryKey: ['outline-collections'],
    queryFn: ol.listCollections,
  });

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['nc-tables'],
    queryFn: nc.listTables,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['outline-search', searchQuery],
    queryFn: () => ol.searchDocuments(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const selectedDocId = selection?.type === 'doc' ? selection.id : null;
  const selectedTableId = selection?.type === 'table' ? selection.id : null;

  const { data: selectedDoc } = useQuery({
    queryKey: ['outline-doc', selectedDocId],
    queryFn: () => ol.getDocument(selectedDocId!),
    enabled: !!selectedDocId,
  });

  // Build tree structure from docs
  const docItems = (docs || []).map(doc => ({
    type: 'doc' as const,
    id: doc.id,
    title: doc.emoji ? `${doc.title || t('content.untitled')}` : (doc.title || t('content.untitled')),
    subtitle: formatDate(doc.updatedAt),
    emoji: doc.emoji,
    updatedAt: doc.updatedAt,
    sortTime: new Date(doc.updatedAt || 0).getTime(),
    parentDocumentId: doc.parentDocumentId || null,
  }));

  const tableItems = (tables || []).map(tbl => ({
    type: 'table' as const,
    id: tbl.id,
    title: tbl.title,
    sortTime: new Date(tbl.created_at || 0).getTime(),
  }));

  // Build tree: root docs (no parent) and children
  const rootDocs = docItems.filter(d => !d.parentDocumentId);
  const childDocsMap = new Map<string, typeof docItems>();
  docItems.forEach(d => {
    if (d.parentDocumentId) {
      const children = childDocsMap.get(d.parentDocumentId) || [];
      children.push(d);
      childDocsMap.set(d.parentDocumentId, children);
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Search results
  const displaySearchItems = searchQuery.length >= 2
    ? (searchResults
        ? searchResults.map(r => ({
            type: 'doc' as const,
            id: r.document.id,
            title: r.document.title,
            subtitle: r.context?.slice(0, 60) || '',
            emoji: r.document.emoji,
            sortTime: 0,
            parentDocumentId: null,
          }))
        : [])
    : null;

  const handleSelect = (item: { type: 'doc' | 'table'; id: string }) => {
    setSelection({ type: item.type, id: item.id });
    setMobileView('detail');
  };

  const refreshDocs = () => {
    queryClient.invalidateQueries({ queryKey: ['outline-docs'] });
    if (selectedDocId) queryClient.invalidateQueries({ queryKey: ['outline-doc', selectedDocId] });
  };

  const refreshTables = () => {
    queryClient.invalidateQueries({ queryKey: ['nc-tables'] });
  };

  const handleCreateDoc = async () => {
    if (creating) return;
    const collectionId = collections?.[0]?.id;
    if (!collectionId) return;
    setCreating(true);
    try {
      const doc = await ol.createDocument(t('content.untitled'), '', collectionId);
      refreshDocs();
      setSelection({ type: 'doc', id: doc.id });
      setMobileView('detail');
    } catch (e) {
      console.error('Create doc failed:', e);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateTable = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const table = await nc.createTable(t('content.untitledTable'), [
        { title: 'Name', uidt: 'SingleLineText' },
        { title: 'Notes', uidt: 'LongText' },
      ]);
      refreshTables();
      const tableId = table.id || (table as any).table_id;
      setSelection({ type: 'table', id: tableId });
      setMobileView('detail');
    } catch (e) {
      console.error('Create table failed:', e);
    } finally {
      setCreating(false);
    }
  };

  const isLoading = docsLoading || tablesLoading;

  // Get breadcrumb path for selected doc
  const getBreadcrumb = (docId: string): { id: string; title: string }[] => {
    const path: { id: string; title: string }[] = [];
    let current = docItems.find(d => d.id === docId);
    while (current) {
      path.unshift({ id: current.id, title: current.title });
      if (current.parentDocumentId) {
        current = docItems.find(d => d.id === current!.parentDocumentId);
      } else {
        break;
      }
    }
    return path;
  };

  return (
    <div className="flex h-full overflow-hidden flex-col md:flex-row">
      {/* Document Library sidebar */}
      <div className={cn(
        'w-full md:w-[260px] border-r border-border bg-[#F5F5F5] dark:bg-card flex flex-col md:shrink-0 min-h-0 overflow-hidden',
        mobileView === 'list' ? 'flex' : 'hidden md:flex'
      )}>
        {/* Header */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-medium text-muted-foreground">Document Library</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewMenu(v => !v)}
              className="p-1 text-muted-foreground hover:text-foreground"
              title={t('common.new')}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button className="p-1 text-muted-foreground hover:text-foreground">
              <Search className="h-3.5 w-3.5" />
            </button>
            {showNewMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
                <div className="absolute right-4 top-12 z-20 bg-card border border-border rounded-lg shadow-lg py-1 w-36">
                  <button
                    onClick={() => { setShowNewMenu(false); handleCreateDoc(); }}
                    disabled={creating}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t('content.newDoc')}
                  </button>
                  <button
                    onClick={() => { setShowNewMenu(false); handleCreateTable(); }}
                    disabled={creating}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                    {t('content.newTable')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 py-1">
            {isLoading && (
              <div className="space-y-1 px-1 py-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 animate-pulse">
                    <div className="w-4 h-4 rounded bg-muted shrink-0" />
                    <div className="h-3.5 rounded bg-muted" style={{ width: `${60 + Math.random() * 80}px` }} />
                  </div>
                ))}
              </div>
            )}

            {/* Search mode */}
            {displaySearchItems && (
              displaySearchItems.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">{t('content.noMatch')}</p>
              ) : (
                displaySearchItems.map(item => (
                  <TreeItem
                    key={item.id}
                    item={item}
                    isSelected={selection?.type === item.type && selection?.id === item.id}
                    onSelect={() => handleSelect(item)}
                    depth={0}
                  />
                ))
              )
            )}

            {/* Tree mode */}
            {!displaySearchItems && !isLoading && (
              <>
                {rootDocs.map(doc => (
                  <TreeDocItem
                    key={doc.id}
                    doc={doc}
                    selection={selection}
                    onSelect={handleSelect}
                    childDocsMap={childDocsMap}
                    expandedIds={expandedIds}
                    toggleExpand={toggleExpand}
                    depth={0}
                  />
                ))}
                {tableItems.map(tbl => (
                  <TreeItem
                    key={tbl.id}
                    item={tbl}
                    isSelected={selection?.type === 'table' && selection?.id === tbl.id}
                    onSelect={() => handleSelect(tbl)}
                    depth={0}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail area */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0 min-h-0',
        mobileView === 'detail' ? 'flex' : 'hidden md:flex'
      )}>
        {selectedDoc && selection?.type === 'doc' ? (
          <DocPanel
            doc={selectedDoc}
            breadcrumb={getBreadcrumb(selectedDoc.id)}
            onBack={() => setMobileView('list')}
            onSaved={refreshDocs}
            onDeleted={() => { setSelection(null); refreshDocs(); setMobileView('list'); }}
            onNavigate={(docId) => setSelection({ type: 'doc', id: docId })}
          />
        ) : selectedTableId ? (
          <TableEditor
            tableId={selectedTableId}
            onBack={() => setMobileView('list')}
            onDeleted={() => { setSelection(null); setMobileView('list'); }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <div className="flex gap-3 mb-2">
              <FileText className="h-8 w-8 opacity-20" />
              <Table2 className="h-8 w-8 opacity-20" />
            </div>
            <p className="text-sm">{t('content.selectHint')}</p>
            <p className="text-xs text-muted-foreground/50">{t('content.createHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tree components
// ════════════════════════════════════════════════════════════════

function TreeDocItem({ doc, selection, onSelect, childDocsMap, expandedIds, toggleExpand, depth }: {
  doc: { type: 'doc'; id: string; title: string; parentDocumentId?: string | null };
  selection: Selection;
  onSelect: (item: { type: 'doc' | 'table'; id: string }) => void;
  childDocsMap: Map<string, any[]>;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  depth: number;
}) {
  const children = childDocsMap.get(doc.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(doc.id);
  const isSelected = selection?.type === 'doc' && selection?.id === doc.id;

  return (
    <div>
      <button
        onClick={() => onSelect(doc)}
        className={cn(
          'w-full flex items-center gap-1.5 py-1.5 px-2 text-left text-sm transition-colors rounded-lg',
          isSelected
            ? 'bg-[#D6DFF6] dark:bg-sidebar-accent text-sidebar-primary dark:text-sidebar-primary-foreground'
            : 'text-foreground hover:bg-black/[0.03] dark:hover:bg-accent/50'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(doc.id); }}
            className="p-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <FileText className={cn('h-4 w-4 shrink-0', isSelected ? 'text-sidebar-primary' : 'text-muted-foreground')} />
        <span className="truncate">{doc.title}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {children.map((child: any) => (
            <TreeDocItem
              key={child.id}
              doc={child}
              selection={selection}
              onSelect={onSelect}
              childDocsMap={childDocsMap}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeItem({ item, isSelected, onSelect, depth }: {
  item: { type: 'doc' | 'table'; id: string; title: string };
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
}) {
  const isTable = item.type === 'table';
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-1.5 py-1.5 px-2 text-left text-sm transition-colors rounded-lg',
        isSelected
          ? 'bg-[#D6DFF6] dark:bg-sidebar-accent text-sidebar-primary dark:text-sidebar-primary-foreground'
          : 'text-foreground hover:bg-black/[0.03] dark:hover:bg-accent/50'
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <span className="w-4 shrink-0" />
      {isTable
        ? <Table2 className={cn('h-4 w-4 shrink-0', isSelected ? 'text-sidebar-primary' : 'text-muted-foreground')} />
        : <FileText className={cn('h-4 w-4 shrink-0', isSelected ? 'text-sidebar-primary' : 'text-muted-foreground')} />
      }
      <span className="truncate">{item.title}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// Document sub-components
// ════════════════════════════════════════════════════════════════

function DocPanel({ doc, breadcrumb, onBack, onSaved, onDeleted, onNavigate }: {
  doc: ol.OLDocument;
  breadcrumb: { id: string; title: string }[];
  onBack: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onNavigate: (docId: string) => void;
}) {
  const { t } = useT();
  const [showComments, setShowComments] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [commentQuote, setCommentQuote] = useState('');
  const [title, setTitle] = useState(doc.title);
  const [text, setText] = useState(doc.text);
  const [deleting, setDeleting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: doc.title, text: doc.text });

  // Listen for selection comment events from the floating toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        setCommentQuote(detail.text);
        setShowComments(true);
      }
    };
    window.addEventListener('editor-comment', handler);
    return () => window.removeEventListener('editor-comment', handler);
  }, []);

  // Reset state when doc changes
  useEffect(() => {
    setTitle(doc.title);
    setText(doc.text);
    latestRef.current = { title: doc.title, text: doc.text };
    setSaveStatus('saved');
  }, [doc.id, doc.title, doc.text]);

  // Auto-save with debounce
  const scheduleSave = useCallback((newTitle: string, newText: string) => {
    latestRef.current = { title: newTitle, text: newText };
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await ol.updateDocument(doc.id, latestRef.current.title, latestRef.current.text);
        setSaveStatus('saved');
        onSaved();
      } catch (e) {
        console.error('Auto-save failed:', e);
        setSaveStatus('error');
      }
    }, 1500);
  }, [doc.id, onSaved]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    scheduleSave(newTitle, text);
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    scheduleSave(title, newText);
  };

  const handleDelete = async () => {
    if (!confirm(t('content.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await ol.deleteDocument(doc.id);
      onDeleted();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(false);
    }
  };

  const statusText = saveStatus === 'saving' ? t('content.saving') : saveStatus === 'unsaved' ? t('content.unsaved') : saveStatus === 'error' ? t('content.saveFailed') : '';

  return (
    <>
      {/* Header with breadcrumb */}
      <div className="flex flex-col px-4 py-2 border-b border-border bg-white dark:bg-card shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm">
              {breadcrumb.map((crumb, i) => (
                <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {i < breadcrumb.length - 1 ? (
                    <button
                      onClick={() => onNavigate(crumb.id)}
                      className="text-muted-foreground hover:text-foreground truncate"
                    >
                      {crumb.title}
                    </button>
                  ) : (
                    <span className="text-foreground font-medium truncate">{crumb.title}</span>
                  )}
                </span>
              ))}
            </div>
            {/* Last modified info */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>
                Last modified: {formatRelativeTime(doc.updatedAt)} by {doc.updatedBy?.name || '?'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {statusText && (
              <span className={cn(
                'text-[10px]',
                saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'
              )}>{statusText}</span>
            )}
            <button className="flex items-center gap-1.5 h-8 px-3 rounded bg-black/10 dark:bg-accent text-sm text-foreground/80 hover:bg-black/15 dark:hover:bg-accent/80 transition-colors">
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </button>
            <button
              onClick={() => setShowComments(v => !v)}
              className={cn(
                'p-1.5 rounded transition-colors',
                showComments ? 'text-sidebar-primary bg-sidebar-primary/10' : 'text-muted-foreground hover:text-foreground'
              )}
              title={t('content.comments')}
            >
              <MessageSquareIcon className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDocMenu(v => !v)}
                className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
                title={t('content.moreActions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showDocMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDocMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-xl py-1 w-44">
                    <DocMenuBtn icon={Star} label={t('content.favorite')} onClick={() => setShowDocMenu(false)} />
                    <DocMenuBtn icon={Clock} label={t('content.versionHistory')} onClick={() => setShowDocMenu(false)} />
                    <DocMenuBtn icon={Copy} label={t('content.copy')} onClick={() => { navigator.clipboard.writeText(doc.text); setShowDocMenu(false); }} />
                    <DocMenuBtn icon={Download} label={t('content.download')} onClick={() => {
                      const blob = new Blob([doc.text], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `${title}.md`; a.click();
                      URL.revokeObjectURL(url);
                      setShowDocMenu(false);
                    }} />
                    <div className="border-t border-border my-1" />
                    <DocMenuBtn icon={Trash2} label={t('content.delete')} onClick={() => { setShowDocMenu(false); handleDelete(); }} danger />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0">
          <Editor key={doc.id} defaultValue={doc.text} onChange={handleTextChange} placeholder={t('content.editorPlaceholder')} />
        </div>
        {/* Comments right panel */}
        {showComments && (
          <div className="w-72 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground">{t('content.comments')}</h3>
              <button onClick={() => setShowComments(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Comments
              queryKey={['doc-comments', doc.id]}
              fetchComments={() => gw.listDocComments(doc.id)}
              postComment={(text) => gw.commentOnDoc(doc.id, text)}
              initialQuote={commentQuote}
              onQuoteConsumed={() => setCommentQuote('')}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function DocMenuBtn({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-accent'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
}

function formatRelativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
