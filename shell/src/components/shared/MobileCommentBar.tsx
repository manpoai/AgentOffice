'use client';

import React from 'react';
import { useT } from '@/lib/i18n';
import { MessageSquare } from 'lucide-react';

interface MobileCommentBarProps {
  /** Click handler — parent sets showComments(true) */
  onClick: () => void;
  /** Optional: show comment count in the bar */
  commentCount?: number;
  /** Optional: extra element to render to the right of the bar (e.g. FAB) */
  rightSlot?: React.ReactNode;
}

/**
 * Bottom comment trigger bar for mobile views.
 * Clicking opens the full CommentPanel via BottomSheet.
 */
export function MobileCommentBar({ onClick, commentCount, rightSlot }: MobileCommentBarProps) {
  const { t } = useT();

  return (
    <div className="flex items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2 bg-card border-t border-border md:hidden">
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-2 h-10 px-4 rounded-full bg-muted/50 border border-border text-muted-foreground text-sm"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span>{t('comments.addComment')}</span>
        {commentCount != null && commentCount > 0 && (
          <span className="ml-auto text-xs font-medium">{commentCount}</span>
        )}
      </button>
      {rightSlot}
    </div>
  );
}
