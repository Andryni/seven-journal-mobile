/**
 * Screenshot URIs arrive from four eras of the app: remote https URLs pasted by
 * the trader, local file:// captures, complete `data:image/png;base64,…` URIs,
 * and — from the replay capture's first release — raw base64 with no `data:`
 * prefix at all, because `Svg.toDataURL` in react-native-svg returns bare base64
 * on every platform (the web implementation strips the prefix explicitly).
 *
 * React Native's Image can only decode what starts with a recognised scheme, so
 * a bare base64 value renders as a black tile: exactly what the gallery showed
 * for replay captures. Normalising at the display boundary fixes the rows that
 * are already stored without a migration, and keeps every future caller honest.
 */

const DATA_URI_RE = /^(data|file|http|https|content|asset|exp):/i;

/** True when the value is a URI React Native's Image can render as-is. */
export function isRenderableImageUri(uri: string | null | undefined): boolean {
  return typeof uri === 'string' && DATA_URI_RE.test(uri);
}

/**
 * Write guard: the payload that reaches Supabase must never carry bare
 * base64 again. All trade writes funnel through useTrades' insertTrade /
 * patchTrade, which normalise here — legacy rows recover at display time
 * anyway, but a guarded write means the database heals itself on the next
 * save instead of relying on every reader to remember.
 */
export function sanitizeScreenshotUris<T extends {
  screenshot_after_url?: string | null;
  screenshot_before_url?: string | null;
}>(payload: T): T {
  return {
    ...payload,
    ...(payload.screenshot_after_url !== undefined && {
      screenshot_after_url: normalizeScreenshotUri(payload.screenshot_after_url),
    }),
    ...(payload.screenshot_before_url !== undefined && {
      screenshot_before_url: normalizeScreenshotUri(payload.screenshot_before_url),
    }),
  };
}

/**
 * Wrap raw base64 (with or without newlines) into a PNG data URI. Values that
 * already carry a scheme — or that are plainly not base64 — pass through
 * unchanged; `null`/`undefined` return null so callers can chain `??` cleanly.
 */
export function normalizeScreenshotUri(
  uri: string | null | undefined
): string | null {
  if (!uri) return null;
  if (isRenderableImageUri(uri)) return uri;
  // Bare base64: [A–Za–z0–9+/] groups, optional padding, optional whitespace
  // (react-native-svg does not insert any, but stay forgiving).
  if (/^[A-Za-z0-9+/=\s]+$/.test(uri)) {
    return `data:image/png;base64,${uri.replace(/\s+/g, '')}`;
  }
  // Unknown format — hand it back untouched rather than inventing a scheme.
  return uri;
}
