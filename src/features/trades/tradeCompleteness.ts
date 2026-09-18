import type { Trade } from '../../types/domain';

/**
 * What a trade is actually missing.
 *
 * Imported trades arrive complete on the numbers and empty on the context:
 * the broker knows prices, size and P&L, but nothing about why the trade was
 * taken or how the trader felt. promote_sync_trades still has to satisfy the
 * NOT NULL and CHECK constraints, so it seeds mental_state with 'focused' and
 * timeframe with 'M15'.
 *
 * That seeding is necessary but corrosive: a seeded 'focused' looks exactly
 * like a chosen one, so "my focused trades" silently pools assessed trades
 * with never-assessed imports, and the timeframe breakdown inherits an
 * invented M15. The more the bridge syncs, the more the behavioural
 * statistics dissolve into filler.
 *
 * `seeded_fields` records the invention at write time. Everything here reads
 * it rather than guessing, because after the fact the two are identical.
 *
 * Pure and dependency-free: the chat, the queue and the analytics layer all
 * need the same answer, and it has to be testable on its own.
 */

export type ContextField = 'mental_state' | 'timeframe' | 'setup' | 'notes' | 'tags';

/** Fields a broker feed can never supply. */
export const CONTEXT_FIELDS: ContextField[] = [
  'mental_state',
  'timeframe',
  'setup',
  'notes',
  'tags',
];

function seeded(trade: Trade): Set<string> {
  return new Set(Array.isArray(trade.seeded_fields) ? trade.seeded_fields : []);
}

/** True when the trade came from the broker bridge rather than the form. */
export function isImported(trade: Trade): boolean {
  return Boolean(trade.sync_source_id) || seeded(trade).size > 0;
}

function hasSetup(trade: Trade): boolean {
  return (
    (trade.setup_structures?.length ?? 0) > 0 ||
    Boolean(trade.setup_fvg) ||
    Boolean(trade.setup_ob) ||
    Boolean(trade.setup_liquidity_sweep)
  );
}

/**
 * Whether one context field carries a real answer.
 *
 * A field is missing when it was seeded at promotion OR when it is simply
 * empty. Both are "the trader has not said", which is the question every
 * caller is really asking.
 */
export function isFieldFilled(trade: Trade, field: ContextField): boolean {
  if (seeded(trade).has(field)) return false;

  switch (field) {
    case 'mental_state':
      return Boolean(trade.mental_state);
    case 'timeframe':
      return Boolean(trade.timeframe);
    case 'setup':
      return hasSetup(trade);
    case 'notes':
      return Boolean(trade.notes && trade.notes.trim().length > 0);
    case 'tags':
      return (trade.tags?.length ?? 0) > 0;
    default:
      return true;
  }
}

/** Context fields this trade is still missing, in a stable order. */
export function missingFields(trade: Trade): ContextField[] {
  return CONTEXT_FIELDS.filter(f => !isFieldFilled(trade, f));
}

/**
 * 0..1 over the context fields only.
 *
 * Prices are excluded on purpose: the bridge always supplies them, so
 * including them would make every import look 60% complete and flatter the
 * number that is supposed to prompt action.
 */
export function completeness(trade: Trade): number {
  const filled = CONTEXT_FIELDS.filter(f => isFieldFilled(trade, f)).length;
  return Math.round((filled / CONTEXT_FIELDS.length) * 100) / 100;
}

export interface CompletenessReport {
  total: number;
  /** Trades with at least one missing context field. */
  incomplete: number;
  /** Trades whose mental_state is real — the honest denominator. */
  assessed: number;
  /** How many trades each field is missing from. */
  byField: Record<ContextField, number>;
  /** Incomplete trades, worst first, then most recent. */
  worst: Trade[];
}

/**
 * Audit a set of trades.
 *
 * `assessed` is the figure that matters: it is the real sample size behind
 * any mental-state statistic, and it is usually smaller than the trade count
 * once the bridge has been running.
 */
export function auditCompleteness(trades: Trade[], worstLimit = 10): CompletenessReport {
  const byField = CONTEXT_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f]: 0 }),
    {} as Record<ContextField, number>
  );

  const incompleteTrades: Trade[] = [];
  let assessed = 0;

  for (const trade of trades) {
    const missing = missingFields(trade);
    for (const f of missing) byField[f] += 1;
    if (missing.length > 0) incompleteTrades.push(trade);
    if (isFieldFilled(trade, 'mental_state')) assessed += 1;
  }

  const worst = incompleteTrades
    .slice()
    .sort((a, b) => {
      const diff = missingFields(b).length - missingFields(a).length;
      if (diff !== 0) return diff;
      const ta = new Date(a.exit_time || a.entry_time || 0).getTime();
      const tb = new Date(b.exit_time || b.entry_time || 0).getTime();
      return tb - ta;
    })
    .slice(0, worstLimit);

  return {
    total: trades.length,
    incomplete: incompleteTrades.length,
    assessed,
    byField,
    worst,
  };
}
