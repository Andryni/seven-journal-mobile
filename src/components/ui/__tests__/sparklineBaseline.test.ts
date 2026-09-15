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
