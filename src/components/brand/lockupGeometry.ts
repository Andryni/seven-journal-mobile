/**
 * Geometry contract for the brand lockup (splash, boot screen, lock screen).
 *
 * THE BUG THIS EXISTS TO KILL, for the third and last time: on the boot
 * surfaces the brand line intermittently lost its tail -- "SEVEN JOURNA…",
 * "FINTECH" with TERMINAL gone, the L of JOURNAL missing. Two causes were
 * fixed separately (a shrink-to-fit parent column, and mounting the text
 * before the Google fonts landed) and it came back, because both fixes were
 * still arguing about a box the layout had to MEASURE. A measured box can be
 * wrong; a computed one cannot.
 *
 * So the box is computed here: the full width of the screen, floored at the
 * worst-case width of the run itself. Worst case means a mono glyph at the
 * widest advance any of our faces uses (JetBrains Mono is 0.6em; 0.63 books
 * the slop), plus the letter-spacing gap after every glyph -- including the
 * trailing one, which Android does not count when it measures and which is
 * what removed the final letters in the first place.
 *
 * With the box computed, `numberOfLines={1}` has nothing to truncate: at the
 * sizes used in the app the run needs roughly half the screen, so the layout
 * would have to mis-measure it by more than 2x for a glyph to disappear.
 */
/** The two-word brand, as rendered by BrandWordmark. */
export const BRAND_WORDMARK = 'SEVEN JOURNAL';
/** The line under it, on the splash and boot screen. */
export const BRAND_TAGLINE = 'FINTECH TERMINAL';

/**
 * Widest advance of one mono glyph as a fraction of the font size.
 * JetBrains Mono is 0.6em; the third decimal is slack for hinting.
 */
export const MONO_ADVANCE_RATIO = 0.63;

/**
 * How much wider than the worst-case run a box must be before we call it
 * safe. 1.35 leaves room for the real face being a touch wider than its
 * declared metrics without ever reaching the point of truncation.
 */
export const BRAND_HEADROOM = 1.35;

export interface BrandLine {
  text: string;
  fontSize: number;
  letterSpacing: number;
  /** Mono (default) or not -- a proportional face is narrower, never wider. */
  mono?: boolean;
}

/**
 * Widest the text can possibly be laid out at this size.
 *
 * Counts glyphs, not UTF-16 units, so an accented or surrogate-pair character
 * counts once -- and it includes the trailing letter-spacing gap after the
 * last glyph, the one Android's measurement omits.
 */
export function worstCaseRunWidth(text: string, fontSize: number, letterSpacing: number): number {
  const glyphs = [...text].length;
  return glyphs * (MONO_ADVANCE_RATIO * fontSize + letterSpacing);
}

/** The run's width measured the way Android does NOT: trailing gap included. */
export function runWidth(line: BrandLine): number {
  const ratio = line.mono === false ? 0.56 : MONO_ADVANCE_RATIO;
  return [...line.text].length * (ratio * line.fontSize + line.letterSpacing);
}

/** Box that holds this line's worst case with BRAND_HEADROOM to spare. */
export function requiredBoxWidth(line: BrandLine): number {
  return Math.ceil(runWidth(line) * BRAND_HEADROOM);
}

/**
 * The width to give every line of a lockup.
 *
 * The screen wins whenever it is wider (the normal case, on every phone:
 * ~2x the run). `required` only takes over on a screen narrow enough that
 * the brand would otherwise be squeezed -- and then the box overflows its
 * column rather than cutting a letter, which is the whole point.
 */
export function lockupBoxWidth(availableWidth: number, lines: BrandLine[]): number {
  const widest = lines.reduce((max, line) => Math.max(max, requiredBoxWidth(line)), 0);
  return Math.max(Math.round(availableWidth), widest);
}

/**
 * Typography of the splash / boot lockup.
 *
 * One source of truth on purpose: the box arithmetic below and the text the
 * components actually render have to agree, or the guarantee is void -- a
 * surface that quietly bumps its font size back over the box re-opens the
 * original bug with nothing to catch it.
 */
export const BOOT_WORDMARK = { fontSize: 17, letterSpacing: 3.4 } as const;
export const BOOT_TAGLINE = { fontSize: 9, letterSpacing: 2.2 } as const;

/** The lines the splash and boot screen render, at the sizes above. */
export function bootLockupLines(): BrandLine[] {
  return [
    { text: BRAND_WORDMARK, ...BOOT_WORDMARK, mono: true },
    { text: BRAND_TAGLINE, ...BOOT_TAGLINE, mono: true },
  ];
}
