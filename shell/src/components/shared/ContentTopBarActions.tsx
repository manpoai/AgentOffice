'use client';

import { Search, ExternalLink, Clock, AtSign, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function ContentTopBarCommonActions({
  onSearch,
  onShare,
  onHistory,
  onComments,
  showHistory,
  showComments,
}: {
  onSearch?: () => void;
  onShare?: () => void;
  onHistory: () => void;
  onComments: () => void;
  showHistory?: boolean;
  showComments?: boolean;
}) {
  const { t } = useT();
  return (
    <>
      <button onClick={onSearch} className="p-2 text-black/70 dark:text-white/70 hover:text-foreground rounded transition-colors" title={t('toolbar.search')}>
        <Search className="h-4 w-4" />
      </button>
      <button onClick={onShare} className="flex items-center gap-1.5 h-8 px-3 ml-1 border border-black/20 dark:border-white/20 rounded-lg text-sm font-medium text-black/70 dark:text-white/70 hover:bg-black/[0.04] transition-colors">
        <ExternalLink className="h-4 w-4" />
        {t('actions.share')}
      </button>
      <button
        onClick={onHistory}
        className={cn('flex items-center justify-center w-8 h-8 ml-1 border border-black/20 dark:border-white/20 rounded-lg transition-colors', showHistory ? 'text-sidebar-primary bg-sidebar-primary/10 border-sidebar-primary/20' : 'text-black/70 dark:text-white/70 hover:bg-black/[0.04]')}
        title={t('content.versionHistory')}
      >
        <Clock className="h-4 w-4" />
      </button>
      <button
        onClick={onComments}
        className={cn('flex items-center justify-center w-8 h-8 ml-1 rounded-lg transition-colors', showComments ? 'bg-sidebar-primary/80' : 'bg-sidebar-primary hover:bg-sidebar-primary/90')}
        title={t('content.comments')}
      >
        <AtSign className="h-4 w-4 text-white" />
      </button>
    </>
  );
}

export function ContentTopBarSlidesActions({
  onSearch,
  onShare,
  onHistory,
  onComments,
  showHistory,
  showComments,
  onPresent,
}: {
  onSearch?: () => void;
  onShare?: () => void;
  onHistory: () => void;
  onComments: () => void;
  showHistory?: boolean;
  showComments?: boolean;
  onPresent: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <ContentTopBarCommonActions
        onSearch={onSearch}
        onShare={onShare}
        onHistory={onHistory}
        onComments={onComments}
        showHistory={showHistory}
        showComments={showComments}
      />
      <button onClick={onPresent} className="flex items-center gap-1.5 h-8 px-3 ml-1 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
        <Play className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('toolbar.present')}</span>
      </button>
    </>
  );
}
