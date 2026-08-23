import { useMemo } from 'react';
import { useTrades } from '../trades/useTrades';
import { useAccounts } from '../accounts/useAccounts';
import { usePlaybookSetups } from '../playbook/usePlaybook';
import { useUIStore } from '../../store/uiStore';
import type { Trade } from '../../types/domain';
import { formatShortDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import { useI18nStore } from '../../i18n';
import { translations } from '../../i18n/translations';

export type DateRange = 'all' | '7d' | '30d' | '90d';

export function useAnalyticsComputations(dateRange: DateRange) {
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { setups: playbookSetups, isLoading: setupsLoading } = usePlaybookSetups();
  const activeAccountId = useUIStore((s: { activeAccountId: string | null }) => s.activeAccountId);
  const lang = useI18nStore((s: { lang: 'fr' | 'en' }) => s.lang) as 'fr' | 'en';

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

  const initialBalance = selectedAccount?.initial_balance || 100000;
  const profitTarget = selectedAccount?.profit_target || 10000;
  const maxDrawdownLimit = selectedAccount?.max_drawdown_limit || 10000;

  // ── SINGLE-PASS COMPUTATION ──
  const computed = useMemo(() => {
    const wins: Trade[] = [];
    const losses: Trade[] = [];
    const breakeven: Trade[] = [];
    let totalPnL = 0;
    let grossProfit = 0;
    let grossLossAbs = 0;
    let totalR = 0;

    const pairMap: Record<string, { pnl: number; wins: number; total: number }> = {};
    const tfMap: Record<string, { pnl: number; wins: number; total: number }> = {};
    const sessionMap: Record<string, { pnl: number; wins: number; total: number; totalR: number }> = {};
    const mentalMap: Record<string, { pnl: number; wins: number; total: number }> = {};
    const mistakeMap: Record<string, { pnl: number; count: number; losses: number }> = {};
    const planDiscipline = {
      respectedCount: 0,
      respectedWins: 0,
      respectedPnL: 0,
      violatedCount: 0,
      violatedWins: 0,
      violatedPnL: 0,
    };
    const gradeMap: Record<string, { count: number; wins: number; pnl: number }> = {};
    const hourMap: Record<number, number> = {};
    const dayMap: Record<number, { pnl: number; wins: number; total: number }> = {};
    const holdingBuckets = [
      { label: '<5m', min: 0, max: 5, count: 0, wins: 0, pnl: 0 },
      { label: '5-15m', min: 5, max: 15, count: 0, wins: 0, pnl: 0 },
      { label: '15-30m', min: 15, max: 30, count: 0, wins: 0, pnl: 0 },
      { label: '30m-1h', min: 30, max: 60, count: 0, wins: 0, pnl: 0 },
      { label: '1-4h', min: 60, max: 240, count: 0, wins: 0, pnl: 0 },
      { label: '4h+', min: 240, max: Infinity, count: 0, wins: 0, pnl: 0 },
    ];

    for (let i = 0; i < closed.length; i++) {
      const t = closed[i];
      const pnl = t.pnl || 0;
      const r = t.r_multiple || 0;

      const isWin = t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && pnl > 0);
      const isLoss = t.result === 'SL' || (t.result !== 'TP' && t.result !== 'BE' && pnl < 0);
      if (isWin) { wins.push(t); grossProfit += pnl; }
      else if (isLoss) { losses.push(t); grossLossAbs += Math.abs(pnl); }
      else { breakeven.push(t); }
      totalPnL += pnl;
      totalR += r;

      // Plan Discipline
      if (t.plan_respected === true || t.plan_respected === undefined) {
        planDiscipline.respectedCount++;
        planDiscipline.respectedPnL += pnl;
        if (isWin) planDiscipline.respectedWins++;
      } else if (t.plan_respected === false) {
        planDiscipline.violatedCount++;
        planDiscipline.violatedPnL += pnl;
        if (isWin) planDiscipline.violatedWins++;
      }

      // Execution Grade
      if (t.execution_grade) {
        if (!gradeMap[t.execution_grade]) gradeMap[t.execution_grade] = { count: 0, wins: 0, pnl: 0 };
        gradeMap[t.execution_grade].count++;
        gradeMap[t.execution_grade].pnl += pnl;
        if (isWin) gradeMap[t.execution_grade].wins++;
      }

      // Mistakes Leak Detector
      if (t.mistakes && Array.isArray(t.mistakes)) {
        for (const m of t.mistakes) {
          if (!mistakeMap[m]) mistakeMap[m] = { pnl: 0, count: 0, losses: 0 };
          mistakeMap[m].count++;
          mistakeMap[m].pnl += pnl;
          if (isLoss) mistakeMap[m].losses++;
        }
      }

      if (!pairMap[t.pair]) pairMap[t.pair] = { pnl: 0, wins: 0, total: 0 };
      pairMap[t.pair].pnl += pnl;
      pairMap[t.pair].total++;
      if (isWin) pairMap[t.pair].wins++;

      if (!tfMap[t.timeframe]) tfMap[t.timeframe] = { pnl: 0, wins: 0, total: 0 };
      tfMap[t.timeframe].pnl += pnl;
      tfMap[t.timeframe].total++;
      if (isWin) tfMap[t.timeframe].wins++;

      const sess = t.session || 'Over Session';
      if (!sessionMap[sess]) sessionMap[sess] = { pnl: 0, wins: 0, total: 0, totalR: 0 };
      sessionMap[sess].total++;
      sessionMap[sess].pnl += pnl;
      sessionMap[sess].totalR += r;
      if (isWin) sessionMap[sess].wins++;

      const ms = t.mental_state;
      if (ms) {
        if (!mentalMap[ms]) mentalMap[ms] = { pnl: 0, wins: 0, total: 0 };
        mentalMap[ms].total++;
        mentalMap[ms].pnl += pnl;
        if (isWin) mentalMap[ms].wins++;
      }

      const entryDate = new Date(t.entry_time);
      const hour = entryDate.getHours();
      hourMap[hour] = (hourMap[hour] || 0) + pnl;

      const dayIdx = entryDate.getDay() === 0 ? 6 : entryDate.getDay() - 1;
      if (!dayMap[dayIdx]) dayMap[dayIdx] = { pnl: 0, wins: 0, total: 0 };
      dayMap[dayIdx].total++;
      dayMap[dayIdx].pnl += pnl;
      if (isWin) dayMap[dayIdx].wins++;

      // Holding time: use exit_time, fallback to now for open trades
      const exitTime = t.exit_time ? new Date(t.exit_time).getTime() : Date.now();
      if (t.entry_time) {
        const mins = (exitTime - entryDate.getTime()) / 60000;
        for (const b of holdingBuckets) {
          if (mins >= b.min && mins < b.max) {
            b.count++;
            b.pnl += pnl;
            if (isWin) b.wins++;
            break;
          }
        }
      }
    }

    return {
      wins, losses, breakeven,
      totalPnL, grossProfit, grossLoss: grossLossAbs, totalR,
      pairMap, tfMap, sessionMap, mentalMap, mistakeMap, planDiscipline, gradeMap, hourMap, dayMap,
      holdingBuckets,
    };
  }, [closed]);

  const { wins, losses, breakeven, totalPnL, grossProfit, grossLoss, pairMap, tfMap, sessionMap, mentalMap, mistakeMap, planDiscipline, gradeMap, hourMap, dayMap, holdingBuckets } = computed;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgR = closed.length > 0 ? computed.totalR / closed.length : 0;
  const expectancy = closed.length > 0 ? totalPnL / closed.length : 0;

  // Equity & Drawdown
  const { equityKitData, maxDrawdown, currentDrawdown, drawdownData } = useMemo(() => {
    const sorted = [...closed].sort(
      (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );
    const n = sorted.length;
    const step = Math.max(1, Math.floor(n / 100));
    let cum = 0;
    let peakSoFar = 0;
    let maxDd = 0;
    const values: number[] = [0];
    const labels: string[] = ['0'];
    const ddValues: { label: string; value: number }[] = [];

    for (let i = 0; i < n; i++) {
      cum += (sorted[i].pnl || 0);
      if (cum > peakSoFar) peakSoFar = cum;
      const dd = peakSoFar - cum;
      if (dd > maxDd) maxDd = dd;
      ddValues.push({ label: `${i + 1}`, value: -dd });
      if (i % step === 0 || i === n - 1) {
        values.push(cum);
        labels.push(`${i + 1}`);
      }
    }
    return {
      equityKitData: {
        labels,
        datasets: [{
          data: values,
          color: (opacity = 1) => totalPnL >= 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 3,
        }],
      },
      maxDrawdown: maxDd,
      currentDrawdown: peakSoFar - cum,
      drawdownData: ddValues.slice(-10),
    };
  }, [closed, totalPnL]);

  // Daily PnL
  const dailyPnL = useMemo(() => {
    const map: Record<string, { pnl: number; isoKey: string }> = {};
    for (const t of closed) {
      const timeStr = t.entry_time || t.exit_time;
      if (!timeStr) continue;
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) continue;
      const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[isoKey]) map[isoKey] = { pnl: 0, isoKey };
      map[isoKey].pnl += (t.pnl || 0);
    }
    return Object.values(map)
      .sort((a, b) => a.isoKey.localeCompare(b.isoKey))
      .map(e => ({ label: formatShortDate(new Date(e.isoKey + 'T12:00:00Z'), lang), value: Number(e.pnl.toFixed(2)) }));
  }, [closed, lang]);

  // Win Rate Trend
  const winRateTrend = useMemo(() => {
    const winFlags = closed.map(t => (t.result === 'TP' || (t.result !== 'SL' && (t.pnl || 0) > 0)) ? 1 : 0);
    const window = 5;
    const result: { label: string; value: number }[] = [];
    let winSum = 0;
    for (let i = 0; i < winFlags.length; i++) {
      winSum += winFlags[i];
      if (i >= window) winSum -= winFlags[i - window];
      if (i >= window - 1) {
        result.push({ label: `${i + 1}`, value: (winSum / window) * 100 });
      }
    }
    return result.slice(-8);
  }, [closed]);

  // Donut data
  const donutData = useMemo(() => [
    { label: 'TP', value: wins.length, color: '#10b981', amount: formatCurrency(grossProfit, { decimals: 0 }) },
    { label: 'SL', value: losses.length, color: '#ef4444', amount: formatCurrency(-grossLoss, { decimals: 0 }) },
    { label: 'BE', value: breakeven.length, color: '#6366f1', amount: formatCurrency(breakeven.reduce((s, t) => s + (t.pnl || 0), 0), { decimals: 0 }) },
  ].filter(d => d.value > 0), [wins, losses, breakeven, grossProfit, grossLoss]);

  // Setup breakdown
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
        return { name: s.title, count: sub.length, winRate: sub.length > 0 ? (w / sub.length) * 100 : 0, pnl };
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
      return { name, count: sub.length, winRate: sub.length > 0 ? (w / sub.length) * 100 : 0, pnl: sub.reduce((s, t) => s + (t.pnl || 0), 0) };
    });
  }, [playbookSetups, closed]);

  // Derived breakdowns (instant from maps)
  const pairBreakdown = useMemo(() =>
    Object.entries(pairMap).map(([name, d]) => ({ name, count: d.total, pnl: d.pnl, winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0 })),
  [pairMap]);

  const tfBreakdown = useMemo(() =>
    Object.entries(tfMap).map(([name, d]) => ({ name, count: d.total, pnl: d.pnl, winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0 })),
  [tfMap]);

  const timingBreakdown = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return hours
      .map(h => ({ label: `${h}h`, value: hourMap[h] || 0 }))
      .filter(h => h.value !== 0);
  }, [hourMap]);

  const mentalBreakdown = useMemo(() => {
    const states = ['focused', 'anxious', 'greedy', 'revenge', 'fomo', 'tired'] as const;
    const labelKeys: Record<string, string> = {
      focused: 'mentalFocused',
      anxious: 'mentalAnxious',
      greedy: 'mentalGreedy',
      revenge: 'mentalRevenge',
      fomo: 'mentalFomo',
      tired: 'mentalTired',
    };
    const dict = (lang === 'fr' ? translations.fr : translations.en) as unknown as Record<string, string>;
    const tFn = (key: string) => dict[key] || key;
    return states.map(st => {
      const d = mentalMap[st];
      return { name: tFn(labelKeys[st] || st), count: d?.total || 0, winRate: d && d.total > 0 ? (d.wins / d.total) * 100 : 0, pnl: d?.pnl || 0 };
    });
  }, [mentalMap, lang]);

  const sessionBreakdown = useMemo(() => {
    const sessionIds = ['Asia', 'London', 'New York', 'Over Session'] as const;
    return sessionIds.map(s => ({
      name: s,
      labelKey: s === 'Over Session' ? 'sessionOverSessionLabel' : (`session${s.replace(' ', '')}` as string),
      count: sessionMap[s]?.total || 0,
      winRate: sessionMap[s] && sessionMap[s].total > 0 ? (sessionMap[s].wins / sessionMap[s].total) * 100 : 0,
      pnl: sessionMap[s]?.pnl || 0,
      avgR: sessionMap[s] && sessionMap[s].total > 0 ? sessionMap[s].totalR / sessionMap[s].total : 0,
    }));
  }, [sessionMap]);

  const dayOfWeekAnalysis = useMemo(() => {
    const dayNames = lang === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const dayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayNames.map((name, i) => {
      const d = dayMap[i];
      return { name, nameEn: dayNamesEn[i], count: d?.total || 0, winRate: d && d.total > 0 ? (d.wins / d.total) * 100 : 0, pnl: d?.pnl || 0 };
    });
  }, [dayMap, lang]);

  const holdingTimeData = useMemo(() =>
    holdingBuckets.map(b => ({
      label: b.label, count: b.count,
      winRate: b.count > 0 ? (b.wins / b.count) * 100 : 0, pnl: b.pnl,
    })),
  [holdingBuckets]);

  // Expectancy R-Score
  const expectancyR = useMemo(() => {
    const winPct = closed.length > 0 ? wins.length / closed.length : 0;
    const lossPct = closed.length > 0 ? losses.length / closed.length : 0;
    const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + (t.r_multiple || 0), 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.r_multiple || 0), 0) / losses.length) : 0;
    return { value: (winPct * avgWinR) - (lossPct * avgLossR), winPct, lossPct, avgWinR, avgLossR };
  }, [wins, losses, closed.length]);

  // Prop Firm
  const propFirmData = useMemo(() => {
    const profitPct = profitTarget > 0 ? Math.min(totalPnL / profitTarget, 1) : 0;
    const drawdownPct = maxDrawdownLimit > 0 ? Math.min(maxDrawdown / maxDrawdownLimit, 1) : 0;
    const wrPct = winRate / 100;
    const dailyLossLimit = selectedAccount?.max_daily_loss_limit || 0;

    const dayPnlMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = new Date(t.entry_time).toISOString().split('T')[0];
      dayPnlMap[day] = (dayPnlMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.values(dayPnlMap);
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

    const uniqueDays = Object.keys(dayPnlMap).length;
    const maxDayPnl = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const consistencyPct = totalPnL > 0 ? (maxDayPnl / totalPnL) * 100 : 0;

    return {
      profitPct, drawdownPct, wrPct,
      dailyLossLimit, bestDay, worstDay,
      maxConsecWins, maxConsecLosses,
      uniqueDays, consistencyPct,
    };
  }, [closed, totalPnL, profitTarget, maxDrawdownLimit, winRate, selectedAccount]);

  // Drawdown Projection
  const ddProjection = useMemo(() => {
    const dayPnlMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = new Date(t.entry_time).toISOString().split('T')[0];
      dayPnlMap[day] = (dayPnlMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.values(dayPnlMap);

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

  // Consistency Tracker
  const consistencyData = useMemo(() => {
    const dayPnlMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = new Date(t.entry_time).toISOString().split('T')[0];
      dayPnlMap[day] = (dayPnlMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.entries(dayPnlMap).map(([date, pnl]) => ({ date, pnl })).sort((a, b) => a.date.localeCompare(b.date));
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
  }, [closed, selectedAccount, lang]);

  // Challenge Countdown
  const challengeCountdown = useMemo(() => {
    const endDateStr = selectedAccount && 'challenge_end_date' in selectedAccount ? (selectedAccount as { challenge_end_date?: string }).challenge_end_date : undefined;
    if (!endDateStr || typeof endDateStr !== 'string') return null;
    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) return null;
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { daysLeft, isExpired: daysLeft <= 0, endDate };
  }, [selectedAccount]);

  // What-If Simulation: Couper à 1R max de perte ou laisser courir les TP
  const whatIfSimulation = useMemo(() => {
    let simulatedPnL = 0;
    let actualPnL = 0;
    let improvedCount = 0;
    let degradedCount = 0;

    closed.forEach(t => {
      const pnl = t.pnl || 0;
      const r = t.r_multiple || 0;
      actualPnL += pnl;

      // Scénario: Si trade perdant avec R < -1, simulation coupée strictement à -1R
      if (r < -1 && pnl < 0) {
        const oneRPnl = pnl / Math.abs(r);
        simulatedPnL += oneRPnl;
        improvedCount++;
      } else {
        simulatedPnL += pnl;
        if (pnl < 0) degradedCount++;
      }
    });

    const diff = simulatedPnL - actualPnL;
    return {
      actualPnL,
      simulatedPnL,
      diff,
      improvedCount,
      isBetter: diff > 0,
    };
  }, [closed]);

  // Insights Psychologiques Automatiques
  const psychInsights = useMemo(() => {
    const insights: { type: 'danger' | 'warning' | 'positive'; textFr: string; textEn: string }[] = [];
    const states = ['fomo', 'revenge', 'anxious', 'tired', 'greedy', 'focused'] as const;

    states.forEach(st => {
      const tradesForState = closed.filter(t => t.mental_state === st);
      if (tradesForState.length >= 2) {
        const wins = tradesForState.filter(t => (t.pnl || 0) > 0).length;
        const wr = (wins / tradesForState.length) * 100;
        const pnl = tradesForState.reduce((s, t) => s + (t.pnl || 0), 0);

        if (st === 'focused' && wr >= 55) {
          insights.push({
            type: 'positive',
            textFr: `Excellente discipline : Votre winrate est de ${wr.toFixed(0)}% (+${formatCurrency(pnl)}) lorsque vous tradez en état CONCENTRÉ.`,
            textEn: `Great discipline: Your win rate is ${wr.toFixed(0)}% (+${formatCurrency(pnl)}) when trading FOCUSED.`,
          });
        } else if ((st === 'fomo' || st === 'revenge') && wr < 40) {
          insights.push({
            type: 'danger',
            textFr: `Alerte dérive : Votre winrate s'effondre à ${wr.toFixed(0)}% (${formatCurrency(pnl)}) en état ${st.toUpperCase()}. Évitez d'entrer en position sous cette émotion.`,
            textEn: `Rule drift alert: Your win rate drops to ${wr.toFixed(0)}% (${formatCurrency(pnl)}) in ${st.toUpperCase()} mode. Avoid executing in this state.`,
          });
        } else if (st === 'anxious' && pnl < 0) {
          insights.push({
            type: 'warning',
            textFr: `Impact anxiété : Vos trades anxieux enregistrent une perte nette de ${formatCurrency(pnl)}. Prenez une pause avant chaque entrée.`,
            textEn: `Anxiety impact: Your anxious trades total a net loss of ${formatCurrency(pnl)}. Take a breath before each setup.`,
          });
        }
      }
    });

    return insights;
  }, [closed]);

  // Session x Day of Week Matrix
  const sessionDayMatrix = useMemo(() => {
    const sessions = ['Asia', 'London', 'New York', 'Over Session'] as const;
    const daysFr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const daysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const days = lang === 'en' ? daysEn : daysFr;

    const matrix: Record<string, { pnl: number; wins: number; total: number }> = {};

    sessions.forEach(sess => {
      for (let d = 0; d < 5; d++) {
        matrix[`${sess}_${d}`] = { pnl: 0, wins: 0, total: 0 };
      }
    });

    closed.forEach(t => {
      if (!t.entry_time) return;
      const dt = new Date(t.entry_time);
      const rawDay = dt.getDay();
      if (rawDay === 0 || rawDay === 6) return; // ignore weekends
      const dayIdx = rawDay - 1; // 0 for Monday, 4 for Friday
      const sess = t.session || 'Over Session';
      const key = `${sess}_${dayIdx}`;
      if (matrix[key]) {
        matrix[key].total++;
        matrix[key].pnl += (t.pnl || 0);
        if ((t.pnl || 0) > 0) matrix[key].wins++;
      }
    });

    return { sessions, days, matrix };
  }, [closed, lang]);

  return {
    // Loading
    tradesLoading, accountsLoading, setupsLoading,
    // Data
    closed, trades, accounts, selectedAccount, playbookSetups, lang,
    // Account params
    initialBalance, profitTarget, maxDrawdownLimit,
    // KPIs
    totalPnL, winRate, profitFactor, avgWin, avgLoss, avgR, expectancy,
    grossProfit, grossLoss, wins, losses, breakeven,
    // Charts
    equityKitData, maxDrawdown, currentDrawdown, drawdownData,
    dailyPnL, winRateTrend, donutData,
    // Breakdowns & Discipline
    setupBreakdown, pairBreakdown, tfBreakdown,
    timingBreakdown, mentalBreakdown, sessionBreakdown,
    dayOfWeekAnalysis, holdingTimeData,
    planDiscipline, gradeMap, mistakeMap,
    // Prop Firm
    expectancyR, propFirmData, ddProjection, consistencyData, challengeCountdown,
    // Features avancées
    whatIfSimulation, sessionDayMatrix, psychInsights,
  };
}
