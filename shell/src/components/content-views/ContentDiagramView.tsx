'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Clock, MessageSquare as MessageSquareIcon, Download, Link2, Pin, ExternalLink, AtSign, Share2, Trash2, X } from 'lucide-react';
import { ContentTopBar } from '@/components/shared/ContentTopBar';
import { ActorInlineAvatar } from '@/components/shared/ActorInlineAvatar';
import { buildFixedTopBarActionItems, renderFixedTopBarActions } from '@/actions/content-topbar-fixed.actions';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/time';
import dynamic from 'next/dynamic';
import { CommentPanel } from '@/components/shared/CommentPanel';
import { RevisionHistory } from '@/components/shared/RevisionHistory';
import { RevisionPreviewBanner } from '@/components/shared/RevisionPreviewBanner';
import { EditorSkeleton } from '@/components/shared/Skeleton';
import { DiagramPreview } from '@/components/shared/EmbeddedDiagram/DiagramPreview';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { MobileCommentBar } from '@/components/shared/MobileCommentBar';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import * as gw from '@/lib/api/gateway';
import { showError } from '@/lib/utils/error';
import { useT } from '@/lib/i18n';
import type { DiagramEditorHandle, DiagramSaveStatus } from '@/components/diagram-editor/X6DiagramEditor';
import { buildContentTopBarCommonMenuItems } from '@/actions/content-topbar-common.actions';
import { getPublicOrigin } from '@/lib/remote-access';

const DiagramEditor = dynamic(
  () => import('@/components/diagram-editor/X6DiagramEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

export function ContentDiagramView({ diagramId, breadcrumb, onBack, onDeleted, onCopyLink, docListVisible, onToggleDocList, onNavigate, focusCommentId, showComments, onShowComments, onCloseComments, onToggleComments, isPinned, onTogglePin }: {
  diagramId: string;
  breadcrumb: { id: string; title: string }[];
  onBack: () => void;
  onDeleted: () => void;
  onCopyLink: () => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
  onNavigate?: (id: string) => void;
  focusCommentId?: string;
  showComments: boolean;
  onShowComments: () => void;
  onCloseComments: () => void;
  onToggleComments: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const editorRef = useRef<DiagramEditorHandle>(null);
  const [saveStatus, setSaveStatus] = useState<DiagramSaveStatus>({ reliabilityStatus: 'clean', flushRetryCount: 0, lastSaved: null });
  const [focusAnchorState, setFocusAnchorState] = useState<{ type: string; id: string } | null>(null);

  const { data: diagramComments = [] } = useQuery({
    queryKey: ['comments', 'diagram', `diagram:${diagramId}`, undefined],
    queryFn: () => gw.listContentComments(`diagram:${diagramId}`),
    staleTime: 5_000,
  });
  const commentedCellIds = useMemo(() => {
    const ids = new Set<string>();
    diagramComments.forEach((c: any) => {
      const anchor = c.context_payload?.anchor;
      if (anchor && (anchor.type === 'node' || anchor.type === 'edge') && !c.resolved_at) {
        ids.add(anchor.id);
      }
    });
    return ids;
  }, [diagramComments]);

  const navigateToAnchor = useCallback((anchor: { type: string; id: string; meta?: Record<string, unknown> }) => {
    if (anchor.type === 'node' || anchor.type === 'edge') {
      editorRef.current?.scrollToCell?.(anchor.id);
    }
  }, []);
  const [commentAnchor, setCommentAnchor] = useState<{ type: string; id: string; meta?: Record<string, unknown> } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [previewRevisionData, setPreviewRevisionData] = useState<any>(null);
  const [previewRevisionMeta, setPreviewRevisionMeta] = useState<{ id: string; created_at: string } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.cellId && detail?.cellType) {
        if (detail.cellType === 'node') {
          setCommentAnchor({
            type: 'node',
            id: detail.cellId,
            meta: { node_label: detail.label || '' },
          });
        } else if (detail.cellType === 'edge') {
          setCommentAnchor({
            type: 'edge',
            id: detail.cellId,
            meta: {
              edge_label: detail.label || '',
              source_node_id: detail.source_node_id || null,
              target_node_id: detail.target_node_id || null,
            },
          });
        }
      } else {
        setCommentAnchor(null);
      }
      onShowComments();
      setShowHistory(false);
    };
    window.addEventListener('diagram:open-comments', handler);
    return () => window.removeEventListener('diagram:open-comments', handler);
  }, []);
  const [title, setTitle] = useState('');

  // Get title from content items
  const { data: contentItems } = useQuery({
    queryKey: ['content-items'],
    queryFn: gw.listContentItems,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const item = contentItems?.find((i: any) => i.raw_id === diagramId && i.type === 'diagram');
    if (item) setTitle(item.title || '');
  }, [contentItems, diagramId]);

  useEffect(() => {
    const handler = () => { gw.createContentManualSnapshot(`diagram:${diagramId}`).catch(() => {}); };
    window.addEventListener('save-current', handler);
    return () => window.removeEventListener('save-current', handler);
  }, [diagramId]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
    try {
      await gw.updateContentItem(`diagram:${diagramId}`, { title: newTitle });
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
    } catch (e) {
      showError(t('errors.updateDiagramTitleFailed'), e);
    }
  }, [diagramId, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!confirm(t('diagram.deleteConfirm'))) return;
    try {
      await gw.deleteContentItem(`diagram:${diagramId}`);
      onDeleted();
    } catch (e) {
      showError(t('errors.deleteDiagramFailed'), e);
    }
  }, [diagramId, onDeleted]);

  // Get updated_at/updated_by from content items for metaLine
  const diagramItem = contentItems?.find((i: any) => i.raw_id === diagramId && i.type === 'diagram');

  return (
    <div className="flex-1 min-w-0 flex flex-row h-full">
      {/* Left column: TopBar + editor content — card style */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden relative z-[1]">
        {/* ContentTopBar — system-level, same as Doc/Table */}
        <div className="flex items-center border-b border-border bg-card shrink-0 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.02)]">
          <ContentTopBar
            breadcrumb={breadcrumb}
            onNavigate={onNavigate}
            onBack={onBack}
            docListVisible={docListVisible}
            onToggleDocList={onToggleDocList}
            title={title || t('content.untitledDiagram')}
            titlePlaceholder={t('content.untitledDiagram')}
            onTitleChange={handleTitleChange}
            statusText={
              saveStatus.reliabilityStatus === 'flushing' ? t('content.saving')
              : saveStatus.reliabilityStatus === 'dirty' ? t('content.unsaved')
              : saveStatus.reliabilityStatus === 'flush_failed' ? `${t('content.saveFailed')} (${saveStatus.flushRetryCount}/3)`
              : ''
            }
            statusError={saveStatus.reliabilityStatus === 'flush_failed'}
            onRetry={saveStatus.reliabilityStatus === 'flush_failed' ? () => editorRef.current?.save() : undefined}
            metaLine={
              <button
                onClick={() => { setShowHistory(true); onCloseComments(); }}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
              >
                {t('content.lastModified')}: {formatRelativeTime(diagramItem?.updated_at || diagramItem?.created_at)}
                {diagramItem?.updated_by && <span> {t('content.by')} <ActorInlineAvatar name={diagramItem.updated_by} /> {diagramItem.updated_by}</span>}
              </button>
            }
            onHistory={() => { setShowHistory(true); onCloseComments(); }}
            onComments={() => { onToggleComments(); setShowHistory(false); }}
            menuItems={[
              ...buildContentTopBarCommonMenuItems(t, {
                id: diagramId,
                type: 'diagram',
                title,
                pinned: isPinned ?? false,
                url: '',
                startRename: () => {},
                openIconPicker: () => {},
                togglePin: () => onTogglePin?.(),
                deleteItem: handleDelete,
                downloadItem: () => editorRef.current?.exportPNG(),
                shareItem: () => {},
                copyLink: () => onCopyLink(),
                showHistory: () => { setShowHistory(true); onCloseComments(); },
                showComments: () => { onShowComments(); setShowHistory(false); },
              }),
            ]}
            actions={renderFixedTopBarActions(
              buildFixedTopBarActionItems(t, {
                id: diagramId,
                type: 'diagram',
                title: title || t('content.untitledDiagram'),
                pinned: isPinned ?? false,
                url: typeof window !== 'undefined' ? `${getPublicOrigin()}${window.location.pathname}${window.location.search}` : '',
                startRename: () => {},
                openIconPicker: () => {},
                togglePin: () => onTogglePin?.(),
                deleteItem: handleDelete,
                shareItem: () => {},
                copyLink: () => onCopyLink(),
                showHistory: () => { setShowHistory(v => !v); onCloseComments(); },
                showComments: () => { onToggleComments(); setShowHistory(false); },
                showHistoryActive: showHistory,
                showCommentsActive: showComments,
              }),
              { t, ctx: { showHistoryActive: showHistory, showCommentsActive: showComments } as any }
            )}
          />
        </div>

        {/* Version Preview Overlay */}
        {previewRevisionData && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <RevisionPreviewBanner
              createdAt={previewRevisionMeta?.created_at || new Date().toISOString()}
              onExit={() => { setPreviewRevisionData(null); setPreviewRevisionMeta(null); }}
              onRestore={previewRevisionMeta ? async () => {
                if (!confirm(t('content.restoreVersionWarning', { type: t('content.typeDiagram') }))) return;
                try {
                  await gw.restoreContentRevision(`diagram:${diagramId}`, previewRevisionMeta.id);
                  // Invalidate cache so the remounted DiagramEditor fetches fresh data
                  await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
                  setPreviewRevisionData(null);
                  setPreviewRevisionMeta(null);
                  setShowHistory(false);
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : t('content.restoreVersionFailed'));
                }
              } : undefined}
            />
            <div className="flex-1 overflow-auto p-6 bg-muted/30 flex items-center justify-center">
              {previewRevisionData?.cells ? (
                <DiagramPreview
                  data={previewRevisionData}
                  className="w-full h-full max-w-4xl"
                />
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">{t('content.noPreviewData')}</div>
              )}
            </div>
          </div>
        )}

        {/* DiagramEditor — keep mounted but hidden during version preview to preserve state */}
        <div className={cn("flex-1 min-h-0 flex flex-col", previewRevisionData && "hidden")}>
          <DiagramEditor
            diagramId={diagramId}
            editorRef={editorRef}
            onSaveStatusChange={setSaveStatus}
            onDeleted={onDeleted}
            showComments={false}
            showHistory={false}
            embedded
            commentedCellIds={commentedCellIds}
            onCellCommentClick={(cellId: string, cellType: string) => {
              onShowComments();
              setFocusAnchorState({ type: cellType, id: cellId });
            }}
          />
        </div>
        {/* Mobile: bottom comment bar — no editing on mobile */}
        <MobileCommentBar
          onClick={() => { onShowComments(); setShowHistory(false); }}
        />
      </div>

      {/* Right column: Comments panel — full height */}
      {showComments && !showHistory && (
        <>
          <div className="hidden md:flex w-[304px] bg-sidebar flex-col shrink-0 overflow-hidden h-full">
            <CommentPanel
              targetType="diagram"
              targetId={`diagram:${diagramId}`}
              anchorType={commentAnchor?.type}
              anchorId={commentAnchor?.id}
              anchorMeta={commentAnchor?.meta}
              onClose={() => onCloseComments()}
              focusCommentId={focusCommentId}
              onAnchorUsed={() => setCommentAnchor(null)}
              onNavigateToAnchor={navigateToAnchor}
              focusAnchor={focusAnchorState}
            />
          </div>
          <BottomSheet open={true} onClose={() => onCloseComments()} initialHeight="full">
            <CommentPanel
              targetType="diagram"
              targetId={`diagram:${diagramId}`}
              anchorType={commentAnchor?.type}
              anchorId={commentAnchor?.id}
              anchorMeta={commentAnchor?.meta}
              onClose={() => onCloseComments()}
              focusCommentId={focusCommentId}
              onAnchorUsed={() => setCommentAnchor(null)}
              onNavigateToAnchor={navigateToAnchor}
              focusAnchor={focusAnchorState}
              autoFocus
            />
          </BottomSheet>
        </>
      )}

      {/* Right column: Version History panel — full height */}
      {showHistory && (
        <>
          <div className="hidden md:flex w-[304px] bg-sidebar flex-col shrink-0 overflow-hidden h-full">
            <RevisionHistory
              contentType="diagram"
              contentId={diagramId}
              onClose={() => { setShowHistory(false); setPreviewRevisionData(null); }}
              onCreateManualVersion={async () => { await gw.createContentManualSnapshot(`diagram:${diagramId}`); }}
              onSelectRevision={(rev) => { setPreviewRevisionData(rev?.data ?? null); setPreviewRevisionMeta(rev ? { id: rev.id, created_at: rev.created_at } : null); }}
              onRestore={async (data) => {
                setPreviewRevisionData(null);
                await editorRef.current?.restoreFromSnapshot(data);
              }}
            />
          </div>
          <BottomSheet open={true} onClose={() => { setShowHistory(false); setPreviewRevisionData(null); }} title={t('content.versionHistory')} initialHeight="full">
            <RevisionHistory
              contentType="diagram"
              contentId={diagramId}
              onClose={() => { setShowHistory(false); setPreviewRevisionData(null); }}
              onCreateManualVersion={async () => { await gw.createContentManualSnapshot(`diagram:${diagramId}`); }}
              onSelectRevision={(rev) => { setPreviewRevisionData(rev?.data ?? null); setPreviewRevisionMeta(rev ? { id: rev.id, created_at: rev.created_at } : null); }}
              onRestore={async (data) => {
                setPreviewRevisionData(null);
                await editorRef.current?.restoreFromSnapshot(data);
              }}
            />
          </BottomSheet>
        </>
      )}

      {/* Mobile: More menu is now handled by ContentTopBar via menuItems */}

    </div>
  );
}
