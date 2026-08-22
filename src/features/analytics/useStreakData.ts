import { useMemo } from 'react';
import type { Trade } from '../../types/domain';

export interface StreakData {
  currentStreak: number;
  currentType: 'win' | 'loss' | 'none';
  bestWinStreak: number;
  bestLossStreak: number;
  totalWins: number;
  totalLosses: number;
  avgStreakLength: number;
}

export function useStreakData(closed: Trade[]): StreakData {
  return useMemo(() => {
    if (closed.length === 0) {
      return {
        currentStreak: 0,
        currentType: 'none',
        bestWinStreak: 0,
        bestLossStreak: 0,
        totalWins: 0,
        totalLosses: 0,
        avgStreakLength: 0,
      };
    }

    let currentStreak = 0;
    let currentType: 'win' | 'loss' | 'none' = 'none';
    let bestWinStreak = 0;
    let bestLossStreak = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let streakCount = 0;
    let totalStreakLength = 0;

    // Iterate from most recent (index 0) to oldest
    for (let i = 0; i < closed.length; i++) {
      const t = closed[i];
      const isWin = t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && (t.pnl || 0) > 0);
      const isLoss = t.result === 'SL' || (t.result !== 'TP' && t.result !== 'BE' && (t.pnl || 0) < 0);

      const type = isWin ? 'win' : isLoss ? 'loss' : 'none';

      if (i === 0) {
        // First trade (most recent)
        currentType = type;
        currentStreak = 1;
      } else if (type === currentType && type !== 'none') {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }

    // Calculate best streaks + total wins/losses (full pass)
    let tempStreak = 0;
    let tempType: 'win' | 'loss' | 'none' = 'none';
    for (const t of closed) {
      const isWin = t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && (t.pnl || 0) > 0);
      const isLoss = t.result === 'SL' || (t.result !== 'TP' && t.result !== 'BE' && (t.pnl || 0) < 0);
      if (isWin) totalWins++;
      if (isLoss) totalLosses++;
      const type = isWin ? 'win' : isLoss ? 'loss' : 'none';

      if (type === tempType && type !== 'none') {
        tempStreak++;
      } else {
        if (tempType === 'win' && tempStreak > bestWinStreak) bestWinStreak = tempStreak;
        if (tempType === 'loss' && tempStreak > bestLossStreak) bestLossStreak = tempStreak;
        if (tempType !== 'none') {
          streakCount++;
          totalStreakLength += tempStreak;
        }
        tempType = type;
        tempStreak = type !== 'none' ? 1 : 0;
      }
    }
    // Final streak
    if (tempType === 'win' && tempStreak > bestWinStreak) bestWinStreak = tempStreak;
    if (tempType === 'loss' && tempStreak > bestLossStreak) bestLossStreak = tempStreak;
    if (tempType !== 'none') {
      streakCount++;
      totalStreakLength += tempStreak;
    }

    return {
      currentStreak,
      currentType,
      bestWinStreak,
      bestLossStreak,
      totalWins,
      totalLosses,
      avgStreakLength: streakCount > 0 ? totalStreakLength / streakCount : 0,
    };
  }, [closed]);
}
