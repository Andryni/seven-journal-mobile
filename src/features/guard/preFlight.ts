/**
 * The pre-flight gate — pure, so the rule can be read and tested on its own.
 *
 * The rule, in one sentence: a trader who has written a checklist must have
 * ticked it before the first trade of their day. Not every trade — the first
 * one is where the discipline is decided, and a gate on every entry would be
 * an obstacle rather than a ritual.
 *
 * Two facts decide it, and both are deliberately explicit:
 *   * an EMPTY checklist never blocks anything. Someone who has not written
 *     one has nothing to confirm, and an app that invents rules for them is an
 *     app that gets uninstalled;
 *   * the day is the trader's LOCAL day. The server stores what the client
 *     sends (see checklist_completions) because "today" is a statement about
 *     their session, not about UTC — the same reasoning as the daily lock.
 */

/** Today's key in the trader's own timezone, as `YYYY-MM-DD`. */
export function localDayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface PreFlightFacts {
  /** How many items the trader has written. */
  itemCount: number;
  /** The local day key of the completion on record, if any. */
  completedOn: string | null;
  /** The local day key of the trade being entered. */
  tradeDay: string;
}

/**
 * Whether the entry must be preceded by the checklist.
 *
 * A completion recorded on ANOTHER day does not count: the ritual is daily, and
 * "I ticked these boxes last Tuesday" is the exact reasoning the checklist
 * exists to interrupt.
 */
export function preFlightRequired(facts: PreFlightFacts): boolean {
  if (facts.itemCount <= 0) return false;
  return facts.completedOn !== facts.tradeDay;
}

/** Whether the form may save, given the gate and what the trader has ticked. */
export function preFlightSatisfied(required: boolean, allTicked: boolean): boolean {
  return !required || allTicked;
}

/**
 * The seeded checklist, for a trader who has never written one.
 *
 * Four items, not ten: a list nobody finishes is a list nobody reads. They are
 * ordered the way a session is actually decided — risk first, then the plan,
 * then the state, then the screen.
 */
export const DEFAULT_PREFLIGHT_KEYS = [
  'preflightDefaultRisk',
  'preflightDefaultPlan',
  'preflightDefaultState',
  'preflightDefaultNews',
] as const;
