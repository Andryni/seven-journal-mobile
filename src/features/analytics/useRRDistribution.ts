import { useMemo } from 'react';
import type { Trade } from '../../types/domain';

export interface RRBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  wins: number;
  pnl: number;
}

export function useRRDistribution(closed: Trade[]): RRBucket[] {
  return useMemo(() => {
    const buckets: RRBucket[] = [
      { label: '<-2R', min: -Infinity, max: -2, count: 0, wins: 0, pnl: 0 },
      { label: '-2R', min: -2, max: -1.5, count: 0, wins: 0, pnl: 0 },
      { label: '-1R', min: -1.5, max: -0.5, count: 0, wins: 0, pnl: 0 },
      { label: '0R (BE)', min: -0.5, max: 0.5, count: 0, wins: 0, pnl: 0 },
      { label: '+1R', min: 0.5, max: 1.5, count: 0, wins: 0, pnl: 0 },
      { label: '+2R', min: 1.5, max: 2.5, count: 0, wins: 0, pnl: 0 },
      { label: '+3R', min: 2.5, max: 5, count: 0, wins: 0, pnl: 0 },
      { label: '>5R', min: 5, max: Infinity, count: 0, wins: 0, pnl: 0 },
    ];

    for (const t of closed) {
      const r = t.r_multiple ?? 0;
      const pnl = t.pnl ?? 0;
      const isWin = t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && pnl > 0);

      for (const b of buckets) {
        if (r >= b.min && r < b.max) {
          b.count++;
          b.pnl += pnl;
          if (isWin) b.wins++;
          break;
        }
      }
    }

    // Filter out empty buckets
    return buckets.filter(b => b.count > 0);
  }, [closed]);
}
