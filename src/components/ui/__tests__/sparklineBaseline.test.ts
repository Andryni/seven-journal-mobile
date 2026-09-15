/**
 * The rule the Sparkline uses to pick green or red.
 *
 * Reported bug: the dashboard hero showed a green net P&L, a win rate above
 * 50% and a positive expectancy, yet its sparkline was red.
 *
 * Cause: the colour came from `last - first`. On a cumulative P&L curve the
 * first point is already the result of trade one, so a book whose best trade
 * came first reads as "declining" even while its total is firmly positive.
 * A cumulative curve has to be judged against zero, not against itself.
 */

/** Mirrors the expression in Sparkline.tsx. */
function sparklineNet(data: number[], baseline?: number): number {
  return data.length ? data[data.length - 1] - (baseline ?? data[0]) : 0;
}

const isGreen = (data: number[], baseline?: number) => sparklineNet(data, baseline) >= 0;

describe('sparkline colour — cumulative curves (baseline 0)', () => {
  it('is green for the reported case: profitable book whose first trade was the biggest win', () => {
    // Trades +100, -10, +20, -15 -> total +95, win rate 50%, expectancy
    // +23.75/trade. The curve peaks at its first point and ends below it.
    const equity = [100, 90, 110, 95];
    expect(isGreen(equity)).toBe(false); // the bug
    expect(isGreen(equity, 0)).toBe(true); // the fix
  });

  it('is green whenever the cumulative total is positive', () => {
    expect(isGreen([50, 30, 130], 0)).toBe(true);
    expect(isGreen([10], 0)).toBe(true);
    expect(isGreen([200, 150, 20], 0)).toBe(true);
  });

  it('is red whenever the cumulative total is negative', () => {
    expect(isGreen([-10, -50, -30], 0)).toBe(false);
    expect(isGreen([100, 50, -20], 0)).toBe(false);
  });

  it('treats an exactly flat book as green rather than a loss', () => {
    expect(isGreen([0], 0)).toBe(true);
    expect(isGreen([50, -20, 0], 0)).toBe(true);
  });

  it('ignores the shape of the curve and only reads its end', () => {
    // Deep drawdown mid-run, recovered: still a winning book.
    expect(isGreen([100, -200, 40], 0)).toBe(true);
    // Strong start given entirely back: still a losing book.
    expect(isGreen([300, 100, -5], 0)).toBe(false);
  });
});

describe('sparkline colour — level series keep the first-point default', () => {
  it('reads a rising series as green', () => {
    // A running win rate climbing 40% -> 55% is an improvement, even though
    // both points are positive numbers. Zero would be meaningless here.
    expect(isGreen([40, 48, 55])).toBe(true);
  });

  it('reads a falling series as red even when every value is positive', () => {
    expect(isGreen([70, 62, 55])).toBe(false);
  });
});

describe('sparkline colour — edge cases', () => {
  it('is green for an empty series rather than alarming', () => {
    expect(isGreen([], 0)).toBe(true);
    expect(isGreen([])).toBe(true);
  });

  it('accepts a non-zero baseline, e.g. a starting balance', () => {
    const balance = [10_200, 10_050, 10_400];
    expect(isGreen(balance, 10_000)).toBe(true);
    expect(isGreen(balance, 10_500)).toBe(false);
  });
});

/**
 * KPI sparklines on the dashboard.
 *
 * Reported twice: a 57% win rate and a positive expectancy both showed red
 * sparklines. The hero curve had already been fixed, but the four KPI
 * sparklines go through Metric, which passed no baseline at all.
 *
 * Their first point is the metric after ONE closed trade -- a win rate of 0
 * or 100, an expectancy equal to that trade's P&L. Comparing against it makes
 * almost any real history look like a decline.
 */
describe('KPI sparklines are judged against what the metric means', () => {
  // Trades +80 -20 +60 -10 +90 -30 +70: 4W/3L, cumulative +240.
  const winRate = [100, 50, 66.7, 50, 60, 50, 57.1];
  const expectancy = [80, 30, 40, 27.5, 40, 28.3, 34.3];
  const profitFactor = [1, 4, 7, 4.67, 10, 4.5, 6];

  it('calls a 57% win rate green, not red', () => {
    expect(isGreen(winRate)).toBe(false); // the bug
    expect(isGreen(winRate, 50)).toBe(true); // baseline = break-even rate
  });

  it('calls a losing win rate red even when it improved from a bad start', () => {
    // 0% then climbing to 40% is progress, but 40% is still below break-even.
    expect(isGreen([0, 25, 33, 40], 50)).toBe(false);
  });

  it('calls a positive expectancy green, not red', () => {
    expect(isGreen(expectancy)).toBe(false); // the bug
    expect(isGreen(expectancy, 0)).toBe(true);
  });

  it('calls a negative expectancy red', () => {
    expect(isGreen([-5, -30, -12], 0)).toBe(false);
  });

  it('judges profit factor against 1, the break-even ratio', () => {
    expect(isGreen(profitFactor, 1)).toBe(true);
    // Below 1 the book loses more than it makes, however the curve moved.
    expect(isGreen([0.2, 0.4, 0.8], 1)).toBe(false);
  });

  it('treats an exactly break-even metric as green rather than a loss', () => {
    expect(isGreen([70, 60, 50], 50)).toBe(true);
    expect(isGreen([10, 5, 1], 1)).toBe(true);
  });

  it('inverts correctly for drawdown, where rising is bad', () => {
    // Metric negates the series for inverted metrics, and must negate the
    // baseline with it or the comparison is against the wrong sign.
    const drawdown = [10, 40, 90];
    const negated = drawdown.map(v => -v);
    expect(isGreen(negated, -0)).toBe(false); // growing drawdown = red
    expect(isGreen([0, 0, 0].map(v => -v), -0)).toBe(true); // no drawdown = green
  });
});
