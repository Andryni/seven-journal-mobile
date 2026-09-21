import { isRenderableImageUri, normalizeScreenshotUri } from '../screenshotUri';

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
});
