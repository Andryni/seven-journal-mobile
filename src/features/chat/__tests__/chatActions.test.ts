import {
  parseAction,
  resolveAction,
  patchFor,
  affectedTrades,
  MAX_TARGETS,
  MENTAL_STATES,
} from '../chatActions';
import type { Trade } from '../../../types/domain';

/**
 * Most of these tests are about what the coach CANNOT do.
 *
 * This is the first place a model is allowed to change journal data, so the
 * refusals matter more than the happy path: a hallucinated trade number, a
 * mental state outside the schema, an unbounded bulk edit.
 */

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'acc1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2410,
    size: 1,
    entry_time: '2026-03-12T09:00:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 100,
    r_multiple: 1,
    mental_state: 'focused',
    tags: [],
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

const window3 = [
  trade({ id: 'a' }),
  trade({ id: 'b' }),
  trade({ id: 'c' }),
];

describe('parseAction — only the shapes we defined', () => {
  it('parses a tag proposal', () => {
    const a = parseAction({ kind: 'add_tag', tradeNs: [1, 2], tag: 'revenge' })!;
    expect(a.kind).toBe('add_tag');
    expect(a.tradeNs).toEqual([1, 2]);
  });

  it('refuses a kind that is not in the contract', () => {
    // delete_trade, set_pnl and friends are unreachable by construction:
    // the model cannot propose what the type cannot express.
    for (const kind of ['delete_trade', 'set_pnl', 'update_price', '', null]) {
      expect(parseAction({ kind, tradeNs: [1] })).toBeNull();
    }
  });

  it('discards non-numeric or negative trade numbers', () => {
    const a = parseAction({ kind: 'add_tag', tradeNs: [1, -2, 'x', null, 3.7], tag: 'n' })!;
    expect(a.tradeNs).toEqual([1, 4]);
  });

  it('survives junk of every shape', () => {
    for (const junk of [null, undefined, 42, 'x', [], {}]) {
      expect(() => parseAction(junk)).not.toThrow();
      expect(parseAction(junk)).toBeNull();
    }
  });
});

describe('resolveAction — a hallucinated trade cannot hit a real row', () => {
  it('ignores trade numbers outside the sent window', () => {
    // The model saw three trades. "Trade 97" does not exist and must not
    // resolve to anything.
    const parsed = parseAction({ kind: 'add_tag', tradeNs: [97], tag: 'x' })!;
    const res = resolveAction(parsed, window3);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('no_targets');
  });

  it('keeps the valid targets when one is out of range', () => {
    // Naming one trade it cannot see should not stop it acting on the rest.
    const parsed = parseAction({ kind: 'add_tag', tradeNs: [1, 99, 3], tag: 'news' })!;
    const res = resolveAction(parsed, window3);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.action.tradeIds).toEqual(['a', 'c']);
  });

  it('deduplicates repeated targets', () => {
    const parsed = parseAction({ kind: 'add_tag', tradeNs: [2, 2, 2], tag: 'news' })!;
    const res = resolveAction(parsed, window3);
    if (res.ok) expect(res.action.tradeIds).toEqual(['b']);
  });

  it('refuses an unbounded bulk edit', () => {
    // A confirmation listing hundreds of trades is not a confirmation.
    const many = Array.from({ length: MAX_TARGETS + 5 }, (_, i) => trade({ id: `x${i}` }));
    const parsed = parseAction({
      kind: 'set_mental_state',
      tradeNs: many.map((_, i) => i + 1),
      mentalState: 'fomo',
    })!;
    const res = resolveAction(parsed, many);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('too_many_targets');
  });
});

describe('resolveAction — values must satisfy the schema', () => {
  it('refuses a mental state the database would reject', () => {
    // mental_state carries a CHECK; an invented value would fail at write
    // time, after the user confirmed.
    const parsed = parseAction({
      kind: 'set_mental_state',
      tradeNs: [1],
      mentalState: 'zen',
    })!;
    const res = resolveAction(parsed, window3);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('invalid_mental_state');
  });

  it('accepts every state the schema allows', () => {
    for (const state of MENTAL_STATES) {
      const parsed = parseAction({
        kind: 'set_mental_state',
        tradeNs: [1],
        mentalState: state,
      })!;
      expect(resolveAction(parsed, window3).ok).toBe(true);
    }
  });

  it('refuses an empty or unusable tag', () => {
    for (const tag of ['', '   ', undefined]) {
      const parsed = parseAction({ kind: 'add_tag', tradeNs: [1], tag })!;
      const res = resolveAction(parsed, window3);
      expect(res.ok).toBe(false);
    }
  });
});

describe('patchFor — additive and idempotent', () => {
  it('merges a tag rather than replacing the list', () => {
    // Confirming a proposal must never silently drop annotations the trader
    // added by hand.
    const t = trade({ tags: ['news'] });
    const res = resolveAction(
      parseAction({ kind: 'add_tag', tradeNs: [1], tag: 'revenge' })!,
      [t]
    );
    if (!res.ok) throw new Error('should resolve');
    const patch = patchFor(res.action, t)!;
    expect(patch.tags).toEqual(expect.arrayContaining(['news', 'revenge']));
  });

  it('writes nothing when the tag is already present', () => {
    const t = trade({ tags: ['revenge'] });
    const res = resolveAction(
      parseAction({ kind: 'add_tag', tradeNs: [1], tag: 'revenge' })!,
      [t]
    );
    if (!res.ok) throw new Error('should resolve');
    expect(patchFor(res.action, t)).toBeNull();
  });

  it('writes nothing when the mental state already matches', () => {
    const t = trade({ mental_state: 'fomo' });
    const res = resolveAction(
      parseAction({ kind: 'set_mental_state', tradeNs: [1], mentalState: 'fomo' })!,
      [t]
    );
    if (!res.ok) throw new Error('should resolve');
    expect(patchFor(res.action, t)).toBeNull();
  });

  it('never produces a patch touching money or identity', () => {
    const t = trade();
    const res = resolveAction(
      parseAction({ kind: 'set_mental_state', tradeNs: [1], mentalState: 'tired' })!,
      [t]
    );
    if (!res.ok) throw new Error('should resolve');
    const patch = patchFor(res.action, t)!;
    for (const forbidden of ['pnl', 'entry_price', 'exit_price', 'size', 'id', 'account_id']) {
      expect(patch).not.toHaveProperty(forbidden);
    }
  });

  it('changes no data for a filter action', () => {
    const res = resolveAction(
      parseAction({ kind: 'filter_trades', tradeNs: [1, 2] })!,
      window3
    );
    if (!res.ok) throw new Error('should resolve');
    expect(patchFor(res.action, window3[0])).toBeNull();
  });
});

describe('affectedTrades', () => {
  it('counts only the trades that would really change', () => {
    // The confirmation should say "2 trades", not "3", when one already
    // carries the tag.
    const trades = [
      trade({ id: 'a', tags: [] }),
      trade({ id: 'b', tags: ['news'] }),
      trade({ id: 'c', tags: [] }),
    ];
    const res = resolveAction(
      parseAction({ kind: 'add_tag', tradeNs: [1, 2, 3], tag: 'news' })!,
      trades
    );
    if (!res.ok) throw new Error('should resolve');
    expect(affectedTrades(res.action).map(t => t.id)).toEqual(['a', 'c']);
  });
});
