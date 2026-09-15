import type { Trade } from '../../types/domain';
import type { PlaybookSetup } from './usePlaybook';

/**
 * Attribution of trades to playbook setups, and the edge stats that follow.
 *
 * The previous matcher was generous to the point of being wrong:
 *
 *   - `notes.includes(title)` matched any mention, including "did NOT take the
 *     London Sweep here", crediting a setup for a trade that avoided it.
 *   - `title.includes('ob')` is a substring test, so "Breakout", "Double Top"
 *     and "Fibonacci" all contain "ob"/"ob"-like fragments and claimed every
 *     order-block trade.
 *   - `if (setups.length === 1) return true` gave a lone setup 100% of trades
 *     regardless of content, so its win rate was just the account win rate
 *     wearing the setup's name.
 *
 * A playbook's whole purpose is to tell you which setup actually pays. Numbers
 * produced by those rules cannot answer that, so they are replaced with
 * explicit, checkable attribution:
 *
 *   1. `setup_structures` contains the setup title (exact, case-insensitive).
 *      This is the field the trade form writes, and it is authoritative.
 *   2. Otherwise, a whole-word title match in the notes.
 *
 * Confirmation flags (FVG / OB / sweep) are NO LONGER used to attribute: they
 * describe what was on the chart, not which plan was being run. They are
 * surfaced separately as a confluence breakdown, where they do mean something.
 */

export interface SetupEdge {
  setup: PlaybookSetup;
  /** Closed trades attributed to this setup. */
  count: number;
  openCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  pnl: number;
  /** Mean P&L per closed trade — the number that decides if a setup stays. */
  expectancy: number;
  profitFactor: number;
  avgR: number;
  bestTrade: number;
  worstTrade: number;
  /** Cumulative P&L after each closed trade, for a sparkline. */
  equity: number[];
  /** True when the sample is too small for the stats to mean anything. */
  lowConfidence: boolean;
  lastTradedAt: string | null;
}

/**
 * Under this many closed trades, a win rate is noise. Ten is already generous
 * — it is the point at which one more loss moves the rate by 10 points — but
 * it keeps the warning honest rather than decorative.
 */
export const MIN_SAMPLE = 10;

const norm = (v: string) => v.toLowerCase().trim();

/** Whole-word, punctuation-tolerant search so "OB" does not match "Breakout". */
export function mentionsSetup(text: string, title: string): boolean {
  const needle = norm(title);
  if (!needle) return false;
  const haystack = norm(text);
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx > 0 ? haystack[idx - 1] : ' ';
  const after =
    idx + needle.length < haystack.length ? haystack[idx + needle.length] : ' ';
  const isWordChar = (c: string) => /[a-z0-9]/.test(c);
  return !isWordChar(before) && !isWordChar(after);
}

export function tradeMatchesSetup(trade: Trade, setup: PlaybookSetup): boolean {
  const title = norm(setup.title);
  if (!title) return false;
  if (trade.setup_structures?.some(st => norm(st) === title)) return true;
  return mentionsSetup(trade.notes || '', setup.title);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeSetupEdge(setup: PlaybookSetup, trades: Trade[]): SetupEdge {
  const matched = trades.filter(t => tradeMatchesSetup(t, setup));
  const closed = matched
    .filter(t => t.pnl !== null)
    .sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());

  const wins = closed.filter(t => (t.pnl as number) > 0);
  const losses = closed.filter(t => (t.pnl as number) < 0);
  const breakeven = closed.filter(t => (t.pnl as number) === 0);

  const pnl = closed.reduce((s, t) => s + (t.pnl as number), 0);
  const grossWin = wins.reduce((s, t) => s + (t.pnl as number), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl as number), 0));

  const rTrades = closed.filter(t => t.r_multiple !== null);
  const avgR =
    rTrades.length > 0
      ? rTrades.reduce((s, t) => s + (t.r_multiple as number), 0) / rTrades.length
      : 0;

  let acc = 0;
  const equity = closed.map(t => {
    acc += t.pnl as number;
    return round2(acc);
  });

  const pnls = closed.map(t => t.pnl as number);

  return {
    setup,
    count: closed.length,
    openCount: matched.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: closed.length > 0 ? round2((wins.length / closed.length) * 100) : 0,
    pnl: round2(pnl),
    expectancy: closed.length > 0 ? round2(pnl / closed.length) : 0,
    // No losses means profit factor is undefined, not infinite; callers render
    // it as a dash rather than a triumphant symbol on a 2-trade sample.
    profitFactor: grossLoss > 0 ? round2(grossWin / grossLoss) : 0,
    avgR: round2(avgR),
    bestTrade: pnls.length > 0 ? round2(Math.max(...pnls)) : 0,
    worstTrade: pnls.length > 0 ? round2(Math.min(...pnls)) : 0,
    equity,
    lowConfidence: closed.length < MIN_SAMPLE,
    lastTradedAt: matched.length > 0
      ? matched.reduce((latest, t) => (t.entry_time > latest ? t.entry_time : latest), matched[0].entry_time)
      : null,
  };
}

export function computeAllSetupEdges(setups: PlaybookSetup[], trades: Trade[]): SetupEdge[] {
  return setups.map(s => computeSetupEdge(s, trades));
}

/**
 * Trades that matched no setup at all. This is the number a playbook should
 * lead with: it is the share of a trader's activity that is off-plan, and the
 * old screen had no way to show it because every trade matched something.
 */
export function computeUnattributed(setups: PlaybookSetup[], trades: Trade[]) {
  const closed = trades.filter(t => t.pnl !== null);
  const off = closed.filter(t => !setups.some(s => tradeMatchesSetup(t, s)));
  const onPlan = closed.length - off.length;
  return {
    total: closed.length,
    offPlan: off.length,
    onPlan,
    offPlanPnl: round2(off.reduce((s, t) => s + (t.pnl as number), 0)),
    onPlanPnl: round2(
      closed.filter(t => setups.some(s => tradeMatchesSetup(t, s)))
        .reduce((s, t) => s + (t.pnl as number), 0)
    ),
    adherencePct: closed.length > 0 ? round2((onPlan / closed.length) * 100) : 0,
  };
}

/**
 * Confluence breakdown: how the chart-pattern flags actually perform. These
 * used to be abused for attribution; here they answer their own question —
 * "does tagging an FVG correlate with making money?".
 */
export interface ConfluenceStat {
  id: 'fvg' | 'ob' | 'sweep';
  count: number;
  winRate: number;
  pnl: number;
}

export function computeConfluence(trades: Trade[]): ConfluenceStat[] {
  const closed = trades.filter(t => t.pnl !== null);
  const build = (id: ConfluenceStat['id'], pick: (t: Trade) => boolean): ConfluenceStat => {
    const subset = closed.filter(pick);
    const w = subset.filter(t => (t.pnl as number) > 0).length;
    return {
      id,
      count: subset.length,
      winRate: subset.length > 0 ? round2((w / subset.length) * 100) : 0,
      pnl: round2(subset.reduce((s, t) => s + (t.pnl as number), 0)),
    };
  };
  return [
    build('fvg', t => !!t.setup_fvg),
    build('ob', t => !!t.setup_ob),
    build('sweep', t => !!t.setup_liquidity_sweep),
  ];
}
