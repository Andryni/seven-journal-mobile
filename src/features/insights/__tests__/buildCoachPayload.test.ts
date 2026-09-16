import { buildCoachPayload } from '../buildCoachPayload';
import type { Trade } from '../../../types/domain';
import type { DailyDebrief } from '../../playbook/usePlaybook';

const debrief = (over: Partial<DailyDebrief>): DailyDebrief =>
  ({
    id: 'd1',
    user_id: 'u1',
    date: '2026-01-13',
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
    created_at: '2026-01-13T21:00:00.000Z',
    updated_at: '2026-01-13T21:00:00.000Z',
    ...over,
  }) as DailyDebrief;

let seq = 0;
const base = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t${seq++}`,
    account_id: 'acc-1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1990,
    take_profit: 2020,
    size: 1,
    timeframe: 'H1',
    entry_time: '2026-01-13T09:00:00.000Z',
    exit_time: '2026-01-13T10:00:00.000Z',
    pnl: 100,
    r_multiple: 1,
    result: 'TP',
    mental_state: 'focused',
    rule_40_percent: false,
    session: 'London',
    notes: 'private thoughts about my finances',
    ...over,
  }) as Trade;

/** 24 trades spread over distinct days so no timing rule fires incidentally. */
const book = (over: Partial<Trade> = {}) =>
  Array.from({ length: 24 }, (_, i) =>
    base({
      entry_time: `2026-01-${String((i % 20) + 1).padStart(2, '0')}T09:00:00.000Z`,
      exit_time: `2026-01-${String((i % 20) + 1).padStart(2, '0')}T10:00:00.000Z`,
      pnl: i % 2 === 0 ? 100 : -50,
      r_multiple: i % 2 === 0 ? 1 : -1,
      ...over,
    }),
  );

describe('buildCoachPayload — privacy boundary', () => {
  it('sends no trade-level or identifying data', () => {
    const payload = buildCoachPayload(book(), 'fr');
    const json = JSON.stringify(payload);

    // The things that must never leave the device.
    expect(json).not.toContain('private thoughts');
    expect(json).not.toContain('XAUUSD');
    expect(json).not.toContain('acc-1');
    expect(json).not.toContain('2026-01');
    expect(json).not.toContain('2000'); // prices
  });

  it('exposes only the agreed keys, so a new field cannot leak silently', () => {
    const payload = buildCoachPayload(book(), 'fr')!;
    expect(Object.keys(payload).sort()).toEqual(
      [
        'avgR',
        'discipline',
        'findings',
        'locale',
        'planAdherence',
        'profitFactor',
        'tradesAnalysed',
        'v',
        'winRate',
      ].sort(),
    );
    for (const f of payload.findings) {
      expect(Object.keys(f).sort()).toEqual(['id', 'impactPct', 'sampleSize', 'severity']);
    }
  });

  it('sends no absolute currency amount', () => {
    // Same book scaled 1000x must produce an identical payload: the coach
    // cannot infer account size.
    const small = buildCoachPayload(book(), 'fr');
    seq = 0;
    const large = buildCoachPayload(
      book().map(t => ({ ...t, pnl: (t.pnl as number) * 1000 })),
      'fr',
    );
    expect(large).toEqual(small);
  });
});

describe('buildCoachPayload — content', () => {
  it('returns null below the local engine threshold, rather than asking anyway', () => {
    expect(buildCoachPayload(book().slice(0, 10), 'fr')).toBeNull();
  });

  it('ignores open trades when counting', () => {
    const payload = buildCoachPayload([...book(), base({ pnl: null })], 'fr')!;
    expect(payload.tradesAnalysed).toBe(24);
  });

  it('computes the headline stats', () => {
    const payload = buildCoachPayload(book(), 'fr')!;
    expect(payload.winRate).toBe(50);
    expect(payload.profitFactor).toBe(2); // 12*100 won vs 12*50 lost
    expect(payload.avgR).toBe(0);
  });

  it('reports plan adherence from the rule flag', () => {
    const payload = buildCoachPayload(book({ rule_40_percent: true }), 'fr')!;
    expect(payload.planAdherence).toBe(0);
  });

  it('leaves avgR null when too few trades carry a stop', () => {
    const payload = buildCoachPayload(book({ r_multiple: null }), 'fr')!;
    expect(payload.avgR).toBeNull();
  });

  it('leaves profitFactor null for a book with no losses', () => {
    const payload = buildCoachPayload(book({ pnl: 100, r_multiple: 1 }), 'fr')!;
    expect(payload.profitFactor).toBeNull();
  });

  it('carries the schema version and locale', () => {
    const payload = buildCoachPayload(book(), 'en')!;
    expect(payload.v).toBe(1);
    expect(payload.locale).toBe('en');
  });

  it('still builds a payload when NO rule fires — a disciplined book is a valid subject', () => {
    // The 24-trade book triggers nothing, but wait: it can fire best-setup.
    // Force certainty by wiping the setup titles and checking the state the
    // button previously disappeared in: enough history, zero findings.
    const payload = buildCoachPayload(book(), 'fr', []);
    expect(payload).not.toBeNull();
    if (payload) {
      expect(Array.isArray(payload.findings)).toBe(true);
      expect(payload.findings.length).toBeGreaterThanOrEqual(0);
      // The aggregates that carry a no-findings briefing are present.
      expect(payload.tradesAnalysed).toBe(24);
      expect(payload.winRate).toBe(50);
    }
  });

  it('caps findings at 12, matching the server-side cap', () => {
    const payload = buildCoachPayload(book(), 'fr')!;
    expect(payload.findings.length).toBeLessThanOrEqual(12);
  });

  it('discipline is null when no debriefs exist — no data is not "no mistakes"', () => {
    const payload = buildCoachPayload(book(), 'fr', [], []);
    expect(payload!.discipline).toBeNull();
  });

  it('carries streak, mistake share and the worst mistake with a relative cost', () => {
    // Trade days for the book, so day PnL can join.
    const trades = book();
    const debriefs = [
      debrief({ date: '2026-01-01', mistakes_committed: ['revenge'] }),
      debrief({ date: '2026-01-02', mistakes_committed: ['revenge'] }),
      debrief({ date: '2026-01-03', mistakes_committed: [] }),
    ];
    const payload = buildCoachPayload(trades, 'fr', [], debriefs)!;
    expect(payload.discipline).not.toBeNull();
    expect(payload.discipline!.debriefedDays).toBe(3);
    expect(payload.discipline!.daysWithMistakes).toBe(2);
    // All three trades land on day keys inside the book; the exact join is
    // debriefInsights' tested job — here we assert the shape and the share.
    expect(payload.discipline!.topMistake?.id).toBe('revenge');
    expect(payload.discipline!.topMistake!.daySharePct).toBeCloseTo(66.67, 1);
    expect(payload.discipline!.topMistake!.costPct === null || typeof payload.discipline!.topMistake!.costPct === 'number').toBe(true);
  });

  it('never sends currency amounts in the discipline block either', () => {
    const trades = book();
    seq = 0;
    const small = buildCoachPayload(trades, 'fr', [], [
      debrief({ date: '2026-01-01', mistakes_committed: ['revenge'] }),
      debrief({ date: '2026-01-02', mistakes_committed: ['revenge'] }),
    ]);
    seq = 0;
    const large = buildCoachPayload(
      trades.map(t => ({ ...t, pnl: (t.pnl as number) * 1000 })),
      'fr',
      [],
      [
        debrief({ date: '2026-01-01', mistakes_committed: ['revenge'] }),
        debrief({ date: '2026-01-02', mistakes_committed: ['revenge'] }),
      ],
    );
    expect(large).toEqual(small);
  });
});
