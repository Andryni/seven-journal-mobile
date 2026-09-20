import { fillCandidates, seedFillSignatures, tradeFillSignature } from '../brokerArrivals';
import type { Trade } from '../../../types/domain';

/**
 * The background fill runs on every trade-list change, so what it considers a
 * candidate has to be exactly right: too narrow and the terminal's answer to a
 * back-fill request never lands, too broad and the hook writes on every edit —
 * or worse, loops on its own write.
 */

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: 't1',
    pair: 'EURUSD',
    direction: 'BUY',
    entry_price: 1.1,
    exit_price: 1.11,
    stop_loss: 0,
    take_profit: 0,
    size: 1,
    entry_time: '2026-09-18T09:00:00Z',
    exit_time: '2026-09-18T10:00:00Z',
    pnl: 100,
    r_multiple: null,
    sync_source_id: 'stg-1',
    ...over,
  }) as Trade;

describe('fillCandidates', () => {
  it('treats a trade it has never seen as an arrival', () => {
    const seen = new Map<string, string>();
    expect(fillCandidates([trade()], seen).map(t => t.id)).toEqual(['t1']);
    // And only once: the second pass sees the same signature.
    expect(fillCandidates([trade()], seen)).toEqual([]);
  });

  it('ignores trades that are not broker-fed', () => {
    const seen = new Map<string, string>();
    expect(fillCandidates([trade({ sync_source_id: null })], seen)).toEqual([]);
  });

  it('re-considers a trade whose stop just arrived, now that its R is derivable', () => {
    const seen = seedFillSignatures([trade()]);
    // No stop yet: R cannot be derived, so the arrival is recorded and skipped.
    expect(fillCandidates([trade({ exit_price: 1.12 })], seen)).toEqual([]);
    // The terminal answered: stop and exit are both there, R becomes derivable.
    const filled = fillCandidates([trade({ stop_loss: 1.09, exit_price: 1.12 })], seen);
    expect(filled.map(t => t.id)).toEqual(['t1']);
  });

  it('does not re-fire once the R it derived is stored', () => {
    const seen = seedFillSignatures([trade({ stop_loss: 1.09, exit_price: 1.12 })]);
    // The write lands, the signature changes, and the stored R excludes it.
    expect(
      fillCandidates([trade({ stop_loss: 1.09, exit_price: 1.12, r_multiple: 2 })], seen)
    ).toEqual([]);
    // Even a later price touch with an R already stored stays out of the way.
    expect(
      fillCandidates(
        [trade({ stop_loss: 1.09, exit_price: 1.13, r_multiple: 2 })],
        seen
      )
    ).toEqual([]);
  });

  it('stays silent on fields the trader edits by hand', () => {
    const base = trade({ stop_loss: 1.09, exit_price: 1.12 });
    const seen = seedFillSignatures([base]);
    // The signature covers prices and costs only: a note is not an arrival.
    expect(fillCandidates([{ ...base, notes: 'reviewed' } as Trade], seen)).toEqual([]);
  });

  it('seeds without flagging the whole history', () => {
    const seen = seedFillSignatures([trade(), trade({ id: 't2', sync_source_id: 'stg-2' })]);
    expect(seen.size).toBe(2);
    expect(fillCandidates([trade(), trade({ id: 't2', sync_source_id: 'stg-2' })], seen)).toEqual(
      []
    );
  });
});

describe('tradeFillSignature', () => {
  it('changes when a fillable price changes, and not otherwise', () => {
    const a = trade({ stop_loss: 1.09 });
    expect(tradeFillSignature(a)).not.toBe(tradeFillSignature({ ...a, stop_loss: 0 } as Trade));
    expect(tradeFillSignature(a)).toBe(tradeFillSignature({ ...a, notes: 'x' } as Trade));
  });
});
