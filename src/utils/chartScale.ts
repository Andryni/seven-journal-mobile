/**
 * Chart scale helpers: axis ticks, downsampling, and hit-testing.
 *
 * These were previously improvised inside each chart component, which is why
 * no two charts agreed on anything. The equity chart hardcoded `Math.max(10,
 * ...)` as its top value, so a book that never exceeded $10 got an axis three
 * times taller than its data; others simply labelled min and max, producing
 * axis values like "$1,247.33" that no one can read at a glance.
 *
 * Kept deliberately free of React so the arithmetic can be unit-tested.
 */

/**
 * "Nice" numbers for axis steps: 1, 2, 2.5, 5, 10 and their powers. This is
 * the standard set because those are the intervals people can divide mentally.
 */
function niceStep(rawStep: number): number {
  if (rawStep <= 0 || !Number.isFinite(rawStep)) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = Math.pow(10, exponent);
  const residual = rawStep / magnitude;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  return nice * magnitude;
}

export interface AxisScale {
  min: number;
  max: number;
  ticks: number[];
  /** Maps a data value to a 0..1 position, 0 being `min`. */
  normalize: (value: number) => number;
}

/**
 * Builds an axis that contains every value, snapped outwards to round numbers.
 *
 * Always includes zero for signed data: a P&L axis that starts at 1,200 makes
 * a flat-but-profitable month look like a rocket, which is exactly the kind of
 * flattery a trading journal must not produce.
 */
export function buildAxis(values: number[], targetTicks = 4): AxisScale {
  const finite = values.filter(v => Number.isFinite(v));
  if (finite.length === 0) {
    return { min: 0, max: 1, ticks: [0, 1], normalize: () => 0 };
  }

  let lo = Math.min(...finite, 0);
  let hi = Math.max(...finite, 0);

  if (lo === hi) {
    // A flat series still needs a band to be drawn in.
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.5 : 1;
    lo -= pad;
    hi += pad;
  }

  const step = niceStep((hi - lo) / Math.max(targetTicks, 1));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  // Accumulate with an index rather than `+= step` so float drift does not
  // turn 0.30000000000000004 into a visible axis label.
  const count = Math.round((max - min) / step);
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round((min + i * step) * 1e6) / 1e6);
  }

  const span = max - min || 1;
  return {
    min,
    max,
    ticks,
    normalize: (value: number) => (value - min) / span,
  };
}

/**
 * Reduces a series to at most `maxPoints`, preserving first and last.
 *
 * Plotting 900 points into 300 pixels costs three SVG nodes per pixel and
 * renders as a solid block; the shape is carried by far fewer.
 */
export function downsample<T>(series: T[], maxPoints: number): T[] {
  if (maxPoints < 2 || series.length <= maxPoints) return series;
  const step = (series.length - 1) / (maxPoints - 1);
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(series[Math.round(i * step)]);
  }
  out[out.length - 1] = series[series.length - 1];
  return out;
}

/**
 * Index of the point nearest a touch X, for scrubbing.
 *
 * Returns the closest point rather than the one under the finger: with a
 * finger ~44px wide over points 6px apart, "under" is meaningless, and
 * requiring a direct hit is why the old tap targets felt unresponsive.
 */
export function nearestIndex(touchX: number, width: number, count: number): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  const clamped = Math.max(0, Math.min(width, touchX));
  const ratio = width > 0 ? clamped / width : 0;
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}

/**
 * Catmull-Rom smoothing expressed as cubic beziers.
 *
 * The charts used a midpoint-handle curve whose control points ignored the
 * neighbouring samples, so every local extreme overshot: a single spike made
 * the curve dip below an axis the data never crossed. Catmull-Rom passes
 * through every point and derives its tangents from the actual neighbours.
 */
export function smoothPath(points: { x: number; y: number }[], tension = 0.5): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

const round = (n: number) => Math.round(n * 100) / 100;
