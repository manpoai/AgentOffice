'use client';

import { Clock, X, RotateCcw } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface RevisionPreviewBannerProps {
  /** Timestamp string of the previewed version */
  createdAt: string;
  /** Called when user clicks "Exit preview" */
  onExit: () => void;
  /** Called when user clicks "Restore this version" — omit to hide the button */
  onRestore?: () => void;
}

function formatRelativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RevisionPreviewBanner({ createdAt, onExit, onRestore }: RevisionPreviewBannerProps) {
  const { t } = useT();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-medium text-amber-800 dark:text-amber-200">
          {t('content.previewingVersion')}
        </span>
        <span className="text-amber-600 dark:text-amber-400">
          — {formatRelativeTime(createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onRestore && (
          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            <RotateCcw size={12} />
            {t('content.restoreVersion')}
          </button>
        )}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
        >
          <X size={12} />
          {t('content.exitPreview')}
        </button>
      </div>
    </div>
  );
}
