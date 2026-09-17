import {
  simulateChallenge,
  MIN_SAMPLES,
  DEFAULT_ITERATIONS,
} from '../monteCarlo';

/**
 * The engine decides prop-firm careers, in the sense that a trader who reads
 * "12% pass" on their account either stops or re-risks. So the assertions are
 * about HONESTY of the distribution, not just plumbing: determinism, tail
 * behaviour, and the exact blocking conditions that keep the card from
 * inventing an answer out of three trades.
 */

/** A distribution with a real edge: 55% +1R, 45% -1R, no BEs. */
const EDGE: number[] = Array.from({ length: 100 }, (_, i) => (i % 100 < 55 ? 1 : -1));
/** Risk 1% of 100k = 1k; target 5k; drawdown 4k. */
const BASE = {
  rMultiples: EDGE,
  startingBalance: 100_000,
  profitTarget: 5_000,
  maxDrawdown: 4_000,
  riskPct: 1,
};

describe('simulateChallenge — guards', () => {
  it('refuses to invent a distribution out of too few trades', () => {
    const out = simulateChallenge({ ...BASE, rMultiples: [1, -1, 1, 0.5] });
    expect(out.status).toBe('blocked');
    expect(out.reason).toBe('not-enough-samples');
  });

  it('blocks without a profit target', () => {
    const out = simulateChallenge({ ...BASE, profitTarget: 0 });
    expect(out.status).toBe('blocked');
    expect(out.reason).toBe('no-target');
  });

  it('blocks without a drawdown limit', () => {
    const out = simulateChallenge({ ...BASE, maxDrawdown: null as unknown as number });
    expect(out.status).toBe('blocked');
    expect(out.reason).toBe('no-drawdown-limit');
  });
});

describe('simulateChallenge — behaviour', () => {
  it('is deterministic for a given seed', () => {
    const a = simulateChallenge({ ...BASE, seed: 42 });
    const b = simulateChallenge({ ...BASE, seed: 42 });
    expect(a.result).toEqual(b.result);
  });

  it('gives a positive-edge distribution a majority pass rate', () => {
    // 55% winners at 1:1 payoff — expectancy +0.10R per trade.
    const out = simulateChallenge({ ...BASE, seed: 7 });
    expect(out.status).toBe('ok');
    expect(out.result!.passRate).toBeGreaterThan(0.5);
    expect(out.result!.passRate + out.result!.failRate + out.result!.timeoutRate).toBeCloseTo(1, 3);
  });

  it('gives a negative-edge distribution a dominant fail rate', () => {
    const losers = EDGE.map(r => -r); // 45/100 win rate
    const out = simulateChallenge({ ...BASE, rMultiples: losers, seed: 7 });
    expect(out.status).toBe('ok');
    // A -0.10R expectancy edge still passes 17% of the time — that residual
    // is the honest, uncomfortable part of the output: variance alone can
    // carry a bad edge past a target. It is why the number is shown at all.
    expect(out.result!.failRate).toBeGreaterThan(0.75);
    expect(out.result!.passRate).toBeLessThan(0.25);
  });

  it('passes faster when the edge is large', () => {
    const bigEdge = EDGE.map(r => (r > 0 ? 2 : -0.5)); // 55% +2R, 45% -0.5R
    const out = simulateChallenge({ ...BASE, rMultiples: bigEdge, seed: 7 });
    expect(out.result!.medianTradesToPass).not.toBeNull();
    expect(out.result!.medianTradesToPass!).toBeLessThan(100);
  });

  it('keeps the p10/p90 band on the same side as a breakeven-ish edge', () => {
    // 50/50 payoff-1:1 is expectancy zero; the band should straddle roughly.
    const flat = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    const out = simulateChallenge({ ...BASE, rMultiples: flat, seed: 7 });
    expect(out.result!.endBalanceP10).toBeLessThan(out.result!.medianEndBalance);
    expect(out.result!.endBalanceP90).toBeGreaterThan(out.result!.medianEndBalance);
  });

  it('runs the default iteration count in acceptable time', () => {
    const t0 = Date.now();
    const out = simulateChallenge({ ...BASE });
    const ms = Date.now() - t0;
    expect(out.status).toBe('ok');
    expect(ms).toBeLessThan(2000);
  });
});

describe('simulateChallenge — contract', () => {
  it('documents the minimum sample floor', () => {
    expect(MIN_SAMPLES).toBe(20);
    expect(DEFAULT_ITERATIONS).toBe(2000);
  });
});
