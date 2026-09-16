import {
  statsForDay,
  mistakeCosts,
  disciplineStreak,
  disciplineGrid,
  mentalVsPnl,
} from '../debriefInsights';
import type { DailyDebrief } from '../usePlaybook';
import type { Trade } from '../../../types/domain';

const baseTrade = (over: Partial<Trade>): Trade =>
  ({
    id: `t${Math.random().toString(36).slice(2)}`,
    account_id: 'acc-1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    size: 1,
    timeframe: 'M15',
    entry_time: '2026-09-14T09:00:00.000Z',
    exit_time: '2026-09-14T10:00:00.000Z',
    pnl: 100,
    r_multiple: 1,
    result: 'TP',
    mental_state: 'focused',
    rule_40_percent: false,
    session: 'London',
    notes: null,
    result_ok: undefined,
    screenshot_before_url: null,
    screenshot_after_url: null,
    ...over,
  }) as unknown as Trade;

const debrief = (over: Partial<DailyDebrief>): DailyDebrief =>
  ({
    id: 'd1',
    user_id: 'u1',
    date: '2026-09-14',
    market_sentiment: null,
    lessons_learned: null,
    mistakes_committed: [],
    mental_score: 8,
    htf_analysis: null,
    htf_image_url: null,
    rules_followed: [],
    objective_tomorrow: null,
    emotion_before: 'calm',
    day_rating: 7,
    created_at: '2026-09-14T21:00:00.000Z',
    updated_at: '2026-09-14T21:00:00.000Z',
    ...over,
  }) as DailyDebrief;

describe('statsForDay', () => {
  it('sums count, wins, pnl and average R for the selected day', () => {
    const trades = [
      baseTrade({ pnl: 100, r_multiple: 1, entry_time: '2026-09-14T09:00:00.000Z' }),
      baseTrade({ pnl: -50, r_multiple: -0.5, entry_time: '2026-09-14T11:00:00.000Z' }),
      baseTrade({ pnl: 80, r_multiple: null, entry_time: '2026-09-14T14:00:00.000Z' }),
      // Other day: must not leak in.
      baseTrade({ pnl: 999, entry_time: '2026-09-15T09:00:00.000Z' }),
    ];
    const s = statsForDay(trades, '2026-09-14');
    expect(s.count).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.pnl).toBe(130);
    expect(s.avgR).toBeCloseTo(0.25, 5);
  });

  it('returns avgR null when the day has no R data', () => {
    const s = statsForDay([baseTrade({ r_multiple: null })], '2026-09-14');
    expect(s.avgR).toBeNull();
  });
});

describe('mistakeCosts', () => {
  it('joins each mistake with the PnL of its days', () => {
    const debriefs = [
      debrief({ date: '2026-09-14', mistakes_committed: ['revenge'] }),
      debrief({ date: '2026-09-15', mistakes_committed: ['revenge', 'fomo'] }),
      debrief({ date: '2026-09-16', mistakes_committed: [] }),
    ];
    const trades = [
      baseTrade({ pnl: -120, entry_time: '2026-09-14T09:00:00.000Z' }),
      baseTrade({ pnl: 60, entry_time: '2026-09-15T09:00:00.000Z' }),
      baseTrade({ pnl: 300, entry_time: '2026-09-16T09:00:00.000Z' }),
    ];
    const costs = mistakeCosts(debriefs, trades);
    const revenge = costs.find(c => c.id === 'revenge')!;
    expect(revenge.days).toBe(2);
    expect(revenge.totalPnl).toBe(-60);
    const fomo = costs.find(c => c.id === 'fomo')!;
    expect(fomo.days).toBe(1);
    expect(fomo.totalPnl).toBe(60);
  });

  it('sorts most damaging first', () => {
    const debriefs = [
      debrief({ date: '2026-09-14', mistakes_committed: ['mild'] }),
      debrief({ date: '2026-09-15', mistakes_committed: ['harsh'] }),
    ];
    const trades = [
      baseTrade({ pnl: -10, entry_time: '2026-09-14T09:00:00.000Z' }),
      baseTrade({ pnl: -500, entry_time: '2026-09-15T09:00:00.000Z' }),
    ];
    const costs = mistakeCosts(debriefs, trades);
    expect(costs[0].id).toBe('harsh');
  });
});

describe('disciplineStreak', () => {
  it('counts consecutive clean days back from today', () => {
    const today = new Date();
    const iso = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      return d.toISOString().slice(0, 10);
    };
    const debriefs = [
      debrief({ date: iso(0), mistakes_committed: [] }),
      debrief({ date: iso(1), mistakes_committed: [] }),
      debrief({ date: iso(2), mistakes_committed: ['fomo'] }),
    ];
    expect(disciplineStreak(debriefs)).toBe(2);
  });

  it('does not die because tonight\u2019s debrief is not written yet', () => {
    const today = new Date();
    const iso = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      return d.toISOString().slice(0, 10);
    };
    // Yesterday clean, today missing: the streak survives via yesterday.
    const debriefs = [debrief({ date: iso(1), mistakes_committed: [] })];
    expect(disciplineStreak(debriefs)).toBe(1);
  });

  it('is zero when the latest debrief has a mistake', () => {
    const today = new Date();
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const debriefs = [debrief({ date: d.toISOString().slice(0, 10), mistakes_committed: ['revenge'] })];
    expect(disciplineStreak(debriefs)).toBe(0);
  });
});

describe('disciplineGrid', () => {
  it('produces N Monday-first weeks ending with the current week', () => {
    const now = new Date('2026-09-16T12:00:00'); // Wednesday
    const grid = disciplineGrid([], [], 4, now);
    expect(grid).toHaveLength(4);
    expect(grid.every(row => row.length === 7)).toBe(true);
    // Last row contains today; rows before it end on the previous Sundays.
    expect(grid[3].some(c => c.isToday)).toBe(true);
    // Wednesday: Thu, Fri, Sat, Sun of the current week are still future.
    expect(grid[3].filter(c => c.isFuture)).toHaveLength(4);
  });

  it('marks clean debrief days vs mistake days and joins PnL', () => {
    const now = new Date('2026-09-16T12:00:00');
    const trades = [
      baseTrade({ pnl: 250, entry_time: '2026-09-15T09:00:00.000Z' }),
    ];
    const debriefs = [
      debrief({ date: '2026-09-15', mistakes_committed: [], rules_followed: ['a'] }),
      debrief({ date: '2026-09-14', mistakes_committed: ['fomo', 'chasing'] }),
    ];
    const grid = disciplineGrid(debriefs, trades, 1, now);
    const flat = grid.flat();
    const tue = flat.find(c => c.dateKey === '2026-09-15')!;
    const mon = flat.find(c => c.dateKey === '2026-09-14')!;
    expect(tue.mistakes).toBe(0);
    expect(tue.pnl).toBe(250);
    expect(mon.mistakes).toBe(2);
    expect(mon.pnl).toBeNull();
  });
});

describe('mentalVsPnl', () => {
  it('buckets debriefed days by declared mental score with their real PnL', () => {
    const debriefs = [
      debrief({ date: '2026-09-14', mental_score: 9 }),
      debrief({ date: '2026-09-15', mental_score: 2 }),
      debrief({ date: '2026-09-16', mental_score: 5 }),
      debrief({ date: '2026-09-17', mental_score: 9 }), // no trades that day: excluded
    ];
    const trades = [
      baseTrade({ pnl: 400, entry_time: '2026-09-14T09:00:00.000Z' }),
      baseTrade({ pnl: -180, entry_time: '2026-09-15T09:00:00.000Z' }),
      baseTrade({ pnl: 10, entry_time: '2026-09-16T09:00:00.000Z' }),
    ];
    const r = mentalVsPnl(debriefs, trades);
    expect(r.strong).toEqual({ days: 1, totalPnl: 400 });
    expect(r.weak).toEqual({ days: 1, totalPnl: -180 });
    expect(r.middle).toEqual({ days: 1, totalPnl: 10 });
  });

  it('ignores debriefs without a mental score', () => {
    const r = mentalVsPnl(
      [debrief({ date: '2026-09-14', mental_score: null })],
      [baseTrade({})]
    );
    expect(r.strong.days).toBe(0);
    expect(r.weak.days).toBe(0);
    expect(r.middle.days).toBe(0);
  });
});
