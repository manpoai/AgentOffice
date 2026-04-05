/**
 * Shared time formatting utilities.
 * Single source of truth — replace all duplicate implementations.
 */

type TFunc = (key: string, params?: Record<string, string | number>) => string;

export function formatRelativeTime(
  dateStr: string | number | null | undefined,
  t?: TFunc,
): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return t ? t('time.justNow') : 'just now';
  if (diffMin < 60) return t ? t('time.minutesAgo', { n: diffMin }) : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t ? t('time.hoursAgo', { n: diffHr }) : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return t ? t('time.daysAgo', { n: diffDay }) : `${diffDay}d ago`;
  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return t ? t('time.monthsAgo', { n: diffMon }) : `${diffMon}mo ago`;
  return date.toLocaleDateString();
}

export function formatDateTime(dateStr: string | number | null | undefined): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function formatDate(dateStr: string | number | null | undefined): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}
