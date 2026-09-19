import { derivableR, rPatchFor } from '../rDerivation';
import type { Trade } from '../../types/domain';

/**
 * The R-multiple is the one figure the chat may write, and only because the
 * DEVICE derives it. These tests are mostly about the refusals: bad data
 * must not feed a ratio, same discipline as excursions.
 */

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2412,
    stop_loss: 2395,
    take_profit: 2425,
    size: 1,
    entry_time: '2026-03-12T09:00:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 120,
    r_multiple: null,
    mental_state: 'focused',
    tags: [],
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

describe('derivableR', () => {
  it('computes R from entry, stop and exit', () => {
    // risk = 5, move = 12 => 2.4R
    expect(derivableR(trade())).toBe(2.4);
  });

  it('respects the SELL direction', () => {
    // SELL: entry 2400, stop 2405 (above, risk 5), exit 2388 (12 down)
    const t = trade({ direction: 'SELL', stop_loss: 2405, exit_price: 2388 });
    expect(derivableR(t)).toBe(2.4);
  });

  it('signs a losing trade negatively', () => {
    const t = trade({ exit_price: 2393 }); // -7 on risk 5
    expect(derivableR(t)).toBe(-1.4);
  });

  it('rounds to two decimals', () => {
    const t = trade({ exit_price: 2406.333 });
    expect(derivableR(t)).toBe(1.27);
  });

  it('refuses a stop of zero — the schema default, not a real level', () => {
    expect(derivableR(trade({ stop_loss: 0 }))).toBeNull();
  });

  it('refuses a stop on the wrong side of the entry', () => {
    expect(derivableR(trade({ stop_loss: 2410, direction: 'BUY' }))).toBeNull();
  });

  it('refuses a missing or non-numeric exit', () => {
    expect(derivableR(trade({ exit_price: null as never }))).toBeNull();
    expect(derivableR(trade({ exit_price: NaN as never }))).toBeNull();
  });

  it('refuses an open position with no exit at all', () => {
    expect(derivableR(trade({ exit_price: undefined as never }))).toBeNull();
  });
});

describe('rPatchFor', () => {
  it('produces the derived R as the only patch key', () => {
    const patch = rPatchFor(trade())!;
    expect(patch).toEqual({ r_multiple: 2.4 });
  });

  it('writes nothing when R is already stored', () => {
    expect(rPatchFor(trade({ r_multiple: 1.8 }))).toBeNull();
  });

  it('writes nothing when R cannot be derived', () => {
    expect(rPatchFor(trade({ stop_loss: 0 }))).toBeNull();
  });
});
