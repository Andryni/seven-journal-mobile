import {
  BOOT_TAGLINE,
  BOOT_WORDMARK,
  BRAND_HEADROOM,
  BRAND_TAGLINE,
  BRAND_WORDMARK,
  bootLockupLines,
  lockupBoxWidth,
  requiredBoxWidth,
  runWidth,
  worstCaseRunWidth,
} from '../lockupGeometry';

/**
 * The brand lost its tail three times on device ("SEVEN JOURNA…", "FINTECH"
 * without TERMINAL, the L of JOURNAL gone). These tests pin the arithmetic
 * that makes that impossible: the box is COMPUTED from the worst case, so it
 * no longer depends on what a layout pass measured.
 */
describe('worstCaseRunWidth', () => {
  it('counts the trailing letter-spacing gap Android omits', () => {
    // Two glyphs, two gaps -- not one. The missing final gap is exactly what
    // took the last letter off the brand.
    expect(worstCaseRunWidth('AB', 10, 2)).toBeCloseTo(2 * (0.63 * 10 + 2), 6);
    expect(worstCaseRunWidth('A', 10, 2)).toBeCloseTo(8.3, 6);
  });

  it('counts no width for no text', () => {
    expect(worstCaseRunWidth('', 17, 3.4)).toBe(0);
  });

  it('counts glyphs, not UTF-16 units', () => {
    // A surrogate pair is one character on screen and one advance in the run.
    expect(worstCaseRunWidth('👍', 17, 3.4)).toBeCloseTo(worstCaseRunWidth('X', 17, 3.4), 6);
    expect(worstCaseRunWidth('É', 17, 3.4)).toBeCloseTo(worstCaseRunWidth('E', 17, 3.4), 6);
  });

  it('grows with the text and with the letter spacing', () => {
    expect(worstCaseRunWidth('SEVEN', 17, 3.4)).toBeLessThan(worstCaseRunWidth('SEVEN J', 17, 3.4));
    expect(worstCaseRunWidth('SEVEN', 17, 3.4)).toBeLessThan(worstCaseRunWidth('SEVEN', 17, 8));
  });
});

describe('the declared boot typography', () => {
  it('is the size the surfaces have always rendered', () => {
    // Pinned, because the box arithmetic in the components is derived from
    // these numbers: a silent bump here would void the guarantee below.
    expect(BOOT_WORDMARK).toEqual({ fontSize: 17, letterSpacing: 3.4 });
    expect(BOOT_TAGLINE).toEqual({ fontSize: 9, letterSpacing: 2.2 });
  });
});

describe('requiredBoxWidth', () => {
  it('books the headroom over the run', () => {
    const line = { text: BRAND_WORDMARK, fontSize: 17, letterSpacing: 3.4, mono: true };
    const ratio = requiredBoxWidth(line) / runWidth(line);
    expect(ratio).toBeGreaterThanOrEqual(BRAND_HEADROOM);
    // ...and only just, so nobody reads the box as a licence to grow.
    expect(ratio).toBeLessThan(BRAND_HEADROOM * 1.02);
  });

  it('is narrower for a proportional face than for a mono one', () => {
    const mono = { text: BRAND_WORDMARK, fontSize: 17, letterSpacing: 3.4, mono: true };
    const proportional = { ...mono, mono: false };
    expect(requiredBoxWidth(proportional)).toBeLessThan(requiredBoxWidth(mono));
  });
});

describe('lockupBoxWidth', () => {
  it('uses the screen when the screen is wider -- the normal case', () => {
    expect(lockupBoxWidth(702, bootLockupLines())).toBe(702);
  });

  it('never returns a box narrower than the worst-case run', () => {
    // A screen narrower than the brand itself: the box overflows rather than
    // cutting a letter. This is the invariant; the headroom is the bonus.
    const tiny = lockupBoxWidth(180, bootLockupLines());
    expect(tiny).toBeGreaterThan(180);
    expect(tiny).toBeGreaterThanOrEqual(
      requiredBoxWidth({ text: BRAND_WORDMARK, fontSize: 17, letterSpacing: 3.4, mono: true })
    );
    expect(tiny).toBeGreaterThan(runWidth({ text: BRAND_WORDMARK, fontSize: 17, letterSpacing: 3.4 }));
  });

  it('clears the run by the headroom on every real phone width', () => {
    const wordmark = { text: BRAND_WORDMARK, fontSize: 17, letterSpacing: 3.4, mono: true };
    const tagline = { text: BRAND_TAGLINE, fontSize: 9, letterSpacing: 2.2, mono: true };
    const run = Math.max(runWidth(wordmark), runWidth(tagline));

    for (const screen of [360, 375, 393, 412, 428, 480, 768, 1024]) {
      // 24dp gutter each side, as the boot stacks use.
      const box = lockupBoxWidth(screen - 48, bootLockupLines());
      expect(box / run).toBeGreaterThanOrEqual(BRAND_HEADROOM);
      expect(box).toBeLessThanOrEqual(screen);
    }
  });
});
