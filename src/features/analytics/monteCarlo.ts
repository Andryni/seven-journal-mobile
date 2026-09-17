/**
 * Monte Carlo simulation over the trader's own R distribution.
 *
 * THE QUESTION IT ANSWERS
 *
 * "Can I pass this challenge?" is not a question about the past — the past is
 * already won or lost. It is a question about the FUTURE, and the only honest
 * way to answer it is to replay that future thousands of times using the
 * trader's own edge: the R multiples they actually produced. The result is
 * not a promise ("you will pass") but a distribution ("in 68% of the futures
 * that look like you, the target is reached before the drawdown is"). That
 * framing is the product: no competitor journal shows it, and a trader who
 * sees 12% instead of a vibe trades differently.
 *
 * THE MODEL
 *
 * Each simulated trade samples one R from the trader's realised distribution
 * (bootstrap resampling, with replacement — it preserves fat tails, streaks
 * of behaviour, the actual cost of mistakes; a normal approximation would
 * manufacture confidence the data does not carry). Risk per trade is fixed
 * at `riskPct` of the starting balance, so an R outcome maps to a currency
 * delta. A path ends when the target is hit (pass), the drawdown limit is
 * breached (fail), or the trade budget runs out (timeout).
 *
 * Determinism matters: the RNG is seeded (mulberry32), so the same input
 * yields the same probabilities. Two views of the same edge must never
 * disagree, and the whole engine is unit-testable.
 */

/** One pass/fail/timeout verdict per simulated future. */
export type SimOutcome = 'pass' | 'fail' | 'timeout';

export interface MonteCarloInput {
  /** Realised R multiples of closed trades. Duplicates allowed, as in life. */
  rMultiples: number[];
  /** Balance at the start of the challenge window. */
  startingBalance: number;
  /** Profit target in currency (from start of window). */
  profitTarget: number;
  /** Max drawdown in currency (peak-to-trough from the high-water mark). */
  maxDrawdown: number;
  /** Risk per trade as a percentage of starting balance (e.g. 1 = 1%). */
  riskPct: number;
  /** How many futures to replay. */
  iterations?: number;
  /** Hard trade cap per path, so "pass" cannot take a million trades. */
  maxTrades?: number;
  /** Seed for the deterministic RNG. */
  seed?: number;
}

export interface MonteCarloResult {
  /** Share of paths that hit the target before breaching the drawdown. */
  passRate: number;
  /** Share of paths that breached the drawdown limit. */
  failRate: number;
  /** Share of paths that neither passed nor failed within `maxTrades`. */
  timeoutRate: number;
  /** Median number of trades to reach the target, over passing paths only. */
  medianTradesToPass: number | null;
  /** Median ending balance across all paths. */
  medianEndBalance: number;
  /** Percentiles of the ending-balance distribution. */
  endBalanceP10: number;
  endBalanceP90: number;
  /** How many R samples were actually used — 0 means "cannot simulate". */
  sampleCount: number;
}

/** Rejections that make a simulation meaningless rather than misleading. */
export type MonteCarloBlock =
  | 'not-enough-samples'
  | 'no-target'
  | 'no-drawdown-limit'
  | 'no-risk';

export interface MonteCarloOutcome {
  status: 'ok' | 'blocked';
  reason: MonteCarloBlock | null;
  result: MonteCarloResult | null;
}

/** Minimum realised trades before a distribution is worth resampling. */
export const MIN_SAMPLES = 20;
export const DEFAULT_ITERATIONS = 2000;
export const DEFAULT_MAX_TRADES = 300;

/**
 * mulberry32 — small, fast, well-distributed enough for bootstrap resampling,
 * and fully deterministic for a given seed. Not crypto: nothing here is.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

export function simulateChallenge(input: MonteCarloInput): MonteCarloOutcome {
  const {
    rMultiples,
    startingBalance,
    profitTarget,
    maxDrawdown,
    riskPct,
    iterations = DEFAULT_ITERATIONS,
    maxTrades = DEFAULT_MAX_TRADES,
    seed = 20260917,
  } = input;

  const finiteR = rMultiples.filter(r => Number.isFinite(r));
  if (finiteR.length < MIN_SAMPLES) {
    return { status: 'blocked', reason: 'not-enough-samples', result: null };
  }
  if (!(profitTarget > 0)) {
    return { status: 'blocked', reason: 'no-target', result: null };
  }
  if (!(maxDrawdown > 0)) {
    return { status: 'blocked', reason: 'no-drawdown-limit', result: null };
  }
  if (!(riskPct > 0) || !(startingBalance > 0)) {
    return { status: 'blocked', reason: 'no-risk', result: null };
  }

  const riskAmount = startingBalance * (riskPct / 100);
  const rng = mulberry32(seed);

  let passes = 0;
  let fails = 0;
  const tradesToPass: number[] = [];
  const endBalances: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let balance = startingBalance;
    let peak = startingBalance;
    let outcome: SimOutcome = 'timeout';

    for (let trade = 1; trade <= maxTrades; trade++) {
      // Bootstrap: sample one realised R, apply it at fixed fractional risk.
      const r = finiteR[Math.floor(rng() * finiteR.length)];
      balance += r * riskAmount;
      if (balance > peak) peak = balance;

      if (balance >= startingBalance + profitTarget) {
        outcome = 'pass';
        tradesToPass.push(trade);
        break;
      }
      // Drawdown is peak-to-trough from the running high-water mark — the
      // trailing definition every major prop firm uses.
      if (peak - balance >= maxDrawdown) {
        outcome = 'fail';
        break;
      }
    }

    if (outcome === 'pass') passes++;
    else if (outcome === 'fail') fails++;
    endBalances.push(balance);
  }

  const timeouts = iterations - passes - fails;
  endBalances.sort((a, b) => a - b);
  tradesToPass.sort((a, b) => a - b);

  const round3 = (v: number) => Math.round(v * 1000) / 1000;

  return {
    status: 'ok',
    reason: null,
    result: {
      passRate: round3(passes / iterations),
      failRate: round3(fails / iterations),
      timeoutRate: round3(timeouts / iterations),
      medianTradesToPass: tradesToPass.length
        ? percentile(tradesToPass, 0.5)
        : null,
      medianEndBalance: Math.round(percentile(endBalances, 0.5)),
      endBalanceP10: Math.round(percentile(endBalances, 0.1)),
      endBalanceP90: Math.round(percentile(endBalances, 0.9)),
      sampleCount: finiteR.length,
    },
  };
}
