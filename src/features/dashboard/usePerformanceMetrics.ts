import { useMemo } from 'react';
import { calculateConsistencyScore, calculateRMultiple } from '../../utils/financials';
import type { Trade } from '../../types/domain';

export interface StreakInfo {
  current: number;
  best: number;
  type: 'win' | 'loss' | 'none';
}

export interface PerformanceMetrics {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  netPnL: number;
  avgRMultiple: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  dayWinRate: number;
  recentTrades: Trade[];
  monthlyPerformance: { month: string; pnl: number; count: number; winRate: number }[];
  consistency: { score: number; alert: boolean };
  equityCurve: { tradeIndex: number; pnl: number; date: string }[];
  dailyPnL: { date: string; pnl: number }[];
  streak: StreakInfo;
}

export function usePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
  return useMemo(() => {
    const closedTrades = trades.filter(
      (t): t is Trade & { exit_time: string; pnl: number } =>
        t.pnl !== null
    );
    const openTrades = trades.filter((t) => t.pnl === null);

    const winTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
    const lossTrades = closedTrades.filter((t) => (t.pnl || 0) <= 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;

    const grossProfit = winTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const netPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

    const avgWin = winTrades.length > 0 ? grossProfit / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? grossLoss / lossTrades.length : 0;

    const rMultiples = closedTrades.map((t) =>
      t.r_multiple !== null
        ? t.r_multiple
        : calculateRMultiple({
            direction: t.direction,
            entryPrice: t.entry_price,
            exitPrice: (t.exit_price || t.entry_price) as number,
            stopLoss: t.stop_loss,
          })
    );
    const avgRMultiple =
      rMultiples.length > 0 ? rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length : 0;

    const winClosed = closedTrades.filter(t => (t.pnl || 0) > 0);
    const lossClosed = closedTrades.filter(t => (t.pnl || 0) < 0);

    const bestTrade =
      winClosed.length > 0
        ? winClosed.reduce((best, t) => ((t.pnl || 0) > (best.pnl || 0) ? t : best), winClosed[0])
        : null;
    const worstTrade =
      lossClosed.length > 0
        ? lossClosed.reduce((worst, t) => ((t.pnl || 0) < (worst.pnl || 0) ? t : worst), lossClosed[0])
        : null;

    const consistency = calculateConsistencyScore(
      closedTrades.map((t) => ({ pnl: t.pnl || 0, exit_time: t.exit_time || t.entry_time }))
    );

    let cumPnL = 0;
    let peak = 0;
    let maxDrawdown = 0;

    const equityCurve = closedTrades
      .slice()
      .sort((a, b) => new Date(a.entry_time || 0).getTime() - new Date(b.entry_time || 0).getTime())
      .map((t, i) => {
        cumPnL += (t.pnl || 0);
        if (cumPnL > peak) peak = cumPnL;
        const dd = peak - cumPnL;
        if (dd > maxDrawdown) maxDrawdown = dd;

        return {
          tradeIndex: i + 1,
          pnl: Number(cumPnL.toFixed(2)),
          date: new Date(t.entry_time || 0).toLocaleDateString('fr-FR', {
            month: 'short',
            day: 'numeric',
          }),
        };
      });

    const dailyMap: Record<string, number> = {};
    closedTrades.forEach((t) => {
      const timeStr = t.entry_time || t.exit_time;
      if (timeStr) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          dailyMap[dateKey] = (dailyMap[dateKey] || 0) + (t.pnl || 0);
        }
      }
    });
    const dailyPnL = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => ({ date, pnl: Number(pnl.toFixed(2)) }));

    const greenDays = dailyPnL.filter(d => d.pnl > 0).length;
    const dayWinRate = dailyPnL.length > 0 ? (greenDays / dailyPnL.length) * 100 : 0;

    const monthlyMap: Record<string, { label: string; pnl: number; count: number; wins: number; sortKey: string }> = {};
    closedTrades.forEach((t) => {
      const timeStr = t.entry_time || t.exit_time;
      if (timeStr) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).toUpperCase();
          if (!monthlyMap[sortKey]) {
            monthlyMap[sortKey] = { label: monthLabel, pnl: 0, count: 0, wins: 0, sortKey };
          }
          monthlyMap[sortKey].pnl += (t.pnl || 0);
          monthlyMap[sortKey].count += 1;
          if ((t.pnl || 0) > 0) monthlyMap[sortKey].wins += 1;
        }
      }
    });

    const monthlyPerformance = Object.values(monthlyMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((data) => ({
        month: data.label,
        pnl: Number(data.pnl.toFixed(2)),
        count: data.count,
        winRate: Number(((data.wins / data.count) * 100).toFixed(1)),
      }));

    const recentTrades = [...trades]
      .sort((a, b) => new Date(b.entry_time || 0).getTime() - new Date(a.entry_time || 0).getTime())
      .slice(0, 5);

    const sortedDailyPnL = [...dailyPnL].sort((a, b) => a.date.localeCompare(b.date));

    let currentStreak = 0;
    let bestStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    let streakType: 'win' | 'loss' | 'none' = 'none';

    if (sortedDailyPnL.length > 0) {
      const lastPnl = sortedDailyPnL[sortedDailyPnL.length - 1].pnl;
      streakType = lastPnl > 0 ? 'win' : 'loss';

      for (let i = sortedDailyPnL.length - 1; i >= 0; i--) {
        const p = sortedDailyPnL[i].pnl;
        if (streakType === 'win' && p > 0) currentStreak++;
        else if (streakType === 'loss' && p <= 0) currentStreak++;
        else break;
      }

      for (const day of sortedDailyPnL) {
        if (day.pnl > 0) {
          tempWinStreak++;
          if (tempWinStreak > bestStreak) bestStreak = tempWinStreak;
        } else {
          tempWinStreak = 0;
        }
        if (day.pnl <= 0) {
          tempLossStreak++;
        } else {
          tempLossStreak = 0;
        }
      }
    }

    const streak: StreakInfo = {
      current: currentStreak,
      best: bestStreak,
      type: streakType,
    };

    return {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      openTrades: openTrades.length,
      winCount: winTrades.length,
      lossCount: lossTrades.length,
      winRate: Number(winRate.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2)),
      netPnL: Number(netPnL.toFixed(2)),
      avgRMultiple: Number(avgRMultiple.toFixed(2)),
      bestTrade,
      worstTrade,
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      dayWinRate: Number(dayWinRate.toFixed(2)),
      recentTrades,
      monthlyPerformance,
      consistency,
      equityCurve,
      dailyPnL,
      streak,
    };
  }, [trades]);
}
