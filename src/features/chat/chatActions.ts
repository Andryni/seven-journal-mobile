import type { Trade } from '../../types/domain';
import { normalizeTags } from '../../utils/tradeTags';
import { rPatchFor } from '../../utils/rDerivation';

/**
 * Actions the coach may PROPOSE.
 *
 * The chat has been read-only until now, and that was the right default: a
 * model that writes to a trading journal is a different responsibility from
 * one that comments on it.
 *
 * Three rules make this safe, and they are structural rather than
 * aspirational:
 *
 *   1. Nothing here executes. Every function returns a described change; the
 *      UI renders it and the user confirms. The model never holds a write.
 *   2. Only additive, reversible fields. Tags and mental state are
 *      journaling metadata a trader can change freely. Prices, P&L, size and
 *      deletion are absent from the type and therefore unreachable -- the
 *      model cannot propose what it cannot express. The one numeric field
 *      allowed, r_multiple, is DERIVED on the device from the trade's own
 *      prices at confirm time: the model names the trades, never the number.
 *   3. Targets are resolved against the trades actually sent, so a
 *      hallucinated trade number resolves to nothing instead of hitting a
 *      real row by accident.
 *
 * Pure and dependency-free: what deserves tests is the resolution and the
 * refusals, not the plumbing.
 */

export type ChatActionKind =
  | 'add_tag'
  | 'set_mental_state'
  | 'filter_trades'
  | 'set_r_multiple'
  | 'set_costs'
  | 'request_broker_fill';

/** Broker-recorded costs, as the shared staging reader normalises them. */
export interface BrokerCosts {
  commission: number;
  swap: number;
}

/** Mental states the schema accepts. A CHECK constraint enforces these. */
export const MENTAL_STATES = [
  'focused',
  'anxious',
  'greedy',
  'revenge',
  'fomo',
  'tired',
] as const;

export type MentalState = (typeof MENTAL_STATES)[number];

export interface ChatAction {
  kind: ChatActionKind;
  /** Trade numbers as they appeared in the sent context, 1-based. */
  tradeNs: number[];
  /** For add_tag. */
  tag?: string;
  /** For set_mental_state. */
  mentalState?: MentalState;
}

export interface ResolvedAction {
  kind: ChatActionKind;
  /** Real trade ids, resolved from the sent window. */
  tradeIds: string[];
  /** The trades themselves, so the confirmation can name them. */
  trades: Trade[];
  tag?: string;
  mentalState?: MentalState;
  /**
   * For set_costs: the broker values, resolved from the staging reader at
   * proposal time. The model never supplies them — it cannot express a
   * number here even if it tried, and the Edge Function whitelist would
   * strip it anyway. Carried so applyAction needs no second lookup.
   */
  costsByTradeId?: Record<string, BrokerCosts>;
}

/** Why a proposed action was refused. */
export type ActionRejection =
  | 'unknown_kind'
  | 'no_targets'
  | 'invalid_tag'
  | 'invalid_mental_state'
  | 'too_many_targets'
  | 'not_derivable'
  | 'not_available';

/**
 * Upper bound on a single proposal.
 *
 * A bulk edit is the point of this feature -- "set the mental state on my
 * twelve imports" is tedious by hand. But an unbounded one is a single tap
 * that rewrites a whole journal, and a confirmation dialog listing 400 trades
 * is not a confirmation any more.
 */
export const MAX_TARGETS = 50;

export function parseAction(raw: unknown): ChatAction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const kind = r.kind;
  if (
    kind !== 'add_tag' &&
    kind !== 'set_mental_state' &&
    kind !== 'filter_trades' &&
    kind !== 'set_r_multiple' &&
    kind !== 'set_costs' &&
    kind !== 'request_broker_fill'
  ) {
    return null;
  }

  const tradeNs = Array.isArray(r.tradeNs)
    ? r.tradeNs
        .map(n => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null))
        .filter((n): n is number => n !== null && n > 0)
    : [];

  const action: ChatAction = { kind, tradeNs };

  if (typeof r.tag === 'string') action.tag = r.tag;
  if (typeof r.mentalState === 'string') {
    action.mentalState = r.mentalState as MentalState;
  }
  return action;
}

/**
 * Turn a proposal into something executable, or say why not.
 *
 * `window` is the exact list of trades sent to the model, in order. Resolving
 * against it is what stops a hallucinated "trade 97" from landing on a real
 * row: if it was not sent, it cannot be targeted.
 */
export function resolveAction(
  action: ChatAction,
  window: Trade[],
  /** Broker costs for set_costs; absent on every other kind. */
  brokerCosts?: Map<string, BrokerCosts>
): { ok: true; action: ResolvedAction } | { ok: false; reason: ActionRejection } {
  if (
    action.kind !== 'add_tag' &&
    action.kind !== 'set_mental_state' &&
    action.kind !== 'filter_trades' &&
    action.kind !== 'set_r_multiple' &&
    action.kind !== 'set_costs' &&
    action.kind !== 'request_broker_fill'
  ) {
    return { ok: false, reason: 'unknown_kind' };
  }

  const seen = new Set<number>();
  const trades: Trade[] = [];
  for (const n of action.tradeNs) {
    if (seen.has(n)) continue;
    seen.add(n);
    const trade = window[n - 1];
    // Silently skipped, not an error: a model naming one trade it cannot see
    // among four it can should still be able to act on the four.
    if (trade) trades.push(trade);
  }

  if (trades.length === 0) return { ok: false, reason: 'no_targets' };
  if (trades.length > MAX_TARGETS) return { ok: false, reason: 'too_many_targets' };

  if (action.kind === 'add_tag') {
    const [tag] = normalizeTags([action.tag ?? '']);
    if (!tag) return { ok: false, reason: 'invalid_tag' };
    return {
      ok: true,
      action: { kind: 'add_tag', tradeIds: trades.map(t => t.id), trades, tag },
    };
  }

  if (action.kind === 'set_mental_state') {
    const state = action.mentalState;
    if (!state || !MENTAL_STATES.includes(state)) {
      return { ok: false, reason: 'invalid_mental_state' };
    }
    return {
      ok: true,
      action: {
        kind: 'set_mental_state',
        tradeIds: trades.map(t => t.id),
        trades,
        mentalState: state,
      },
    };
  }

  if (action.kind === 'set_r_multiple') {
    // The model names the trades; the NUMBER is derived on the device from
    // entry, stop and exit at confirm time. A target that cannot be derived
    // is refused outright: a "fill what you can" would write nothing on
    // half the list while the confirmation dialog claims all of it —
    // silently worse than refusing. A trade that already stores an R is a
    // no-op, exactly like a tag already present: it neither fails the
    // proposal nor gets written twice.
    for (const t of trades) {
      if (t.r_multiple != null && Number.isFinite(t.r_multiple)) continue;
      if (rPatchFor(t) === null) return { ok: false, reason: 'not_derivable' };
    }
    return {
      ok: true,
      action: {
        kind: 'set_r_multiple',
        tradeIds: trades.map(t => t.id),
        trades,
      },
    };
  }

  if (action.kind === 'set_costs') {
    // Every target must have broker data, or the whole proposal is refused:
    // same all-or-nothing rule as set_r_multiple. Values come from the map
    // the device built from the staging table — the model only picked the
    // trades, and could not have typed a number even by hallucination.
    if (!brokerCosts) return { ok: false, reason: 'not_available' };
    const costsByTradeId: Record<string, BrokerCosts> = {};
    for (const t of trades) {
      const c = brokerCosts.get(t.id);
      if (!c) return { ok: false, reason: 'not_available' };
      costsByTradeId[t.id] = c;
    }
    return {
      ok: true,
      action: {
        kind: 'set_costs',
        tradeIds: trades.map(t => t.id),
        trades,
        costsByTradeId,
      },
    };
  }

  if (action.kind === 'request_broker_fill') {
    // The terminal can only rebuild positions it once carried: a manual
    // trade has no staging row, so naming one would promise a fill that can
    // never arrive. Same all-or-nothing discipline as set_costs.
    for (const t of trades) {
      if (!t.sync_source_id) return { ok: false, reason: 'not_available' };
    }
    return {
      ok: true,
      action: { kind: 'request_broker_fill', tradeIds: trades.map(t => t.id), trades },
    };
  }

  return {
    ok: true,
    action: { kind: 'filter_trades', tradeIds: trades.map(t => t.id), trades },
  };
}

/**
 * The patch to apply to one trade.
 *
 * Additive by construction: a tag is merged into the existing list rather
 * than replacing it, so confirming a proposal can never silently drop
 * annotations the trader added by hand.
 */
export function patchFor(action: ResolvedAction, trade: Trade): Partial<Trade> | null {
  if (action.kind === 'add_tag' && action.tag) {
    const existing = normalizeTags(trade.tags ?? []);
    if (existing.includes(action.tag)) return null; // already there: no write
    return { tags: normalizeTags([...existing, action.tag]) };
  }
  if (action.kind === 'set_mental_state' && action.mentalState) {
    if (trade.mental_state === action.mentalState) return null;
    return { mental_state: action.mentalState } as Partial<Trade>;
  }
  if (action.kind === 'set_r_multiple') {
    // Recomputed here, never carried from anywhere: the value the user
    // confirms is the value the device derived from the trade's own prices.
    return rPatchFor(trade);
  }
  if (action.kind === 'set_costs' && action.costsByTradeId) {
    // Never overwrite: a trade with ANY recorded cost was touched by the
    // trader (or the bridge), and the broker's number must not silently
    // replace it. Partially-filled trades therefore no-op, which keeps the
    // confirmation honest without a second dialog per field.
    if (trade.commission != null || trade.swap != null) return null;
    const c = action.costsByTradeId[trade.id];
    if (!c) return null;
    return { commission: c.commission, swap: c.swap } as Partial<Trade>;
  }
  if (action.kind === 'request_broker_fill') {
    // No journal write BY DESIGN: the fill arrives asynchronously from the
    // broker's own rebuild (apply_broker_refresh, gap-only). Returning null
    // here keeps the confirmation counting honest and stops this path from
    // ever logging a write that has not happened yet.
    return null;
  }
  // filter_trades changes no data.
  return null;
}

/** Trades a confirmed action would actually modify. */
export function affectedTrades(action: ResolvedAction): Trade[] {
  return action.trades.filter(t => patchFor(action, t) !== null);
}
