import { parseAction, resolveAction, patchFor, affectedTrades } from '../chatActions';
import type { BrokerCosts } from '../../sync/useBrokerCosts';
import type { Trade } from '../../../types/domain';

/**
 * set_costs is the one action whose values come from OUTSIDE the trade row
 * — the broker's staging record. The tests hold the line: the model cannot
 * type a number, a trade without broker data fails the whole proposal, and
 * a trade the trader already costed is never overwritten.
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
    commission: null as never,
    swap: null as never,
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

const costs = new Map<string, BrokerCosts>([
  ['a', { commission: 3.5, swap: 1.25 }],
  ['b', { commission: 0, swap: 0 }],
]);

describe('set_costs', () => {
  it('resolves when every named trade has broker data', () => {
    const parsed = parseAction({ kind: 'set_costs', tradeNs: [1, 2] })!;
    const res = resolveAction(parsed, [trade({ id: 'a' }), trade({ id: 'b' })], costs);
    expect(res.ok).toBe(true);
  });

  it('refuses the whole proposal when one trade lacks broker data', () => {
    const parsed = parseAction({ kind: 'set_costs', tradeNs: [1, 2] })!;
    const res = resolveAction(parsed, [trade({ id: 'a' }), trade({ id: 'zz' })], costs);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('not_available');
  });

  it('refuses without a broker map at all (manual journal)', () => {
    const parsed = parseAction({ kind: 'set_costs', tradeNs: [1] })!;
    const res = resolveAction(parsed, [trade({ id: 'a' })]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('not_available');
  });

  it('writes the broker values carried in the resolved action', () => {
    const target = trade({ id: 'a' });
    const parsed = parseAction({ kind: 'set_costs', tradeNs: [1] })!;
    const res = resolveAction(parsed, [target], costs);
    if (!res.ok) throw new Error('should resolve');
    expect(patchFor(res.action, target)).toEqual({ commission: 3.5, swap: 1.25 });
  });

  it('never overwrites a trade the trader already costed', () => {
    const costed = trade({ id: 'a', commission: 2, swap: 0 });
    const parsed = parseAction({ kind: 'set_costs', tradeNs: [1] })!;
    const res = resolveAction(parsed, [costed], costs);
    if (!res.ok) throw new Error('should resolve');
    expect(patchFor(res.action, costed)).toBeNull();
    expect(affectedTrades(res.action)).toHaveLength(0);
  });

  it('does not touch money fields the action never owns', () => {
    const target = trade({ id: 'a' });
    const parsed = parseAction({ kind: 'set_costs', tradeNs: [1] })!;
    const res = resolveAction(parsed, [target], costs);
    if (!res.ok) throw new Error('should resolve');
    const patch = patchFor(res.action, target)!;
    for (const forbidden of ['pnl', 'entry_price', 'exit_price', 'r_multiple', 'size']) {
      expect(patch).not.toHaveProperty(forbidden);
    }
  });
});
