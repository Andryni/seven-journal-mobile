import {
  isImported,
  isFieldFilled,
  missingFields,
  completeness,
  auditCompleteness,
  CONTEXT_FIELDS,
} from '../tradeCompleteness';
import type { Trade } from '../../../types/domain';

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2418,
    size: 1,
    entry_time: '2026-03-12T09:00:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 180,
    r_multiple: 1.8,
    timeframe: 'M15',
    mental_state: 'focused',
    setup_structures: [],
    setup_fvg: false,
    setup_ob: false,
    setup_liquidity_sweep: false,
    notes: null,
    tags: [],
    seeded_fields: [],
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

/** What promote_sync_trades produces: numbers real, context invented. */
const imported = (over: Partial<Trade> = {}) =>
  trade({
    sync_source_id: 's1',
    mental_state: 'focused',
    timeframe: 'M15',
    seeded_fields: ['mental_state', 'timeframe', 'setup', 'notes'],
    ...over,
  } as Partial<Trade>);

describe('a seeded field is not a filled field', () => {
  it('rejects a mental_state the bridge invented', () => {
    // The whole point: this looks identical to a chosen 'focused'.
    expect(imported().mental_state).toBe('focused');
    expect(isFieldFilled(imported(), 'mental_state')).toBe(false);
  });

  it('accepts the same value once the trader has actually chosen it', () => {
    const edited = imported({ mental_state: 'focused', seeded_fields: ['setup', 'notes'] });
    expect(isFieldFilled(edited, 'mental_state')).toBe(true);
  });

  it('rejects the fallback timeframe but accepts a stated one', () => {
    expect(isFieldFilled(imported(), 'timeframe')).toBe(false);
    expect(
      isFieldFilled(imported({ timeframe: 'H1', seeded_fields: ['setup'] }), 'timeframe')
    ).toBe(true);
  });
});

describe('isFieldFilled', () => {
  it('treats whitespace-only notes as empty', () => {
    expect(isFieldFilled(trade({ notes: '   ' }), 'notes')).toBe(false);
    expect(isFieldFilled(trade({ notes: 'chased the move' }), 'notes')).toBe(true);
  });

  it('counts any setup signal, not just the structures array', () => {
    expect(isFieldFilled(trade(), 'setup')).toBe(false);
    expect(isFieldFilled(trade({ setup_fvg: true }), 'setup')).toBe(true);
    expect(isFieldFilled(trade({ setup_structures: ['BOS'] }), 'setup')).toBe(true);
  });

  it('treats an empty tag list as unset', () => {
    expect(isFieldFilled(trade({ tags: [] }), 'tags')).toBe(false);
    expect(isFieldFilled(trade({ tags: ['news'] }), 'tags')).toBe(true);
  });

  it('survives a row with no seeded_fields column at all', () => {
    // A database that has not run the migration returns undefined here.
    const legacy = trade({ seeded_fields: undefined as never });
    expect(() => missingFields(legacy)).not.toThrow();
    expect(isFieldFilled(legacy, 'mental_state')).toBe(true);
  });
});

describe('isImported', () => {
  it('recognises a bridged trade', () => {
    expect(isImported(imported())).toBe(true);
  });

  it('does not flag a hand-written one', () => {
    expect(isImported(trade())).toBe(false);
  });
});

describe('completeness', () => {
  it('is zero for a fresh import and one for a fully qualified trade', () => {
    expect(completeness(imported({ tags: [] }))).toBe(0);
    expect(
      completeness(
        trade({
          mental_state: 'fomo',
          timeframe: 'H1',
          setup_fvg: true,
          notes: 'late entry',
          tags: ['news'],
        })
      )
    ).toBe(1);
  });

  it('ignores prices, which the bridge always supplies', () => {
    // Otherwise every import would read as majority-complete and the number
    // would stop prompting anything.
    const noPrices = imported({ entry_price: 0, exit_price: 0 } as Partial<Trade>);
    expect(completeness(noPrices)).toBe(0);
  });
});

describe('auditCompleteness', () => {
  it('reports the honest denominator behind mental-state statistics', () => {
    const trades = [
      ...Array.from({ length: 12 }, (_, i) => imported({ id: `i${i}` })),
      ...Array.from({ length: 34 }, (_, i) =>
        trade({ id: `m${i}`, mental_state: 'fomo', seeded_fields: [] })
      ),
    ];
    const report = auditCompleteness(trades);

    expect(report.total).toBe(46);
    // The figure the chat should quote: 34 assessed, not 46.
    expect(report.assessed).toBe(34);
    expect(report.incomplete).toBeGreaterThanOrEqual(12);
    expect(report.byField.mental_state).toBe(12);
  });

  it('counts each missing field separately', () => {
    const report = auditCompleteness([imported()]);
    expect(report.byField.mental_state).toBe(1);
    expect(report.byField.timeframe).toBe(1);
    expect(report.byField.setup).toBe(1);
    expect(report.byField.notes).toBe(1);
  });

  it('lists the worst offenders first', () => {
    const almost = trade({
      id: 'almost',
      mental_state: 'fomo',
      timeframe: 'H1',
      setup_fvg: true,
      notes: 'ok',
      tags: [],
      seeded_fields: [],
    });
    const empty = imported({ id: 'empty' });
    const report = auditCompleteness([almost, empty]);
    expect(report.worst[0].id).toBe('empty');
  });

  it('returns zeroes on an empty journal rather than NaN', () => {
    const report = auditCompleteness([]);
    expect(report.total).toBe(0);
    expect(report.assessed).toBe(0);
    for (const f of CONTEXT_FIELDS) expect(report.byField[f]).toBe(0);
  });

  it('caps the worst list', () => {
    const many = Array.from({ length: 40 }, (_, i) => imported({ id: `x${i}` }));
    expect(auditCompleteness(many, 5).worst).toHaveLength(5);
  });
});
