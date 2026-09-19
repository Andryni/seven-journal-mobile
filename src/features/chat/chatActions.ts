import type { Trade } from '../../types/domain';
import { normalizeTags } from '../../utils/tradeTags';

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
 *   2. Only additive, reversible context fields. Tags and mental state are
 *      journaling metadata a trader can change freely. Prices, P&L, size and
 *      deletion are absent from the type and therefore unreachable -- the
 *      model cannot propose what it cannot express.
 *   3. Targets are resolved against the trades actually sent, so a
 *      hallucinated trade number resolves to nothing instead of hitting a
 *      real row by accident.
 *
 * Pure and dependency-free: what deserves tests is the resolution and the
 * refusals, not the plumbing.
 */

export type ChatActionKind = 'add_tag' | 'set_mental_state' | 'filter_trades';

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
}

/** Why a proposed action was refused. */
export type ActionRejection =
  | 'unknown_kind'
  | 'no_targets'
  | 'invalid_tag'
  | 'invalid_mental_state'
  | 'too_many_targets';

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
  if (kind !== 'add_tag' && kind !== 'set_mental_state' && kind !== 'filter_trades') {
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
  window: Trade[]
): { ok: true; action: ResolvedAction } | { ok: false; reason: ActionRejection } {
  if (
    action.kind !== 'add_tag' &&
    action.kind !== 'set_mental_state' &&
    action.kind !== 'filter_trades'
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
  // filter_trades changes no data.
  return null;
}

/** Trades a confirmed action would actually modify. */
export function affectedTrades(action: ResolvedAction): Trade[] {
  return action.trades.filter(t => patchFor(action, t) !== null);
}
