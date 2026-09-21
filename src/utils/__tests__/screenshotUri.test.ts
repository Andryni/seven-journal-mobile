import {
  isRenderableImageUri,
  normalizeScreenshotUri,
  sanitizeScreenshotUris,
} from '../screenshotUri';

describe('screenshotUri', () => {
  describe('isRenderableImageUri', () => {
    it('accepts the schemes React Native can render', () => {
      expect(isRenderableImageUri('data:image/png;base64,AAAA')).toBe(true);
      expect(isRenderableImageUri('file:///data/0/shot.png')).toBe(true);
      expect(isRenderableImageUri('https://example.com/chart.png')).toBe(true);
      expect(isRenderableImageUri('http://example.com/chart.png')).toBe(true);
    });

    it('rejects bare base64 and empty values', () => {
      expect(isRenderableImageUri('iVBORw0KGgoAAAANSUhEUg')).toBe(false);
      expect(isRenderableImageUri('')).toBe(false);
      expect(isRenderableImageUri(null)).toBe(false);
      expect(isRenderableImageUri(undefined)).toBe(false);
    });
  });

  describe('normalizeScreenshotUri', () => {
    it('wraps bare base64 — the legacy replay-capture bug — into a PNG data URI', () => {
      const raw = 'iVBORw0KGgoAAAANSUhEUg==';
      expect(normalizeScreenshotUri(raw)).toBe(`data:image/png;base64,${raw}`);
    });

    it('strips whitespace inside wrapped base64', () => {
      expect(normalizeScreenshotUri('AAEC /w==')).toBe('data:image/png;base64,AAEC/w==');
    });

    it('passes complete data, file and https URIs through untouched', () => {
      expect(normalizeScreenshotUri('data:image/jpeg;base64,ZZZZ')).toBe(
        'data:image/jpeg;base64,ZZZZ'
      );
      expect(normalizeScreenshotUri('file:///storage/shot.png')).toBe(
        'file:///storage/shot.png'
      );
      expect(normalizeScreenshotUri('https://example.com/c.png')).toBe(
        'https://example.com/c.png'
      );
    });

    it('does not invent a scheme for arbitrary non-base64 strings', () => {
      expect(normalizeScreenshotUri('not a uri at all!')).toBe('not a uri at all!');
    });

    it('maps empty values to null', () => {
      expect(normalizeScreenshotUri(null)).toBeNull();
      expect(normalizeScreenshotUri(undefined)).toBeNull();
      expect(normalizeScreenshotUri('')).toBeNull();
    });
  });

  describe('sanitizeScreenshotUris — write guard', () => {
    it('heals bare base64 before it reaches the database', () => {
      const raw = 'iVBORw0KGgoAAAANSUhEUg';
      const out = sanitizeScreenshotUris({
        pair: 'BTCUSD',
        screenshot_after_url: raw,
      });
      expect(out.screenshot_after_url).toBe(`data:image/png;base64,${raw}`);
    });

    it('normalises both screenshot fields when present', () => {
      const raw = 'QQ==';
      const out = sanitizeScreenshotUris({
        screenshot_before_url: raw,
        screenshot_after_url: raw,
      });
      expect(out.screenshot_before_url).toBe(`data:image/png;base64,${raw}`);
      expect(out.screenshot_after_url).toBe(`data:image/png;base64,${raw}`);
    });

    it('leaves fields absent from the payload absent (no accidental null overwrite)', () => {
      const out = sanitizeScreenshotUris({ pair: 'US100' });
      expect(out).toEqual({ pair: 'US100' });
      expect('screenshot_after_url' in out).toBe(false);
    });

    it('keeps explicit nulls as nulls (clearing a screenshot stays clearing)', () => {
      const out = sanitizeScreenshotUris({ screenshot_after_url: null });
      expect(out.screenshot_after_url).toBeNull();
    });

    it('passes remote URLs through untouched', () => {
      const out = sanitizeScreenshotUris({
        screenshot_after_url: 'https://example.com/c.png',
      });
      expect(out.screenshot_after_url).toBe('https://example.com/c.png');
    });
  });
});
