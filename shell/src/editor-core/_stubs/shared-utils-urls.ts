/**
 * Stub for @shared/utils/urls
 * Used by: commands/link.ts, lib/Lightbox.ts
 */

export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  // Block javascript: and data: protocols
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
