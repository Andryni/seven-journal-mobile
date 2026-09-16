import { useMemo } from 'react';
import type { Trade, TradingAccount } from '../../types/domain';
import { darkTheme, withAlpha } from '../../theme';
import type { Language } from '../../i18n/translations';
import type { PlaybookSetup } from '../playbook/usePlaybook';
import { formatShortDate, localDayKey } from '../../utils/formatDate';
import {
  accountsWithTrades,
  isAggregateScope,
  hasMixedCurrencies as mixedCurrencies,
} from '../accounts/accountScope';

export type DateRange = 'all' | '7d' | '30d' | '90d';

interface Params {
  trades: Trade[];
  accounts: TradingAccount[];
  playbookSetups: PlaybookSetup[];
  activeAccountId: string | null;
  dateRange: DateRange;
  lang: Language;
  t: (key: never, ...args: unknown[]) => string;
}

/**
 * All Analytics computation, lifted out of AnalyticsScreen.
 *
 * The screen was 1546 lines with ~390 of them being derived state recomputed
 * inline in the component body. Half of those were plain `const` (not even
 * memoised), so every tab switch and every keystroke in the date filter
 * recalculated drawdown curves and every breakdown for the whole history.
 *
 * Extracting it means: the maths is testable, the screen is presentation only,
 * and each derivation memoises on exactly what it depends on.
 */
export function useAnalytics({
  trades,
  accounts,
  playbookSetups,
  activeAccountId,
  dateRange,
  lang,
  t,
}: Params) {
  const closedAll = useMemo(
    () => trades.filter((t: Trade) => t.pnl !== null && (!activeAccountId || t.account_id === activeAccountId)),
    [trades, activeAccountId]
  );

  const closed = useMemo(() => {
    if (dateRange === 'all') return closedAll;
    const now = Date.now();
    const ms = { '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 }[dateRange];
    return closedAll.filter(t => new Date(t.entry_time).getTime() >= now - ms);
  }, [closedAll, dateRange]);

  const selectedAccount = useMemo(() => {
    if (activeAccountId) return accounts.find(a => a.id === activeAccountId);
    return accounts[0];
  }, [accounts, activeAccountId]);

  /**
   * True when figures span more than one account.
   *
   * With no account selected we aggregate every trade, but selectedAccount
   * falls back to accounts[0] -- so the prop-firm limits, the currency symbol
   * and the challenge deadline all came from one arbitrary account while the
   * P&L summed all of them. Worse, accounts can be denominated in different
   * currencies and sized in different units, so the total was adding EUR to
   * USD. Callers must degrade rather than present that as a real number.
   */
  const accountsInScope = useMemo(
    () => accountsWithTrades(closedAll, accounts),
    [accounts, closedAll]
  );

  const isAggregate = isAggregateScope(closedAll, accounts, activeAccountId);

  /** Aggregate figures are only meaningful if every account shares a currency. */
  const hasMixedCurrencies = useMemo(
    () => mixedCurrencies(closedAll, accounts, activeAccountId),
    [closedAll, accounts, activeAccountId]
  );

  const initialBalance = selectedAccount?.initial_balance || 100000;
  const profitTarget = selectedAccount?.profit_target || 10000;
  const maxDrawdownLimit = selectedAccount?.max_drawdown_limit || 10000;

  // 1. OVERVIEW & KPI
  const wins = closed.filter(t => (t.pnl || 0) > 0);
  const losses = closed.filter(t => (t.pnl || 0) < 0);
  const breakeven = closed.filter(t => (t.pnl || 0) === 0);
  const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgR = closed.length > 0 ? closed.reduce((s, t) => s + (t.r_multiple || 0), 0) / closed.length : 0;
  const expectancy = closed.length > 0 ? totalPnL / closed.length : 0;

  // 2. EQUITY & DRAWDOWN DATA
  const { equityKitData, maxDrawdown, currentDrawdown, drawdownData } = useMemo(() => {
    const sorted = [...closed].sort(
      (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );
    let cum = 0;
    let peak = 0;
    let maxDd = 0;

    const values = [0];
    const labels = ['0'];
    const ddValues: { label: string; value: number }[] = [];
    let peakSoFar = 0;

    sorted.forEach((t, i) => {
      cum += (t.pnl || 0);
      if (cum > peakSoFar) peakSoFar = cum;
      const dd = peakSoFar - cum;
      if (dd > maxDd) maxDd = dd;
      values.push(cum);
      ddValues.push({ label: `${i + 1}`, value: -dd });
      if (i % Math.max(1, Math.floor(sorted.length / 5)) === 0 || i === sorted.length - 1) {
        labels.push(`${i + 1}`);
      } else {
        labels.push('');
      }
    });

    const currDd = peakSoFar - cum;
    return {
      equityKitData: {
        labels,
        datasets: [
          {
            data: values,
            color: (opacity = 1) => withAlpha(totalPnL >= 0 ? darkTheme.colors.green : darkTheme.colors.red, opacity),
            strokeWidth: 3,
          },
        ],
      },
      maxDrawdown: maxDd,
      currentDrawdown: currDd,
      drawdownData: ddValues.slice(-10),
    };
  }, [closed, totalPnL]);

  // Daily PnL for bar chart
  const dailyPnL = useMemo(() => {
    const map: Record<string, number> = {};
    closed.forEach(t => {
      const day = formatShortDate(new Date(t.entry_time), lang);
      map[day] = (map[day] || 0) + (t.pnl || 0);
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }));
  }, [closed, lang]);

  // Win Rate Trend
  const winRateTrend = useMemo(() => {
    const window = 5;
    const result: { label: string; value: number }[] = [];
    for (let i = window; i <= closed.length; i++) {
      const slice = closed.slice(i - window, i);
      const wr = (slice.filter(t => (t.pnl || 0) > 0).length / slice.length) * 100;
      result.push({ label: `${i}`, value: wr });
    }
    return result.slice(-8);
  }, [closed]);

  // pieData is intentionally NOT built here: it embeds theme colours, which
  // are a view concern. The screen composes it from wins/losses/breakeven.

  // 4. PAR SETUP
  const setupBreakdown = useMemo(() => {
    if (playbookSetups.length > 0) {
      return playbookSetups.map(s => {
        const titleLower = s.title.toLowerCase().trim();
        const sub = closed.filter(t => {
          if (t.setup_structures && t.setup_structures.some(st => st.toLowerCase().trim() === titleLower)) return true;
          const notesLower = (t.notes || '').toLowerCase();
          if (notesLower.includes(titleLower)) return true;
          if (titleLower.includes('bos') && t.setup_structures && t.setup_structures.includes('BOS')) return true;
          if ((titleLower.includes('ob') || titleLower.includes('order block')) && t.setup_ob) return true;
          if ((titleLower.includes('fvg') || titleLower.includes('gap')) && t.setup_fvg) return true;
          if ((titleLower.includes('sweep') || titleLower.includes('liquidity')) && t.setup_liquidity_sweep) return true;
          if (playbookSetups.length === 1) return true;
          return false;
        });
        const w = sub.filter(t => (t.pnl || 0) > 0).length;
        const pnl = sub.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const wr = sub.length > 0 ? (w / sub.length) * 100 : 0;
        return { name: s.title, count: sub.length, winRate: wr, pnl };
      });
    }

    const defs = [
      { name: 'BOS (Break of Structure)', check: (t: Trade) => t.setup_structures.includes('BOS') },
      { name: 'Order Block (OB)', check: (t: Trade) => t.setup_ob },
      { name: 'Fair Value Gap (FVG)', check: (t: Trade) => t.setup_fvg },
      { name: 'Liquidity Sweep', check: (t: Trade) => t.setup_liquidity_sweep },
    ];
    return defs.map(({ name, check }) => {
      const sub = closed.filter(check);
      const w = sub.filter(t => (t.pnl || 0) > 0).length;
      const pnl = sub.reduce((s, t) => s + (t.pnl || 0), 0);
      const wr = sub.length > 0 ? (w / sub.length) * 100 : 0;
      return { name, count: sub.length, winRate: wr, pnl };
    });
  }, [playbookSetups, closed]);

  const pairBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; wins: number; total: number }> = {};
    closed.forEach(t => {
      if (!map[t.pair]) map[t.pair] = { pnl: 0, wins: 0, total: 0 };
      map[t.pair].pnl += (t.pnl || 0);
      map[t.pair].total++;
      if ((t.pnl || 0) > 0) map[t.pair].wins++;
    });
    return Object.entries(map).map(([pair, d]) => ({
      name: pair,
      pnl: d.pnl,
      winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0,
      total: d.total,
    }));
  }, [closed]);

  const tfBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; wins: number; total: number }> = {};
    closed.forEach(t => {
      if (!map[t.timeframe]) map[t.timeframe] = { pnl: 0, wins: 0, total: 0 };
      map[t.timeframe].pnl += (t.pnl || 0);
      map[t.timeframe].total++;
      if ((t.pnl || 0) > 0) map[t.timeframe].wins++;
    });
    return Object.entries(map).map(([tf, d]) => ({
      name: tf,
      pnl: d.pnl,
      winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0,
      total: d.total,
    }));
  }, [closed]);

  // 5. TIMING
  const timingBreakdown = useMemo(() => {
    const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map(h => {
      const match = closed.filter(t => new Date(t.entry_time).getHours() === h);
      const pnl = match.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { label: `${h}h`, value: pnl };
    }).filter(h => h.value !== 0);
  }, [closed]);

  // 6. PSYCHOLOGY
  const mentalBreakdown = useMemo(() => {
    const states = ['focused', 'anxious', 'greedy', 'revenge', 'fomo', 'tired'];
    return states.map(st => {
      const match = closed.filter(t => t.mental_state === st);
      const w = match.filter(t => (t.pnl || 0) > 0).length;
      const wr = match.length > 0 ? (w / match.length) * 100 : 0;
      const pnl = match.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { state: st.toUpperCase(), count: match.length, winRate: wr, pnl };
    });
  }, [closed]);

  // 7. SESSION PERFORMANCE BREAKDOWN
  const sessionBreakdown = useMemo(() => {
    const sessions: Record<string, { pnl: number; wins: number; total: number; totalR: number }> = {};
    const sessionIds = ['Asia', 'London', 'New York', 'Over Session'];
    sessionIds.forEach(s => { sessions[s] = { pnl: 0, wins: 0, total: 0, totalR: 0 } });
    closed.forEach(t => {
      const s = t.session || 'Over Session';
      if (!sessions[s]) sessions[s] = { pnl: 0, wins: 0, total: 0, totalR: 0 };
      sessions[s].total++;
      sessions[s].pnl += (t.pnl || 0);
      sessions[s].totalR += (t.r_multiple || 0);
      if ((t.pnl || 0) > 0) sessions[s].wins++;
    });
    return sessionIds.map(s => ({
      name: s,
      labelKey: s === 'Over Session' ? 'sessionOverSessionLabel' : (`session${s.replace(' ', '')}` as any),
      count: sessions[s].total,
      winRate: sessions[s].total > 0 ? (sessions[s].wins / sessions[s].total) * 100 : 0,
      pnl: sessions[s].pnl,
      avgR: sessions[s].total > 0 ? sessions[s].totalR / sessions[s].total : 0,
    }));
  }, [closed]);

  // 8. DAY OF WEEK ANALYSIS
  const dayOfWeekAnalysis = useMemo(() => {
    const dayNames = lang === 'en'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const dayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMap: Record<number, { pnl: number; wins: number; total: number }> = {};
    for (let i = 0; i < 7; i++) dayMap[i] = { pnl: 0, wins: 0, total: 0 };
    closed.forEach(t => {
      const d = new Date(t.entry_time);
      const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // Monday=0
      dayMap[dayIdx].total++;
      dayMap[dayIdx].pnl += (t.pnl || 0);
      if ((t.pnl || 0) > 0) dayMap[dayIdx].wins++;
    });
    return dayNames.map((name, i) => ({
      name,
      nameEn: dayNamesEn[i],
      count: dayMap[i].total,
      winRate: dayMap[i].total > 0 ? (dayMap[i].wins / dayMap[i].total) * 100 : 0,
      pnl: dayMap[i].pnl,
    }));
  }, [closed, lang]);

  // 9. HOLDING TIME ANALYSIS
  const holdingTimeData = useMemo(() => {
    const getMinutes = (t: Trade): number => {
      if (!t.entry_time || !t.exit_time) return 0;
      return (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000;
    };
    const buckets = [
      { label: '<5m', min: 0, max: 5 },
      { label: '5-15m', min: 5, max: 15 },
      { label: '15-30m', min: 15, max: 30 },
      { label: '30m-1h', min: 30, max: 60 },
      { label: '1-4h', min: 60, max: 240 },
      { label: '4h+', min: 240, max: Infinity },
    ];
    return buckets.map(b => {
      const inBucket = closed.filter(t => {
        const mins = getMinutes(t);
        return mins >= b.min && mins < b.max;
      });
      const winsInBucket = inBucket.filter(t => (t.pnl || 0) > 0);
      // Win rate alone lies about a bucket: 65% WR at -0.4R average is a
      // disaster, not a style. The R average rides along for the chart.
      const withR = inBucket.filter(t => t.r_multiple !== null);
      return {
        label: b.label,
        count: inBucket.length,
        winRate: inBucket.length > 0 ? (winsInBucket.length / inBucket.length) * 100 : 0,
        pnl: inBucket.reduce((s, t) => s + (t.pnl || 0), 0),
        avgR: withR.length > 0 ? withR.reduce((s, t) => s + (t.r_multiple || 0), 0) / withR.length : null,
      };
    });
  }, [closed]);

  // 10. EXPECTANCY R-SCORE
  const expectancyR = useMemo(() => {
    const wins = closed.filter(t => (t.pnl || 0) > 0);
    const losses = closed.filter(t => (t.pnl || 0) < 0);
    const winPct = closed.length > 0 ? wins.length / closed.length : 0;
    const lossPct = closed.length > 0 ? losses.length / closed.length : 0;
    const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + (t.r_multiple || 0), 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.r_multiple || 0), 0) / losses.length) : 0;
    const er = (winPct * avgWinR) - (lossPct * avgLossR);
    return { value: er, winPct, lossPct, avgWinR, avgLossR };
  }, [closed]);

  // 11. PROP FIRM SPECIFIC
  const propFirmData = useMemo(() => {
    const profitPct = profitTarget > 0 ? Math.min(totalPnL / profitTarget, 1) : 0;
    const drawdownPct = maxDrawdownLimit > 0 ? Math.min(maxDrawdown / maxDrawdownLimit, 1) : 0;
    const wrPct = winRate / 100;
    const dailyLossLimit = selectedAccount?.max_daily_loss_limit || 0;

    const dayMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = localDayKey(new Date(t.entry_time));
      dayMap[day] = (dayMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.values(dayMap);
    const bestDay = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const worstDay = dayPnls.length > 0 ? Math.min(...dayPnls) : 0;

    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let curWins = 0;
    let curLosses = 0;
    closed.forEach(t => {
      if ((t.pnl || 0) > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
      else if ((t.pnl || 0) < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
      else { curWins = 0; curLosses = 0; }
    });

    const uniqueDays = Object.keys(dayMap).length;
    const maxDayPnl = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const consistencyPct = totalPnL > 0 ? (maxDayPnl / totalPnL) * 100 : 0;

    return {
      profitPct, drawdownPct, wrPct,
      dailyLossLimit, bestDay, worstDay,
      maxConsecWins, maxConsecLosses,
      uniqueDays, consistencyPct,
    };
  }, [closed, totalPnL, profitTarget, maxDrawdownLimit, winRate, selectedAccount]);

  // 12. DRAWDOWN PROJECTION
  const ddProjection = useMemo(() => {
    const dayMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = localDayKey(new Date(t.entry_time));
      dayMap[day] = (dayMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.values(dayMap);
    const uniqueDays = dayPnls.length;

    // Calculate running daily drawdown
    let cumDd = 0;
    let peakDd = 0;
    const dailyDds = dayPnls.map(pnl => {
      cumDd += pnl;
      if (cumDd > peakDd) peakDd = cumDd;
      return peakDd - cumDd;
    });

    const avgDailyDd = dailyDds.length > 0 ? dailyDds.reduce((s, v) => s + v, 0) / dailyDds.length : 0;
    const remainingDd = Math.max(0, maxDrawdownLimit - maxDrawdown);
    const daysUntilMaxDd = avgDailyDd > 0 ? Math.floor(remainingDd / avgDailyDd) : 999;

    const ddLevel = daysUntilMaxDd > 20 ? 'safe' : daysUntilMaxDd > 7 ? 'warning' : 'danger';

    return { avgDailyDd, remainingDd, daysUntilMaxDd, ddLevel };
  }, [closed, maxDrawdown, maxDrawdownLimit]);

  // 13. CONSISTENCY TRACKER (daily PnL contribution as % of total)
  const consistencyData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = localDayKey(new Date(t.entry_time));
      dayMap[day] = (dayMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.entries(dayMap).map(([date, pnl]) => ({ date, pnl })).sort((a, b) => a.date.localeCompare(b.date));
    const totalAbs = dayPnls.reduce((s, d) => s + Math.abs(d.pnl), 0);
    const maxDayPnl = dayPnls.length > 0 ? Math.max(...dayPnls.map(d => d.pnl)) : 0;
    const consistencyRule = selectedAccount?.consistency_rule_percent || 15;
    const maxDayContrib = totalAbs > 0 ? (maxDayPnl / totalAbs) * 100 : 0;
    const isCompliant = maxDayContrib <= consistencyRule;

    const dailyContributions = dayPnls.map(d => ({
      date: formatShortDate(new Date(d.date + 'T12:00:00Z'), lang),
      pct: totalAbs > 0 ? (d.pnl / totalAbs) * 100 : 0,
      pnl: d.pnl,
    }));

    return { consistencyRule, maxDayContrib, isCompliant, dailyContributions };
  }, [closed, selectedAccount]);

  // 14. CHALLENGE COUNTDOWN
  const challengeCountdown = useMemo(() => {
    const endDateStr = selectedAccount?.challenge_end_date;
    if (!endDateStr) return null;
    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) return null;
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { daysLeft, isExpired: daysLeft <= 0, endDate };
  }, [selectedAccount]);
  return {
    isAggregate,
    hasMixedCurrencies,
    accountsInScope,
    closedAll,
    closed,
    selectedAccount,
    initialBalance,
    profitTarget,
    maxDrawdownLimit,
    wins,
    losses,
    breakeven,
    totalPnL,
    grossProfit,
    grossLoss,
    profitFactor,
    winRate,
    avgWin,
    avgLoss,
    avgR,
    expectancy,
    equityKitData,
    maxDrawdown,
    currentDrawdown,
    drawdownData,
    dailyPnL,
    winRateTrend,
    setupBreakdown,
    pairBreakdown,
    tfBreakdown,
    timingBreakdown,
    mentalBreakdown,
    sessionBreakdown,
    dayOfWeekAnalysis,
    holdingTimeData,
    expectancyR,
    propFirmData,
    ddProjection,
    consistencyData,
    challengeCountdown,
  };
}
