import { appliedActionLine, resolveAction, parseAction, type ChatActionKind } from '../chatActions';
import type { Trade } from '../../../types/domain';

/**
 * What the coach is told about a change the trader already confirmed.
 *
 * The failure this guards against is subtle and was observed live: the coach
 * proposed a broker back-fill, the trader tapped APPLIQUER, and the very next
 * answer said "nothing has been done yet" — because the applied state exists
 * only on the device, after the reply was written. The line has to state what
 * DID happen, and for the terminal request say precisely that the fields are
 * still empty.
 */

const t = ((key: string, ...args: unknown[]) =>
  `${key}:${args.map(a => String(a)).join('|')}`) as never;

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: 't1',
    pair: 'EURUSD',
    direction: 'BUY',
    entry_price: 1.1,
    exit_price: 1.11,
    stop_loss: 1.09,
    take_profit: 1.13,
    size: 1,
    entry_time: '2026-09-18T09:00:00Z',
    exit_time: '2026-09-18T10:00:00Z',
    pnl: 100,
    r_multiple: null,
    sync_source_id: 'stg-1',
    ...over,
  }) as Trade;

function lineFor(kind: ChatActionKind, extra: Record<string, unknown> = {}, over: Partial<Trade> = {}) {
  const target = trade(over);
  const parsed = parseAction({ kind, tradeNs: [1], ...extra });
  if (!parsed) throw new Error('action should parse');
  // A broker cost map for every target: that is what licenses set_costs, and
  // it changes nothing for the other kinds.
  const costs = new Map([[target.id, { commission: 1, swap: 0 }]]);
  const res = resolveAction(parsed, [target], costs);
  if (!res.ok) throw new Error(`action should resolve: ${res.reason}`);
  return appliedActionLine(res.action, t);
}

describe('appliedActionLine', () => {
  it('names the tag and the count for add_tag', () => {
    expect(lineFor('add_tag', { tag: 'revenge' })).toBe('chatAppliedTag:revenge|1');
  });

  it('names the mental state', () => {
    expect(lineFor('set_mental_state', { mentalState: 'focused' })).toBe(
      'chatAppliedMental:focused|1'
    );
  });

  it('reports the derived R and the broker costs', () => {
    expect(lineFor('set_r_multiple')).toBe('chatAppliedR:1');
    expect(lineFor('set_costs')).toBe('chatAppliedCosts:1');
  });

  it('says a terminal request was SENT, not that the data is filled', () => {
    // The async half is the whole reason this line exists verbatim.
    expect(lineFor('request_broker_fill')).toBe('chatAppliedBroker:1');
  });

  it('says nothing about an action that changes no data', () => {
    expect(lineFor('filter_trades')).toBe('');
  });

  it('counts the target trades, not the sent window', () => {
    const parsed = parseAction({ kind: 'add_tag', tradeNs: [1, 2, 99], tag: 'a' });
    if (!parsed) throw new Error('should parse');
    const res = resolveAction(parsed, [trade({ id: 'a' }), trade({ id: 'b' })]);
    if (!res.ok) throw new Error('should resolve');
    expect(appliedActionLine(res.action, t)).toBe('chatAppliedTag:a|2');
  });
});
