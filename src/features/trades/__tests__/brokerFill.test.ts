import { fillPatchFor } from '../brokerFill';
import type { BrokerCosts } from '../../sync/useBrokerCosts';
import type { Trade } from '../../../types/domain';

/**
 * The one-tap fill writes on behalf of a single confirmation, so these tests
 * hold its three promises: nothing overwritten, costs only from the broker's
 * own record, R only from the trade's own prices. Idempotence is what lets
 * the button stay enabled after a partial failure.
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
    take_profit: 2430,
    size: 1,
    entry_time: '2026-03-12T09:00:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 120,
    r_multiple: null as never,
    mental_state: 'focused',
    tags: [],
    commission: null as never,
    swap: null as never,
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

const costs = new Map<string, BrokerCosts>([
  ['a', { commission: 3.5, swap: 1.25 }],
  // The broker knows b but recorded nothing: not a fill source.
  ['b', { commission: 0, swap: 0 }],
]);

describe('fillPatchFor', () => {
  it('plans costs then derived R for a fully fillable trade', () => {
    // entry 2400, stop 2395 (risk 5), exit 2412 => 2.4R
    const plan = fillPatchFor([trade({ id: 'a' })], costs);
    expect(plan.patches).toEqual([
      { tradeId: 'a', commission: 3.5, swap: 1.25, rMultiple: 2.4 },
    ]);
    expect(plan.costsCount).toBe(1);
    expect(plan.rCount).toBe(1);
  });

  it('derives R even without any broker data — the prices suffice', () => {
    const plan = fillPatchFor([trade({ id: 'x' })], costs);
    expect(plan.patches[0].rMultiple).toBe(2.4);
    expect(plan.patches[0].commission).toBeUndefined();
    expect(plan.costsCount).toBe(0);
  });

  it('never touches a trade the trader already costed', () => {
    const plan = fillPatchFor(
      [trade({ id: 'a', commission: 2, swap: 0 })],
      costs
    );
    // R is still derivable and null, so the trade appears — costs do not.
    expect(plan.patches[0].commission).toBeUndefined();
    expect(plan.patches[0].rMultiple).toBe(2.4);
    expect(plan.costsCount).toBe(0);
  });

  it('never touches a trade whose R is already stored', () => {
    const plan = fillPatchFor([trade({ id: 'b', r_multiple: 1.5 })], costs);
    // Costs ARE fillable here (broker says 0/0, journal has none).
    expect(plan.patches[0].commission).toBe(0);
    expect(plan.patches[0].rMultiple).toBeUndefined();
  });

  it('skips trades with nothing to fill', () => {
    const plan = fillPatchFor(
      [trade({ id: 'z', r_multiple: 1.5 })],
      costs
    );
    expect(plan.patches).toEqual([]);
  });

  it('is idempotent: an empty broker map and stored R leave nothing', () => {
    const trades = [trade({ id: 'x', r_multiple: 2.4 })];
    expect(fillPatchFor(trades, null).patches).toEqual([]);
    expect(fillPatchFor(trades, new Map()).patches).toEqual([]);
  });

  it('refuses to fabricate R when the prices cannot', () => {
    // stop 0 = "no stop recorded": derivation must refuse.
    const plan = fillPatchFor([trade({ id: 'q', stop_loss: 0 })], null);
    expect(plan.patches).toEqual([]);
  });
});
