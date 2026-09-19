import { buildJournalGapsReport, MAX_GAP_ROWS } from '../journalGaps';
import type { Trade } from '../../../types/domain';

/**
 * The card's ranking is the contract: the worst trades first, the same ones
 * the chat names, and open positions excluded because they cannot be
 * completed yet.
 */

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2418,
    stop_loss: 2395,
    take_profit: 2430,
    size: 1,
    entry_time: '2026-03-12T09:00:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 180,
    r_multiple: 1.8,
    mental_state: 'focused',
    tags: [],
    commission: 0,
    swap: 0,
    mae_price: 2397,
    mfe_price: 2422,
    notes: 'ok',
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

describe('buildJournalGapsReport', () => {
  it('is empty when every closed trade is complete', () => {
    const r = buildJournalGapsReport([trade()]);
    expect(r.audited).toBe(1);
    expect(r.incomplete).toBe(0);
    expect(r.rows).toEqual([]);
  });

  it('ranks the most-incomplete trades first, then most recent', () => {
    const empty = trade({
      id: 'empty',
      r_multiple: null as never,
      commission: null as never,
      swap: null as never,
      mae_price: null as never,
      mfe_price: null as never,
      take_profit: 0,
      notes: null,
    });
    const almost = trade({ id: 'almost', notes: null });
    const r = buildJournalGapsReport([almost, empty]);
    expect(r.rows[0].trade.id).toBe('empty');
    expect(r.rows[1].trade.id).toBe('almost');
  });

  it('counts each missing field across trades', () => {
    const a = trade({ id: 'a', notes: null });
    const b = trade({ id: 'b', notes: null, r_multiple: null as never });
    const r = buildJournalGapsReport([a, b]);
    expect(r.counts.notes).toBe(2);
    expect(r.counts.r).toBe(1);
    expect(r.incomplete).toBe(2);
  });

  it('excludes open positions from the audit', () => {
    const r = buildJournalGapsReport([
      trade({ id: 'open', pnl: null as never, notes: null as never }),
    ]);
    expect(r.audited).toBe(0);
    expect(r.incomplete).toBe(0);
  });

  it('respects its cap', () => {
    const many = Array.from({ length: MAX_GAP_ROWS + 10 }, (_, i) =>
      trade({ id: `x${i}`, notes: null })
    );
    expect(buildJournalGapsReport(many).rows).toHaveLength(MAX_GAP_ROWS);
  });

  it('marks rFillable only when entry, stop and exit allow derivation', () => {
    const r = buildJournalGapsReport([
      trade({ id: 'a', r_multiple: null as never }),
      trade({ id: 'b', r_multiple: null as never, stop_loss: 0 }),
    ]);
    const a = r.rows.find(row => row.trade.id === 'a')!;
    const b = r.rows.find(row => row.trade.id === 'b')!;
    expect(a.gaps.rFillable).toBe(true);
    expect(b.gaps.rFillable).toBe(false);
  });
});
