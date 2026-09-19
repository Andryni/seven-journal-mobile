import { describe, it, expect } from '@jest/globals';
import {
  historyInsertFor,
  parseHistoryRow,
  historyForTrade,
  fillInfoForTrade,
  historyWhen,
} from '../fillHistory';

/**
 * The history is provenance, not state — its only job is to answer "qui a
 * rempli quoi, quand" without ever claiming a write that did not happen.
 * These tests are mostly about that honesty: mangled rows dropped, counts
 * exact, surfaces kept apart.
 */

const row = (over: Record<string, unknown> = {}) => ({
  id: 'h1',
  trade_id: 't1',
  source: 'app_button',
  kind: 'r_multiple',
  value: 2,
  detail: null,
  created_at: '2026-09-19T10:00:00.000Z',
  ...over,
});

describe('historyInsertFor', () => {
  it('sums |commission| + |swap| for a costs write', () => {
    expect(
      historyInsertFor(
        { tradeId: 't1', source: 'app_button', kind: 'costs', commission: 3.5, swap: 1.25 },
        'u1'
      )
    ).toEqual({
      user_id: 'u1',
      trade_id: 't1',
      source: 'app_button',
      kind: 'costs',
      value: 4.75,
      detail: null,
    });
  });

  it('stores the R magnitude for an r_multiple write', () => {
    expect(
      historyInsertFor({ tradeId: 't1', source: 'chat', kind: 'r_multiple', rMultiple: -1.5 }, 'u1').value
    ).toBe(1.5);
  });

  it('carries the detail text for tag and mental_state and keeps value at 0', () => {
    expect(
      historyInsertFor({ tradeId: 't1', source: 'chat', kind: 'tag', detail: 'breakout' }, 'u1')
    ).toMatchObject({ value: 0, detail: 'breakout' });
  });
});

describe('parseHistoryRow', () => {
  it('accepts a valid row of every kind and source', () => {
    for (const source of ['app_button', 'chat', 'auto']) {
      for (const kind of ['costs', 'r_multiple', 'tag', 'mental_state']) {
        expect(parseHistoryRow(row({ source, kind }))).not.toBeNull();
      }
    }
  });

  it('drops mangled rows rather than half-rendering them', () => {
    expect(parseHistoryRow(null)).toBeNull();
    expect(parseHistoryRow(row({ id: null }))).toBeNull();
    expect(parseHistoryRow(row({ trade_id: '' }))).toBeNull();
    expect(parseHistoryRow(row({ source: 'model' }))).toBeNull();
    expect(parseHistoryRow(row({ kind: 'pnl' }))).toBeNull();
    expect(parseHistoryRow(row({ value: '2' }))).toBeNull();
    expect(parseHistoryRow(row({ value: NaN }))).toBeNull();
  });
});

describe('historyForTrade', () => {
  it('filters by trade and sorts newest first', () => {
    const rows = [
      row({ id: 'a', trade_id: 't1', created_at: '2026-09-19T10:00:00Z' }),
      row({ id: 'b', trade_id: 't2', created_at: '2026-09-19T11:00:00Z' }),
      row({ id: 'c', trade_id: 't1', created_at: '2026-09-19T12:00:00Z' }),
    ];
    const got = historyForTrade(rows, 't1');
    expect(got.map(e => e.id)).toEqual(['c', 'a']);
  });

  it('caps to the limit', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ id: `h${i}`, created_at: new Date(2026, 8, 19, 0, i).toISOString() })
    );
    expect(historyForTrade(rows, 't1', 5)).toHaveLength(5);
  });
});

describe('fillInfoForTrade', () => {
  it('counts by kind and separates the two writer surfaces', () => {
    const rows = [
      row({ id: 'a', kind: 'costs', created_at: '2026-09-19T10:00:00Z' }),
      row({ id: 'b', kind: 'r_multiple', source: 'chat', created_at: '2026-09-19T11:00:00Z' }),
      row({ id: 'c', kind: 'costs', created_at: '2026-09-19T12:00:00Z' }),
      row({ id: 'd', trade_id: 'other', created_at: '2026-09-19T13:00:00Z' }),
    ];
    const info = fillInfoForTrade(rows, 't1');
    expect(info.counts).toEqual({ costs: 2, r: 1, other: 0 });
    expect(info.lastButton?.id).toBe('c');
    expect(info.lastChat?.id).toBe('b');
    expect(info.lastAuto).toBeNull();
  });

  it('tracks the most recent background write separately', () => {
    const rows = [
      row({ id: 'a', source: 'auto', kind: 'costs', created_at: '2026-09-19T09:00:00Z' }),
      row({ id: 'b', source: 'app_button', kind: 'r_multiple', created_at: '2026-09-19T10:00:00Z' }),
      row({ id: 'c', source: 'auto', kind: 'r_multiple', created_at: '2026-09-19T11:00:00Z' }),
    ];
    const info = fillInfoForTrade(rows, 't1');
    expect(info.lastAuto?.id).toBe('c');
    expect(info.lastButton?.id).toBe('b');
  });

  it('returns the empty summary for a trade with no history', () => {
    expect(fillInfoForTrade([], 't1').counts).toEqual({ costs: 0, r: 0, other: 0 });
    expect(fillInfoForTrade([], 't1').lastButton).toBeNull();
    expect(fillInfoForTrade([], 't1').lastChat).toBeNull();
  });
});

describe('historyWhen', () => {
  it('returns an ISO string for a valid date and "" for garbage', () => {
    expect(historyWhen(row({ created_at: '2026-09-19T10:00:00Z' }) as never)).toBe(
      '2026-09-19T10:00:00.000Z'
    );
    expect(historyWhen(row({ created_at: 'not-a-date' }) as never)).toBe('');
    expect(historyWhen(row({ created_at: '' }) as never)).toBe('');
  });
});
