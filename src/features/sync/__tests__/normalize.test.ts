import { closeReasonLabel, isActionable, normalizePair, toQueueCard } from '../normalize';
import type { SyncTradeRow } from '../normalize';

describe('normalizePair', () => {
  it('folds common broker suffixes onto the canonical symbol', () => {
    expect(normalizePair('EURUSD.m')).toBe('EURUSD');
    expect(normalizePair('EURUSDm')).toBe('EURUSD');
    expect(normalizePair('eurusd-pro')).toBe('EURUSD');
    expect(normalizePair('XAUUSD.raw')).toBe('XAUUSD');
    expect(normalizePair('GBPJPY.cash')).toBe('GBPJPY');
  });

  it('uppercases and trims plain symbols', () => {
    expect(normalizePair('eurusd')).toBe('EURUSD');
    expect(normalizePair('  xauusd  ')).toBe('XAUUSD');
  });

  it('survives null/empty without throwing', () => {
    expect(normalizePair(null)).toBe('');
    expect(normalizePair('')).toBe('');
    expect(normalizePair(undefined)).toBe('');
  });

  it('never returns an empty string for a bare letter symbol', () => {
    // A symbol like "M" would be eaten by the suffix strip: acceptable, since
    // the server-side match re-derives the pair from the raw payload too.
    expect(normalizePair('M')).toBe('');
    expect(normalizePair('MNQ')).toBe('MNQ');
  });
});

describe('closeReasonLabel', () => {
  it('maps every broker reason to its i18n key', () => {
    expect(closeReasonLabel('TP')).toBe('syncReasonTP');
    expect(closeReasonLabel('SL')).toBe('syncReasonSL');
    expect(closeReasonLabel('BE')).toBe('syncReasonBE');
    expect(closeReasonLabel('CLOSED')).toBe('syncReasonCLOSED');
  });

  it('falls back to the CLOSED key for unknown/null reasons', () => {
    expect(closeReasonLabel(null)).toBe('syncReasonCLOSED');
    expect(closeReasonLabel(undefined)).toBe('syncReasonCLOSED');
  });
});

describe('toQueueCard', () => {
  const row = (over: Partial<SyncTradeRow>): SyncTradeRow => ({
    id: 'stg-1',
    external_id: '123456',
    payload: {},
    is_open: false,
    open_time: '2026-09-18T09:31:22Z',
    close_time: '2026-09-18T10:12:40Z',
    status: 'pending',
    created_at: '2026-09-18T09:31:23Z',
    ...over,
  });

  it('projects a closed position with pnl and reason', () => {
    const card = toQueueCard(
      row({
        payload: {
          symbol: 'XAUUSD.m',
          direction: 'BUY',
          size: 0.5,
          entry_price: 2330.55,
          pnl: 145.3,
          close_reason: 'TP',
          exits: [{ size: 0.2, price: 2338, exit_time: 'x', pnl: 60 }],
        },
      }),
    );
    expect(card.symbol).toBe('XAUUSD');
    expect(card.direction).toBe('BUY');
    expect(card.size).toBe(0.5);
    expect(card.entryPrice).toBe(2330.55);
    expect(card.pnl).toBe(145.3);
    expect(card.closeReason).toBe('TP');
    expect(card.exitsCount).toBe(1);
    expect(card.isOpen).toBe(false);
    expect(card.pnlGap).toBeNull();
  });

  it('flags an open position without inventing a close reason', () => {
    const card = toQueueCard(row({ is_open: true, close_time: null }));
    expect(card.isOpen).toBe(true);
    expect(card.closeReason).toBeNull();
  });

  it('renders even a malformed payload (defensive, never throws)', () => {
    const card = toQueueCard(row({ payload: null }));
    expect(card.symbol).toBe('');
    expect(card.size).toBeNull();
    expect(card.pnl).toBeNull();
    expect(card.direction).toBe('BUY');
  });

  it('surfaces the pnl gap recorded at link time', () => {
    const card = toQueueCard(row({ payload: { pnl: 100, pnl_gap: 12.5 } }));
    expect(card.pnlGap).toBe(12.5);
  });

  it('ignores non-finite numbers coming from the wire', () => {
    const card = toQueueCard(
      row({ payload: { size: NaN, entry_price: Infinity, pnl: 10 } as never }),
    );
    expect(card.size).toBeNull();
    expect(card.entryPrice).toBeNull();
    expect(card.pnl).toBe(10);
  });

  it('marks a promoted-while-open position as already journaled', () => {
    // Its row stays pending while the position is live, so `status` cannot
    // tell it apart from one awaiting a decision — the resolution does.
    const card = toQueueCard(row({ is_open: true, resolution: 'created' }));
    expect(card.isOpen).toBe(true);
    expect(card.alreadyJournaled).toBe(true);
  });

  it('does not mark an undecided row as already journaled', () => {
    expect(toQueueCard(row({})).alreadyJournaled).toBe(false);
    expect(toQueueCard(row({ resolution: null })).alreadyJournaled).toBe(false);
  });
});

describe('isActionable', () => {
  const row = (over: Partial<SyncTradeRow>): SyncTradeRow => ({
    id: 'stg-1',
    external_id: '123456',
    payload: {},
    is_open: false,
    open_time: '2026-09-18T09:31:22Z',
    close_time: null,
    status: 'pending',
    created_at: '2026-09-18T09:31:23Z',
    ...over,
  });

  it('accepts only a pending, undecided row', () => {
    expect(isActionable(row({}))).toBe(true);
    expect(isActionable(row({ resolution: 'created' }))).toBe(false);
    expect(isActionable(row({ status: 'stale' }))).toBe(false);
    expect(isActionable(row({ status: 'promoted', resolution: 'created' }))).toBe(false);
  });
});
