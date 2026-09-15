import {
  riskPerUnit,
  hasExcursions,
  maeR,
  mfeR,
  realisedR,
  captureRatio,
  isNearMiss,
  isGiveBack,
  summarizeExcursions,
} from '../excursions';
import type { Trade } from '../../types/domain';

// Minimal trade factory: only the fields excursion maths reads are meaningful,
// the rest exist to satisfy the type.
function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 'id',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 100,
    exit_price: 110,
    stop_loss: 90,
    take_profit: 130,
    size: 1,
    entry_time: '2025-01-01T10:00:00Z',
    exit_time: '2025-01-01T12:00:00Z',
    pnl: 10,
    r_multiple: 1,
    timeframe: 'M15',
    setup_structures: [],
    setup_fvg: false,
    setup_ob: false,
    setup_liquidity_sweep: false,
    bookmap_absorption: null,
    bookmap_passive_orders: null,
    bookmap_aggressive_orders: null,
    bookmap_vwap_position: null,
    mental_state: 'focused',
    cookie_jar_ref: false,
    rule_40_percent: false,
    screenshot_before_url: null,
    screenshot_after_url: null,
    notes: null,
    result: 'TP',
    session: 'London',
    created_at: '2025-01-01T10:00:00Z',
    ...over,
  } as Trade;
}

describe('riskPerUnit', () => {
  it('is the entry-to-stop distance', () => {
    expect(riskPerUnit({ entry_price: 100, stop_loss: 90 })).toBe(10);
  });

  it('works for a short, where the stop sits above entry', () => {
    expect(riskPerUnit({ entry_price: 100, stop_loss: 110 })).toBe(10);
  });

  it('rejects a stop of 0, which means "no stop set" in this schema', () => {
    // Treating the schema default as a real price would make risk 100 and
    // every R figure meaninglessly small.
    expect(riskPerUnit({ entry_price: 100, stop_loss: 0 })).toBeNull();
  });
});

describe('maeR — how far underwater a trade went', () => {
  it('measures adverse excursion in R for a long', () => {
    // Risk 10, worst price 95 => 5 against => 0.5R.
    expect(maeR(trade({ mae_price: 95 }))).toBe(0.5);
  });

  it('measures adverse excursion for a short', () => {
    // Short from 100, stop 110 (risk 10), price spiked to 105 => 0.5R.
    const t = trade({ direction: 'SELL', entry_price: 100, stop_loss: 110, mae_price: 105 });
    expect(maeR(t)).toBe(0.5);
  });

  it('clamps to 0 when the trade never traded below entry', () => {
    // A runner that never pulled back has no adverse excursion; a negative
    // number here would be read as a gain.
    expect(maeR(trade({ mae_price: 104 }))).toBe(0);
  });

  it('returns null when MAE was never recorded', () => {
    expect(maeR(trade({ mae_price: null }))).toBeNull();
  });

  it('returns null rather than 0 when there is no usable stop', () => {
    // 0 would claim the trade never went against us, which is a lie.
    expect(maeR(trade({ stop_loss: 0, mae_price: 95 }))).toBeNull();
  });
});

describe('mfeR — how far a trade ran in favour', () => {
  it('measures favourable excursion for a long', () => {
    expect(mfeR(trade({ mfe_price: 130 }))).toBe(3);
  });

  it('measures favourable excursion for a short', () => {
    const t = trade({ direction: 'SELL', entry_price: 100, stop_loss: 110, mfe_price: 70 });
    expect(mfeR(t)).toBe(3);
  });

  it('clamps to 0 for a trade that never went green', () => {
    expect(mfeR(trade({ mfe_price: 98 }))).toBe(0);
  });
});

describe('realisedR', () => {
  it('derives the result in R from the prices', () => {
    expect(realisedR(trade({ exit_price: 110 }))).toBe(1);
  });

  it('is negative for a loser', () => {
    expect(realisedR(trade({ exit_price: 95, pnl: -5 }))).toBe(-0.5);
  });

  it('is null while the trade is still open', () => {
    expect(realisedR(trade({ exit_price: null }))).toBeNull();
  });
});

describe('captureRatio — the share of the move actually taken', () => {
  it('reports the fraction of MFE that was realised', () => {
    // Ran to +3R, closed at +1R => captured a third.
    expect(captureRatio(trade({ mfe_price: 130, exit_price: 110 }))).toBe(0.33);
  });

  it('is 1 when the trade exited at its high', () => {
    expect(captureRatio(trade({ mfe_price: 110, exit_price: 110 }))).toBe(1);
  });

  it('is null when the trade never went favourable', () => {
    // There was nothing to capture; a 0 would blame the exit for a trade that
    // never offered a profit in the first place.
    expect(captureRatio(trade({ mfe_price: 100, exit_price: 95, pnl: -5 }))).toBeNull();
  });

  it('clamps rather than exceeding 1 on inconsistent data', () => {
    const t = trade({ mfe_price: 105, exit_price: 120, pnl: 20 });
    expect(captureRatio(t)).toBe(1);
  });

  it('floors at 0 for a loser that had been green', () => {
    expect(captureRatio(trade({ mfe_price: 120, exit_price: 95, pnl: -5 }))).toBe(0);
  });
});

describe('near misses and give-backs', () => {
  it('flags a winner that nearly hit its stop', () => {
    expect(isNearMiss(trade({ mae_price: 91.5, pnl: 10 }))).toBe(true);
  });

  it('does not flag a comfortable winner', () => {
    expect(isNearMiss(trade({ mae_price: 98, pnl: 10 }))).toBe(false);
  });

  it('does not flag a loser as a near miss', () => {
    // A loser that hit its stop is not a near miss, it is a miss.
    expect(isNearMiss(trade({ mae_price: 90, pnl: -10 }))).toBe(false);
  });

  it('flags a loser that had been up a full R', () => {
    expect(isGiveBack(trade({ mfe_price: 115, pnl: -10 }))).toBe(true);
  });

  it('does not flag a loser that never went green', () => {
    expect(isGiveBack(trade({ mfe_price: 101, pnl: -10 }))).toBe(false);
  });
});

describe('summarizeExcursions', () => {
  it('returns a null-shaped summary for no trades', () => {
    const s = summarizeExcursions([]);
    expect(s.trades).toBe(0);
    expect(s.avgMae).toBeNull();
    expect(s.targetsTooTight).toBe(false);
  });

  it('ignores open trades, whose excursions are still moving', () => {
    const s = summarizeExcursions([trade({ pnl: null, mae_price: 95 })]);
    expect(s.trades).toBe(0);
    expect(s.tradesWithData).toBe(0);
  });

  it('counts only trades that carry excursion data', () => {
    const s = summarizeExcursions([
      trade({ mae_price: 95 }),
      trade({ mae_price: null, mfe_price: null }),
    ]);
    expect(s.trades).toBe(2);
    expect(s.tradesWithData).toBe(1);
  });

  it('never presents undocumented trades as zero-excursion', () => {
    // The whole book lacks data: averages must stay null, not collapse to 0.
    const s = summarizeExcursions([trade({ mae_price: null, mfe_price: null })]);
    expect(s.avgMae).toBeNull();
    expect(s.avgMfe).toBeNull();
  });

  it('averages MAE and MFE separately', () => {
    const s = summarizeExcursions([
      trade({ mae_price: 95, mfe_price: 110 }),
      trade({ mae_price: 90, mfe_price: 120 }),
    ]);
    expect(s.avgMae).toBe(0.75);
    expect(s.avgMfe).toBe(1.5);
  });

  it('separates the heat winners survive from losers', () => {
    const s = summarizeExcursions([
      trade({ mae_price: 95, pnl: 10 }),
      trade({ mae_price: 90, pnl: -10, mfe_price: 115 }),
    ]);
    expect(s.avgMaeWinners).toBe(0.5);
    expect(s.avgMfeLosers).toBe(1.5);
  });

  it('detects targets that are systematically too tight', () => {
    // Six winners each running 4R and closing at 1R: a quarter captured.
    const trades = Array.from({ length: 6 }, () =>
      trade({ mfe_price: 140, exit_price: 110, pnl: 10 })
    );
    const s = summarizeExcursions(trades);
    expect(s.avgCapture).toBe(0.25);
    expect(s.targetsTooTight).toBe(true);
  });

  it('does not claim tight targets off a tiny sample', () => {
    // Two trades is variance, not a pattern worth acting on.
    const trades = Array.from({ length: 2 }, () =>
      trade({ mfe_price: 140, exit_price: 110, pnl: 10 })
    );
    expect(summarizeExcursions(trades).targetsTooTight).toBe(false);
  });

  it('does not claim tight targets when exits are efficient', () => {
    const trades = Array.from({ length: 6 }, () =>
      trade({ mfe_price: 112, exit_price: 110, pnl: 10 })
    );
    expect(summarizeExcursions(trades).targetsTooTight).toBe(false);
  });

  it('suggests a tighter stop when winners never use the full risk', () => {
    // Winners peak at 0.3R of heat; losers all run past it to the stop.
    const winners = Array.from({ length: 6 }, () =>
      trade({ mae_price: 97, exit_price: 110, pnl: 10 })
    );
    const losers = Array.from({ length: 6 }, () =>
      trade({ mae_price: 90, exit_price: 90, pnl: -10 })
    );
    const s = summarizeExcursions([...winners, ...losers]);
    expect(s.suggestedStopR).toBe(0.3);
  });

  it('stays silent on stops when the sample is too small', () => {
    const s = summarizeExcursions([
      trade({ mae_price: 97, pnl: 10 }),
      trade({ mae_price: 90, pnl: -10 }),
    ]);
    expect(s.suggestedStopR).toBeNull();
  });

  it('stays silent when winners genuinely need the full stop', () => {
    // Tightening here would cut real winners, so no suggestion is made.
    const winners = Array.from({ length: 6 }, () =>
      trade({ mae_price: 90.5, exit_price: 110, pnl: 10 })
    );
    const losers = Array.from({ length: 6 }, () =>
      trade({ mae_price: 90, exit_price: 90, pnl: -10 })
    );
    expect(summarizeExcursions([...winners, ...losers]).suggestedStopR).toBeNull();
  });

  it('stays silent when losers would not have been caught anyway', () => {
    // Winners are cool, but losers also die quickly: a tighter stop saves
    // nothing, so suggesting one would be noise.
    const winners = Array.from({ length: 6 }, () =>
      trade({ mae_price: 97, exit_price: 110, pnl: 10 })
    );
    const losers = Array.from({ length: 6 }, () =>
      trade({ mae_price: 98, exit_price: 95, pnl: -5 })
    );
    expect(summarizeExcursions([...winners, ...losers]).suggestedStopR).toBeNull();
  });

  it('counts near misses and give-backs', () => {
    const s = summarizeExcursions([
      trade({ mae_price: 91, pnl: 10 }),
      trade({ mfe_price: 120, pnl: -10, exit_price: 95 }),
    ]);
    expect(s.nearMisses).toBe(1);
    expect(s.giveBacks).toBe(1);
  });

  it('survives rows missing the columns entirely', () => {
    // An unmigrated database returns trades without these keys at all.
    const bare = trade();
    delete (bare as Record<string, unknown>).mae_price;
    delete (bare as Record<string, unknown>).mfe_price;
    expect(() => summarizeExcursions([bare])).not.toThrow();
    expect(summarizeExcursions([bare]).tradesWithData).toBe(0);
  });

  it('tolerates a null trade list', () => {
    expect(summarizeExcursions(null as unknown as Trade[]).trades).toBe(0);
  });
});

describe('hasExcursions', () => {
  it('is true when either side is recorded', () => {
    expect(hasExcursions({ mae_price: 95, mfe_price: null })).toBe(true);
    expect(hasExcursions({ mae_price: null, mfe_price: 110 })).toBe(true);
  });

  it('is false when neither is', () => {
    expect(hasExcursions({ mae_price: null, mfe_price: null })).toBe(false);
  });
});
