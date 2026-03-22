// Stub for Outline's utils/urls — used by editor-core components
export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return undefined;
  return trimmed;
}

export function isInternalUrl(href: string): boolean {
  return false;
}

export function urlRegex(): RegExp {
  return /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g;
}
