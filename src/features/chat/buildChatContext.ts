import type { Trade, TradingAccount } from '../../types/domain';
import { classifyPnl } from '../../utils/tradeOutcome';
import { isSameLocalDay, localDayKey } from '../../utils/formatDate';

/**
 * The snapshot of the journal sent with a chat message.
 *
 * TWO DECISIONS ARE ENCODED HERE, and both were judgement calls.
 *
 * 1. The model receives REAL trades, not just ratios.
 *
 *    The existing summary sends anonymous finding ids and percentages, which
 *    is right for a one-shot briefing. A conversation cannot work that way:
 *    "why do my Friday shorts lose" is unanswerable without the trades. So
 *    this sends instrument, direction, R, session, timeframe, mental state
 *    and tags.
 *
 *    What it still never sends: entry and exit PRICES, stop and target
 *    levels, account balances, position sizes in currency, screenshots, and
 *    free-text notes. Prices and sizes identify a broker account; notes are
 *    a diary and frequently mention people. None of it is needed to reason
 *    about behaviour -- R multiples carry the risk story, which is the part
 *    that matters.
 *
 * 2. Every number is COMPUTED HERE, never by the model.
 *
 *    The system prompt forbids arithmetic and the aggregates below are
 *    precomputed, because a model asked for a win rate will produce a
 *    confident wrong one. A chat that says 58% while the dashboard says 61%
 *    destroys trust in both. The model interprets; the app counts.
 *
 * Pure and dependency-free so the redaction rules are unit-testable: what is
 * omitted matters more than what is included.
 */

/** A trade as the model sees it. */
export interface ChatTrade {
  /** Position in the sent window, so the model can refer to "trade 3". */
  n: number;
  pair: string;
  dir: 'BUY' | 'SELL';
  /** Local date only; the time of day travels separately as `hour`. */
  date: string;
  hour: number | null;
  weekday: number;
  /** Net result, in the account currency. */
  pnl: number;
  r: number | null;
  outcome: 'win' | 'loss' | 'flat';
  /** Stated exit reason (TP / SL / BE / MANUAL), not inferred from P&L. */
  result: string | null;
  timeframe: string | null;
  session: string | null;
  mental: string | null;
  tags: string[];
  /** Minutes held, which is where "scalp" claims get tested. */
  heldMinutes: number | null;
}

export interface ChatStats {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** Excludes breakeven from the denominator, like every other figure. */
  winRatePct: number;
  netPnl: number;
  grossWin: number;
  grossLoss: number;
  profitFactor: number | null;
  avgR: number | null;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
  currency: string;
}

export interface ChatContext {
  v: 2;
  locale: string;
  accountType: string | null;
  stats: ChatStats;
  trades: ChatTrade[];
  /** Set when the user opened the chat from one specific trade. */
  focusTradeN: number | null;
  /**
   * The active account as the model may discuss it, v2.
   *
   * "Do I still have room to trade today" and "how far into the challenge
   * am I" are account questions, and v1 could not answer either: it carried
   * only the account type string. Everything here is a figure the dashboard
   * already displays -- no balance, no position sizes, no new exposure.
   */
  account: ChatAccount | null;
}

export interface ChatAccount {
  /** Display name, e.g. "FTMO 50K". The model refers to it by this. */
  name: string;
  type: string;
  currency: string;
  /** Realised P&L of the local day, the figure the risk gauge shows. */
  todayPnl: number;
  /** Daily loss limit in currency, when one is configured. */
  dailyLossLimit: number | null;
  /** Currency still riskable today before the limit; null without a limit. */
  dailyRemaining: number | null;
  /** Whether the rule engine has locked the session. */
  isLocked: boolean;
  /** Profit target progress, 0..1, when a target is set. */
  profitTargetProgress: number | null;
  /** Drawdown consumed, 0..1, when a max drawdown is set. */
  drawdownUsedPct: number | null;
  /** Largest single-day gain, for the consistency rule, in currency. */
  bestDayPnl: number | null;
}

/**
 * How many trades travel with a message.
 *
 * Enough for a pattern to be visible, small enough to stay well inside the
 * token budget and to keep the payload reviewable by eye.
 */
export const MAX_CHAT_TRADES = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

function minutesHeld(t: Trade): number | null {
  if (!t.entry_time || !t.exit_time) return null;
  const a = new Date(t.entry_time).getTime();
  const b = new Date(t.exit_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

export function toChatTrade(trade: Trade, n: number): ChatTrade {
  const entry = trade.entry_time ? new Date(trade.entry_time) : null;
  const valid = entry && Number.isFinite(entry.getTime());
  const pnl = trade.pnl ?? 0;

  return {
    n,
    pair: trade.pair ?? '',
    dir: trade.direction,
    date: valid ? (entry as Date).toISOString().slice(0, 10) : '',
    hour: valid ? (entry as Date).getHours() : null,
    weekday: valid ? (entry as Date).getDay() : -1,
    pnl: r2(pnl),
    r: trade.r_multiple ?? null,
    // classifyPnl also has an 'open' case; closed trades only reach here, and
    // a null P&L would already have been filtered out upstream.
    outcome: (() => {
      const k = classifyPnl(pnl);
      return k === 'win' || k === 'loss' ? k : 'flat';
    })(),
    result: trade.result ?? null,
    timeframe: trade.timeframe ?? null,
    session: trade.session ?? null,
    mental: trade.mental_state ?? null,
    tags: Array.isArray(trade.tags) ? trade.tags.filter(Boolean).slice(0, 6) : [],
    heldMinutes: minutesHeld(trade),
  };
}

export function computeChatStats(closed: Trade[], currency: string): ChatStats {
  const pnls = closed.map(t => t.pnl ?? 0);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);
  const breakeven = pnls.filter(p => p === 0).length;

  const grossWin = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const decided = wins.length + losses.length;

  const rValues = closed
    .map(t => t.r_multiple)
    .filter((r): r is number => r !== null && r !== undefined && Number.isFinite(r));

  // Peak-to-trough on the cumulative curve, in closing order.
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of [...closed].sort(
    (a, b) =>
      new Date(a.exit_time || a.entry_time || 0).getTime() -
      new Date(b.exit_time || b.entry_time || 0).getTime()
  )) {
    cum += t.pnl ?? 0;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRatePct: decided > 0 ? r2((wins.length / decided) * 100) : 0,
    netPnl: r2(pnls.reduce((s, p) => s + p, 0)),
    grossWin: r2(grossWin),
    grossLoss: r2(grossLoss),
    // Undefined rather than Infinity when nothing has been lost yet.
    profitFactor: grossLoss > 0 ? r2(grossWin / grossLoss) : null,
    avgR: rValues.length ? r2(rValues.reduce((s, r) => s + r, 0) / rValues.length) : null,
    expectancy: closed.length ? r2(pnls.reduce((s, p) => s + p, 0) / closed.length) : 0,
    bestTrade: pnls.length ? r2(Math.max(...pnls)) : 0,
    worstTrade: pnls.length ? r2(Math.min(...pnls)) : 0,
    maxDrawdown: r2(maxDd),
    currency,
  };
}

/**
 * The active account as the model may discuss it.
 *
 * Pure and null-tolerant: with no account selected the chat runs on every
 * account combined, and the honest payload carries NO account block at all
 * -- a fabricated aggregate of mixed currencies would just invite the model
 * to quote it as one number.
 */
export function buildChatAccount(
  account: TradingAccount | null,
  closed: Trade[],
  isLocked: boolean
): ChatAccount | null {
  if (!account) return null;

  const currency = account.currency || 'USD';
  const todayPnl = r2(
    closed
      .filter(t => isSameLocalDay(t.entry_time))
      .reduce((s, t) => s + (t.pnl ?? 0), 0)
  );

  const limit =
    account.max_daily_loss_limit && account.max_daily_loss_limit > 0
      ? account.max_daily_loss_limit
      : null;
  // Only realised losses consume the allowance, same rule as the pre-trade
  // guard -- the two must never disagree in front of the trader.
  const used = todayPnl < 0 ? Math.abs(todayPnl) : 0;
  const dailyRemaining = limit !== null ? r2(Math.max(0, limit - used)) : null;

  const netPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const target =
    account.profit_target && account.profit_target > 0 ? account.profit_target : null;
  const profitTargetProgress =
    target !== null ? Math.min(1, Math.max(0, netPnl / target)) : null;

  // Peak-to-trough drawdown consumption, walked in closing order exactly
  // like the analytics tab so the two figures can never diverge.
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of [...closed].sort(
    (a, b) =>
      new Date(a.exit_time || a.entry_time || 0).getTime() -
      new Date(b.exit_time || b.entry_time || 0).getTime()
  )) {
    cum += t.pnl ?? 0;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) maxDd = dd;
  }
  const maxDdLimit =
    account.max_drawdown_limit && account.max_drawdown_limit > 0
      ? account.max_drawdown_limit
      : null;
  const drawdownUsedPct = maxDdLimit !== null ? Math.min(1, maxDd / maxDdLimit) : null;

  // Largest realised single-day gain, the number the consistency rule
  // is checked against.
  const byDay = new Map<string, number>();
  for (const t of closed) {
    if (!t.entry_time) continue;
    const d = new Date(t.entry_time);
    if (Number.isNaN(d.getTime())) continue;
    const k = localDayKey(d);
    byDay.set(k, (byDay.get(k) ?? 0) + (t.pnl ?? 0));
  }
  const bestDayPnl = byDay.size ? r2(Math.max(...byDay.values())) : null;

  return {
    name: account.name || 'Account',
    type: account.type,
    currency,
    todayPnl,
    dailyLossLimit: limit !== null ? r2(limit) : null,
    dailyRemaining,
    isLocked,
    profitTargetProgress:
      profitTargetProgress !== null ? Math.round(profitTargetProgress * 100) / 100 : null,
    drawdownUsedPct:
      drawdownUsedPct !== null ? Math.round(drawdownUsedPct * 100) / 100 : null,
    bestDayPnl,
  };
}

export function buildChatContext(params: {
  trades: Trade[];
  account?: TradingAccount | null;
  locale?: string;
  /** Trade the user tapped "ask about this" on, if any. */
  focusTradeId?: string | null;
  /** Whether the rule engine currently locks the session. */
  isLocked?: boolean;
}): ChatContext {
  const { trades, account = null, locale = 'fr', focusTradeId = null, isLocked = false } = params;

  // Open positions have no result to reason about.
  const closed = trades.filter(t => t.pnl !== null && t.pnl !== undefined);

  const ordered = [...closed].sort(
    (a, b) =>
      new Date(b.exit_time || b.entry_time || 0).getTime() -
      new Date(a.exit_time || a.entry_time || 0).getTime()
  );

  /**
   * The focused trade is always included, even when it falls outside the
   * most recent window -- asking about a trade and having it silently
   * dropped would produce a confident answer about the wrong data.
   */
  let window = ordered.slice(0, MAX_CHAT_TRADES);
  if (focusTradeId && !window.some(t => t.id === focusTradeId)) {
    const focused = ordered.find(t => t.id === focusTradeId);
    if (focused) window = [focused, ...window.slice(0, MAX_CHAT_TRADES - 1)];
  }

  const chatTrades = window.map((t, i) => toChatTrade(t, i + 1));
  const focusIndex = focusTradeId
    ? window.findIndex(t => t.id === focusTradeId)
    : -1;

  return {
    v: 2,
    locale,
    accountType: account?.type ?? null,
    // Stats cover the WHOLE history, not just the window: the model must not
    // describe a 60-trade slice as if it were the full record.
    stats: computeChatStats(closed, account?.currency ?? 'USD'),
    trades: chatTrades,
    focusTradeN: focusIndex >= 0 ? focusIndex + 1 : null,
    account: buildChatAccount(account, closed, isLocked),
  };
}
