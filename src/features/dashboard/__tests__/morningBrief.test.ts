import { buildMorningBrief, isBriefEmpty, debriefIsAboutYesterday } from '../morningBrief';
import type { Trade } from '../../../types/domain';
import type { DailyDebrief } from '../../playbook/usePlaybook';

/**
 * The brief is copy, and copy lies quietly. These tests pin the silence
 * rules: no invented objective, no fake stats on an empty weekday, and the
 * exact day the "yesterday" slot reads from.
 */

const WEDNESDAY = new Date(2026, 8, 16, 8, 0, 0); // 2026-09-16 is a Wednesday

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 1,
    exit_price: 1,
    stop_loss: 0.9,
    take_profit: 1.2,
    size: 1,
    entry_time: '2026-09-09T10:00:00', // also a Wednesday
    exit_time: '2026-09-09T11:00:00',
    pnl: 100,
    r_multiple: 1.5,
    timeframe: 'M15',
    result: 'TP',
    session: 'London',
    mental_state: 'focused',
    setup_structures: [],
    setup_fvg: false,
    setup_ob: false,
    setup_liquidity_sweep: false,
    bookmap_absorption: null,
    bookmap_passive_orders: null,
    bookmap_aggressive_orders: null,
    bookmap_vwap_position: null,
    cookie_jar_ref: false,
    rule_40_percent: false,
    screenshot_before_url: null,
    screenshot_after_url: null,
    notes: null,
    created_at: '2026-09-09T10:00:00',
    ...over,
  } as Trade;
}

function debrief(over: Partial<DailyDebrief> = {}): DailyDebrief {
  return {
    id: 'd',
    user_id: 'u',
    date: '2026-09-15', // Tuesday, the day before WEDNESDAY
    market_sentiment: null,
    lessons_learned: null,
    mistakes_committed: [],
    mental_score: null,
    htf_analysis: null,
    htf_image_url: null,
    rules_followed: [],
    objective_tomorrow: null,
    emotion_before: null,
    day_rating: null,
    created_at: '2026-09-15T21:00:00',
    updated_at: '2026-09-15T21:00:00',
    ...over,
  } as DailyDebrief;
}

describe('buildMorningBrief', () => {
  it('carries yesterday\'s objective verbatim', () => {
    const b = buildMorningBrief(
      [],
      [debrief({ objective_tomorrow: '  Max 2 trades, no NY opens.  ' })],
      WEDNESDAY
    );
    expect(b.objective).toBe('Max 2 trades, no NY opens.');
    expect(b.hasYesterdayDebrief).toBe(true);
  });

  it('never invents an objective when none was written', () => {
    const b = buildMorningBrief([trade()], [debrief()], WEDNESDAY);
    expect(b.objective).toBeNull();
  });

  it('treats a blank objective as no objective', () => {
    const b = buildMorningBrief([], [debrief({ objective_tomorrow: '   ' })], WEDNESDAY);
    expect(b.objective).toBeNull();
  });

  it('aggregates the same weekday across the journal', () => {
    const trades = [
      trade({ pnl: 200, r_multiple: 2 }),
      trade({ pnl: -100, r_multiple: -1 }),
      trade({ pnl: 50, r_multiple: 0.5 }),
      // A Thursday trade must not join the Wednesday stats.
      trade({ entry_time: '2026-09-10T10:00:00', exit_time: '2026-09-10T11:00:00', pnl: 999, r_multiple: 9 }),
    ];
    const b = buildMorningBrief(trades, [], WEDNESDAY);
    expect(b.stats.dayTrades).toBe(3);
    expect(b.stats.dayWinRate).toBe(67); // 2 of 3 decided
    expect(b.stats.dayAvgR).toBe(0.5); // (2 - 1 + 0.5) / 3
  });

  it('names the most traded setup on that weekday', () => {
    const trades = [
      trade({ setup_structures: ['FVG retest'] }),
      trade({ setup_structures: ['FVG retest'] }),
      trade({ setup_structures: ['Liquidity sweep'] }),
    ];
    const b = buildMorningBrief(trades, [], WEDNESDAY);
    expect(b.stats.favouriteSetup).toBe('FVG retest');
  });

  it('hands over yesterday\'s mental score and mistakes', () => {
    const b = buildMorningBrief(
      [],
      [debrief({ mental_score: 4, mistakes_committed: ['revenge', 'overtrade'] })],
      WEDNESDAY
    );
    expect(b.yesterdayMentalScore).toBe(4);
    expect(b.yesterdayMistakes).toEqual(['revenge', 'overtrade']);
  });

  it('reports an empty card when there is nothing honest to say', () => {
    // Trades exist, but on other weekdays and no debrief: the weekday stats
    // still speak. Empty means BOTH no debrief AND no weekday history.
    const b = buildMorningBrief([], [], WEDNESDAY);
    expect(isBriefEmpty(b)).toBe(true);
    const b2 = buildMorningBrief([trade()], [], WEDNESDAY);
    expect(isBriefEmpty(b2)).toBe(false);
  });
});

describe('debriefIsAboutYesterday', () => {
  it('accepts only the exact previous local day', () => {
    const d = debrief({ date: '2026-09-15' });
    expect(debriefIsAboutYesterday(d, WEDNESDAY)).toBe(true);
    expect(debriefIsAboutYesterday(debrief({ date: '2026-09-14' }), WEDNESDAY)).toBe(false);
    expect(debriefIsAboutYesterday(null, WEDNESDAY)).toBe(false);
  });
});
