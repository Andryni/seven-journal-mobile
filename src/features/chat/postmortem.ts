import type { Trade } from '../../types/domain';
import { maeR, mfeR, captureRatio, isGiveBack, isNearMiss } from '../../utils/excursions';
import { tradeCost } from '../../utils/tradingCosts';

/**
 * The post-mortem of one losing trade, computed entirely on the device.
 *
 * "Why did I lose on XAUUSD?" deserves numbers, not opinion. The journal
 * holds the path of the trade (MAE/MFE excursions), the context (session,
 * mental state), and the costs — the three places a loss actually comes
 * from: stopped inside the noise, gave the move back, or paid the spread.
 *
 * Every finding is a measured fact carrying its value; the model's job is
 * only to sequence them into sentences. Nothing is inferred from a P&L sign
 * alone: each check refuses to speak when its ingredient is missing, so the
 * answer degrades to "the journal does not record that" instead of guessing.
 *
 * Pure and dependency-light — the R-conversions come from the shared
 * excursions module, the same numbers the detail modal displays.
 */

export interface PostMortemFinding {
  /** Machine key for the caller to translate. */
  key:
    | 'stoppedThroughNoise'
    | 'nearMiss'
    | 'giveBack'
    | 'lowCapture'
    | 'costsAteIt'
    | 'noStop'
    | 'revengeTagged'
    | 'noExcursions';
  /** The measured value behind the finding, when one exists. */
  value?: number;
}

export interface PostMortem {
  /** Trade number in the sent window, for the model to reference. */
  n: number | null;
  /** Always a loss — the caller filters; this guards the contract anyway. */
  isLoss: boolean;
  findings: PostMortemFinding[];
  /** Context lines, pre-formatted for quoting. */
  session: string | null;
  mental: string | null;
  /** R values, rounded, null when not derivable. */
  mae: number | null;
  mfe: number | null;
  capture: number | null;
  /** Costs as a share of the loss, 0..1+, when costs are recorded. */
  costShareOfLoss: number | null;
}

export function buildPostMortem(trade: Trade, n: number | null): PostMortem {
  const isLoss = (trade.pnl ?? 0) < 0;
  const findings: PostMortemFinding[] = [];

  const mae = maeR(trade);
  const mfe = mfeR(trade);
  const capture = captureRatio(trade);
  const giveBack = isGiveBack(trade);
  const nearMiss = isNearMiss(trade);

  // The stop story: did the trade die inside the noise, or survive it?
  if (mae !== null && mae >= 1) {
    findings.push({ key: 'stoppedThroughNoise', value: mae });
  } else if (nearMiss) {
    findings.push({ key: 'nearMiss', value: mae ?? undefined });
  }

  // The exit story: was there money on the table that came back?
  if (giveBack) {
    findings.push({ key: 'giveBack', value: mfe ?? undefined });
  } else if (capture !== null && capture < 0.5 && mfe !== null && mfe >= 1) {
    findings.push({ key: 'lowCapture', value: capture });
  }

  // The cost story: fees meaningful against the loss?
  const costs = tradeCost(trade);
  if (costs !== null && isLoss && (trade.pnl ?? 0) < 0) {
    const share = Math.abs(costs / (trade.pnl ?? 1));
    if (share >= 0.15) findings.push({ key: 'costsAteIt', value: Math.round(share * 100) });
  }

  // Missing prerequisites, stated as such rather than silently skipped.
  if (trade.stop_loss === 0) findings.push({ key: 'noStop' });
  if (mae === null && mfe === null) findings.push({ key: 'noExcursions' });

  // The trader's own verdict, when one exists — quoted, never judged.
  if (trade.mental_state === 'revenge' || trade.mental_state === 'fomo' || trade.mental_state === 'greedy') {
    findings.push({ key: 'revengeTagged' });
  }

  const lossAbs = Math.abs(trade.pnl ?? 0);
  return {
    n,
    isLoss,
    findings,
    session: trade.session ?? null,
    mental: trade.mental_state ?? null,
    mae,
    mfe,
    capture,
    costShareOfLoss:
      costs !== null && lossAbs > 0 ? Math.round((costs / lossAbs) * 100) / 100 : null,
  };
}
