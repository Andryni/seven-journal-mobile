import { buildAxis, downsample, nearestIndex, smoothPath } from '../chartScale';

describe('buildAxis', () => {
  it('snaps the range outwards to round numbers', () => {
    const a = buildAxis([0, 1247.33]);
    expect(a.max).toBeGreaterThanOrEqual(1247.33);
    expect(a.min).toBeLessThanOrEqual(0);
    // Every tick should be a number a human would write down.
    for (const t of a.ticks) {
      expect(Number.isInteger(t / (a.ticks[1] - a.ticks[0]))).toBe(true);
    }
  });

  it('always includes zero so gains are not visually exaggerated', () => {
    // An axis starting at 1200 makes a flat month look like a breakout.
    const a = buildAxis([1200, 1210, 1225]);
    expect(a.min).toBeLessThanOrEqual(0);
    expect(a.ticks).toContain(0);
  });

  it('spans negative and positive data', () => {
    const a = buildAxis([-320, 540]);
    expect(a.min).toBeLessThanOrEqual(-320);
    expect(a.max).toBeGreaterThanOrEqual(540);
    expect(a.ticks).toContain(0);
  });

  it('gives a flat series a band instead of a zero-height axis', () => {
    const a = buildAxis([500, 500, 500]);
    expect(a.max).toBeGreaterThan(a.min);
    expect(Number.isFinite(a.normalize(500))).toBe(true);
  });

  it('handles an all-zero series without dividing by zero', () => {
    const a = buildAxis([0, 0]);
    expect(a.max).toBeGreaterThan(a.min);
    expect(a.normalize(0)).toBeGreaterThanOrEqual(0);
  });

  it('returns a usable default for an empty series', () => {
    const a = buildAxis([]);
    expect(a.ticks.length).toBeGreaterThanOrEqual(2);
    expect(a.normalize(0)).toBe(0);
  });

  it('ignores NaN and Infinity rather than producing a broken axis', () => {
    const a = buildAxis([100, NaN, Infinity, 200]);
    expect(Number.isFinite(a.min)).toBe(true);
    expect(Number.isFinite(a.max)).toBe(true);
    expect(a.max).toBeGreaterThanOrEqual(200);
  });

  it('normalizes min to 0 and max to 1', () => {
    const a = buildAxis([0, 100]);
    expect(a.normalize(a.min)).toBeCloseTo(0);
    expect(a.normalize(a.max)).toBeCloseTo(1);
  });

  it('does not emit float-drift labels like 0.30000000000000004', () => {
    const a = buildAxis([0, 1]);
    for (const t of a.ticks) {
      expect(String(t).length).toBeLessThan(8);
    }
  });
});

describe('downsample', () => {
  it('leaves a short series untouched', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('caps a long series at maxPoints', () => {
    const many = Array.from({ length: 900 }, (_, i) => i);
    const out = downsample(many, 60);
    expect(out).toHaveLength(60);
  });

  it('always keeps the first and last sample', () => {
    const many = Array.from({ length: 501 }, (_, i) => i);
    const out = downsample(many, 40);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(500);
  });

  it('preserves chronological order', () => {
    const many = Array.from({ length: 300 }, (_, i) => i);
    const out = downsample(many, 25);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThan(out[i - 1]);
    }
  });
});

describe('nearestIndex', () => {
  it('snaps to the closest point, not an exact hit', () => {
    // 5 points across 100px => spacing 25px. A touch at 60 is nearest to #2.
    expect(nearestIndex(60, 100, 5)).toBe(2);
  });

  it('clamps a touch that runs past either edge', () => {
    expect(nearestIndex(-40, 100, 5)).toBe(0);
    expect(nearestIndex(9999, 100, 5)).toBe(4);
  });

  it('returns 0 for a single point and -1 for none', () => {
    expect(nearestIndex(50, 100, 1)).toBe(0);
    expect(nearestIndex(50, 100, 0)).toBe(-1);
  });

  it('never returns an out-of-bounds index', () => {
    for (let x = -10; x <= 110; x += 7) {
      const i = nearestIndex(x, 100, 8);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(7);
    }
  });
});

describe('smoothPath', () => {
  it('returns an empty string for no points', () => {
    expect(smoothPath([])).toBe('');
  });

  it('emits a straight line for two points rather than a curve', () => {
    const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    expect(d).toBe('M 0 0 L 10 10');
  });

  it('passes through every data point', () => {
    const pts = [
      { x: 0, y: 50 },
      { x: 10, y: 20 },
      { x: 20, y: 80 },
      { x: 30, y: 40 },
    ];
    const d = smoothPath(pts);
    // Catmull-Rom interpolates, so each point must appear as a curve endpoint.
    expect(d).toContain('M 0 50');
    expect(d).toContain('10 20');
    expect(d).toContain('20 80');
    expect(d).toContain('30 40');
  });

  it('does not overshoot a monotonic series', () => {
    // A rising-only series must never dip below its own minimum: the old
    // midpoint-handle curve did exactly that around spikes.
    const pts = [
      { x: 0, y: 100 },
      { x: 10, y: 90 },
      { x: 20, y: 30 },
      { x: 30, y: 25 },
    ];
    const d = smoothPath(pts);
    const ys = [...d.matchAll(/[-\d.]+ ([-\d.]+)[,]?/g)].map(m => parseFloat(m[1]));
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(105);
    }
  });

  it('produces finite coordinates only', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 5, y: 100 },
      { x: 10, y: 0 },
    ]);
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});

/**
 * Tick label precision.
 *
 * Reported from the APK: the prop-firm drawdown curve read
 * "-$1 / -$1 / +$1 / +$1". Every drawdown point is small and negative, so the
 * axis steps land on halves (-1.5, -1, -0.5, 0) while the chart printed them
 * with zero decimals -- two gridlines carrying the same label, and a top tick
 * claiming 2 where the value is 1.5.
 */
describe('buildAxis — decimals track the step', () => {
  it('needs no decimals when the step is a whole number', () => {
    expect(buildAxis([0, 40, 120]).decimals).toBe(0);
    expect(buildAxis([0, -300, -1200]).decimals).toBe(0);
  });

  it('gives one decimal to a half-unit step', () => {
    const axis = buildAxis([0, -0.3, -0.9, -1.4]);
    expect(axis.decimals).toBeGreaterThanOrEqual(1);
  });

  it('never prints the same label on two adjacent ticks', () => {
    // The exact reported series shape: a handful of sub-unit drawdowns.
    for (const series of [
      [0, -0.3, -0.9, -1.4, -0.6],
      [0, -0.05, -0.12, -0.2],
      [0, -2.4, -1.6, -0.8],
      [0, 0.25, 0.5, 0.75],
    ]) {
      const axis = buildAxis(series);
      const labels = axis.ticks.map(t => t.toFixed(axis.decimals));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('keeps labels faithful to the tick value', () => {
    const axis = buildAxis([0, -0.3, -0.9, -1.4]);
    for (const tick of axis.ticks) {
      // Rounding must not move a label onto a different number.
      expect(Math.abs(Number(tick.toFixed(axis.decimals)) - tick)).toBeLessThan(0.001);
    }
  });

  it('caps decimals so a tiny scale cannot produce unreadable labels', () => {
    expect(buildAxis([0, -0.00001]).decimals).toBeLessThanOrEqual(4);
  });

  it('reports decimals on the empty-series fallback too', () => {
    expect(buildAxis([]).decimals).toBe(0);
  });
});
