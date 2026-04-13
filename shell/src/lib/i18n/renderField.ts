/**
 * Render a server-provided i18n field using key+params when available,
 * falling back to the server-rendered string. Params values prefixed with
 * '@:' are resolved recursively via t() in the viewer's language.
 */
export function renderField(
  t: (key: string, params?: Record<string, string | number | boolean>) => string,
  key: string | null | undefined,
  paramsJson: string | null | undefined,
  fallback: string | null | undefined,
): string {
  if (!key) return fallback || '';
  const params: Record<string, string | number> = {};
  if (paramsJson) {
    try {
      const parsed = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.startsWith('@:')) {
            params[k] = t(v.slice(2));
          } else {
            params[k] = v as string | number;
          }
        }
      }
    } catch { /* fall through — render with empty params */ }
  }
  const rendered = t(key, params);
  return rendered === key && fallback ? fallback : rendered;
}
