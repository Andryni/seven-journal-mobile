import { useMemo } from 'react';
import type { Trade } from '../../types/domain';

export interface DisciplineComponent {
  id: 'risk' | 'plan' | 'sizing' | 'revenge';
  /** 0–100 */
  score: number;
  /** Human-readable detail, e.g. "3 trades hors plan" */
  detail: string;
}

export interface DisciplineResult {
  /** 0–100 composite. */
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  components: DisciplineComponent[];
  sampleSize: number;
}

/**
 * Discipline Score — replaces the 13-badge achievement wall.
 *
 * Rationale: a prop-firm trader does not want trophies, they want a number
 * telling them whether their *process* held. Unlike P&L (which luck moves),
 * every component here is fully under the trader's control.
 *
 * Components, equally weighted:
 *  - risk    : share of trades that had a stop loss defined
 *  - plan    : share of trades tagged with a setup (i.e. taken from the playbook)
 *  - sizing  : consistency of position size (low coefficient of variation)
 *  - revenge : absence of tilted mental states (revenge / fomo / greedy)
 */
/**
 * Pure computation, exported separately so it can be unit-tested without
 * mounting a React tree.
 */
export function computeDisciplineScore(trades: Trade[]): DisciplineResult {
  {
    const n = trades.length;
    if (n === 0) {
      return {
        score: 0,
        grade: 'D' as const,
        sampleSize: 0,
        components: [
          { id: 'risk' as const, score: 0, detail: '—' },
          { id: 'plan' as const, score: 0, detail: '—' },
          { id: 'sizing' as const, score: 0, detail: '—' },
          { id: 'revenge' as const, score: 0, detail: '—' },
        ],
      };
    }

    // 1. Risk — a trade without a stop loss is an uncontrolled trade.
    const withStop = trades.filter(t => t.stop_loss && t.stop_loss > 0).length;
    const riskScore = (withStop / n) * 100;

    // 2. Plan — trade must map to a known setup, not an impulse.
    const withSetup = trades.filter(
      t =>
        (t.setup_structures && t.setup_structures.length > 0) ||
        t.setup_fvg ||
        t.setup_ob ||
        t.setup_liquidity_sweep
    ).length;
    const planScore = (withSetup / n) * 100;

    // 3. Sizing — coefficient of variation of position size. A disciplined
    //    trader sizes by risk, so size should be stable. CV 0 => 100,
    //    CV >= 1 (sd as large as the mean) => 0.
    const sizes = trades.map(t => t.size || 0).filter(s => s > 0);
    let sizingScore = 0;
    let cv = 0;
    if (sizes.length > 1) {
      const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      if (mean > 0) {
        const variance = sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length;
        cv = Math.sqrt(variance) / mean;
        sizingScore = Math.max(0, Math.min(100, (1 - cv) * 100));
      }
    } else if (sizes.length === 1) {
      sizingScore = 100;
    }

    // 4. Revenge — tilted states poison the edge.
    const tilted = trades.filter(
      t => t.mental_state === 'revenge' || t.mental_state === 'fomo' || t.mental_state === 'greedy'
    ).length;
    const revengeScore = ((n - tilted) / n) * 100;

    const components: DisciplineComponent[] = [
      { id: 'risk', score: Math.round(riskScore), detail: `${withStop}/${n}` },
      { id: 'plan', score: Math.round(planScore), detail: `${withSetup}/${n}` },
      { id: 'sizing', score: Math.round(sizingScore), detail: `CV ${cv.toFixed(2)}` },
      { id: 'revenge', score: Math.round(revengeScore), detail: `${tilted} tilt` },
    ];

    const score = Math.round(components.reduce((a, c) => a + c.score, 0) / components.length);
    const grade: DisciplineResult['grade'] =
      score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';

    return { score, grade, components, sampleSize: n };
  }
}

export function useDisciplineScore(trades: Trade[]): DisciplineResult {
  return useMemo(() => computeDisciplineScore(trades), [trades]);
}
