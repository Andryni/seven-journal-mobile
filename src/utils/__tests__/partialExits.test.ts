import {
  sortedExits,
  closedSize,
  remainingSize,
  isFullyScaledOut,
  exitsPnl,
  averageExitPrice,
  reconcile,
  analyseScaleOut,
} from '../partialExits';
import type { Trade, TradeExit } from '../../types/domain';

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 100,
    exit_price: 110,
    stop_loss: 90,
    take_profit: 130,
    size: 3,
    entry_time: '2025-01-01T10:00:00Z',
    exit_time: '2025-01-01T12:00:00Z',
    pnl: 30,
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

function exit(over: Partial<TradeExit> = {}): TradeExit {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u',
    trade_id: 't1',
    size: 1,
    price: 110,
    exit_time: '2025-01-01T11:00:00Z',
    pnl: 10,
    note: null,
    created_at: '2025-01-01T11:00:00Z',
    ...over,
  } as TradeExit;
}

describe('sortedExits', () => {
  it('orders chronologically', () => {
    const late = exit({ exit_time: '2025-01-01T12:00:00Z', price: 120 });
    const early = exit({ exit_time: '2025-01-01T10:30:00Z', price: 105 });
    expect(sortedExits([late, early]).map(e => e.price)).toEqual([105, 120]);
  });

  it('tolerates undefined', () => {
    expect(sortedExits(undefined)).toEqual([]);
  });
});

describe('closedSize / remainingSize', () => {
  it('sums the closed quantity', () => {
    expect(closedSize([exit({ size: 1 }), exit({ size: 0.5 })])).toBe(1.5);
  });

  it('reports what is still open', () => {
    expect(remainingSize(trade({ size: 3 }), [exit({ size: 1 })])).toBe(2);
  });

  it('never reports a negative remainder', () => {
    // Over-closing is a data error, not a negative position.
    expect(remainingSize(trade({ size: 1 }), [exit({ size: 5 })])).toBe(0);
  });

  it('treats a trade with no exits as fully open', () => {
    expect(remainingSize(trade({ size: 3 }), [])).toBe(3);
  });
});

describe('isFullyScaledOut', () => {
  it('is true once the whole size is closed', () => {
    expect(isFullyScaledOut(trade({ size: 2 }), [exit({ size: 1 }), exit({ size: 1 })])).toBe(
      true
    );
  });

  it('is false while part of the position remains', () => {
    expect(isFullyScaledOut(trade({ size: 3 }), [exit({ size: 1 })])).toBe(false);
  });

  it('is false with no exits at all', () => {
    expect(isFullyScaledOut(trade(), [])).toBe(false);
  });

  it('tolerates floating point dust', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; the position is still closed.
    const exits = [exit({ size: 0.1 }), exit({ size: 0.2 })];
    expect(isFullyScaledOut(trade({ size: 0.3 }), exits)).toBe(true);
  });
});

describe('exitsPnl', () => {
  it('sums recorded slice results', () => {
    expect(exitsPnl([exit({ pnl: 10 }), exit({ pnl: -4 })])).toBe(6);
  });

  it('is null when no slice carries a P&L', () => {
    // A trader may log levels without splitting the money; 0 would read as a
    // breakeven scale-out, which is a different claim.
    expect(exitsPnl([exit({ pnl: null }), exit({ pnl: null })])).toBeNull();
  });

  it('ignores slices without a P&L rather than counting them as 0', () => {
    expect(exitsPnl([exit({ pnl: 10 }), exit({ pnl: null })])).toBe(10);
  });
});

describe('averageExitPrice', () => {
  it('weights by size, so a scratch does not outweigh a real exit', () => {
    // Plain mean would be 105; weighted by size it is 101.
    const exits = [exit({ size: 0.1, price: 150 }), exit({ size: 4.9, price: 100 })];
    expect(averageExitPrice(exits)).toBe(101);
  });

  it('is null with no usable exits', () => {
    expect(averageExitPrice([])).toBeNull();
  });

  it('ignores exits with a non-positive size', () => {
    expect(averageExitPrice([exit({ size: 0, price: 999 }), exit({ size: 1, price: 110 })])).toBe(
      110
    );
  });
});

describe('reconcile', () => {
  it('reports no-exits for a plain trade', () => {
    expect(reconcile(trade(), []).status).toBe('no-exits');
  });

  it('reports consistent when sizes and money add up', () => {
    const exits = [exit({ size: 1.5, pnl: 15 }), exit({ size: 1.5, pnl: 15 })];
    const r = reconcile(trade({ size: 3, pnl: 30 }), exits);
    expect(r.status).toBe('consistent');
    expect(r.remaining).toBe(0);
    expect(r.difference).toBe(0);
  });

  it('reports partial while some of the position is open', () => {
    const r = reconcile(trade({ size: 3, pnl: 10 }), [exit({ size: 1, pnl: 10 })]);
    expect(r.status).toBe('partial');
    expect(r.remaining).toBe(2);
  });

  it('flags a P&L mismatch instead of silently preferring one number', () => {
    // The slices say 25, the trade says 30. Neither is quietly overridden.
    const exits = [exit({ size: 1.5, pnl: 10 }), exit({ size: 1.5, pnl: 15 })];
    const r = reconcile(trade({ size: 3, pnl: 30 }), exits);
    expect(r.status).toBe('pnl-mismatch');
    expect(r.difference).toBe(-5);
  });

  it('flags oversized exits before looking at the money', () => {
    // When the sizes are impossible, the money is not the finding to report.
    const exits = [exit({ size: 5, pnl: 10 })];
    expect(reconcile(trade({ size: 1, pnl: 30 }), exits).status).toBe('oversized');
  });

  it('does not claim a mismatch when slices carry no P&L', () => {
    const exits = [exit({ size: 1.5, pnl: null }), exit({ size: 1.5, pnl: null })];
    const r = reconcile(trade({ size: 3, pnl: 30 }), exits);
    expect(r.status).toBe('consistent');
    expect(r.difference).toBeNull();
  });

  it('tolerates rounding dust rather than crying mismatch', () => {
    const exits = [exit({ size: 1.5, pnl: 10 }), exit({ size: 1.5, pnl: 20.005 })];
    expect(reconcile(trade({ size: 3, pnl: 30 }), exits).status).toBe('consistent');
  });

  it('still reports a mismatch on an open trade with no net P&L', () => {
    const r = reconcile(trade({ size: 3, pnl: null }), [exit({ size: 1, pnl: 10 })]);
    expect(r.tradeTotal).toBeNull();
    expect(r.difference).toBeNull();
    expect(r.status).toBe('partial');
  });
});

describe('analyseScaleOut', () => {
  it('needs at least two exits to have an opinion', () => {
    const a = analyseScaleOut(trade(), [exit()]);
    expect(a.scaleOutEdge).toBeNull();
  });

  it('reports that scaling out cost money when price kept running', () => {
    // Exited half at 105 and half at 120; holding everything to 120 was better.
    const exits = [
      exit({ size: 1.5, price: 105, exit_time: '2025-01-01T11:00:00Z' }),
      exit({ size: 1.5, price: 120, exit_time: '2025-01-01T12:00:00Z' }),
    ];
    const a = analyseScaleOut(trade({ size: 3, pnl: 37.5, entry_price: 100 }), exits);
    expect(a.averagePrice).toBe(112.5);
    expect(a.scaleOutEdge).toBeGreaterThan(0);
  });

  it('reports that scaling out protected profit when price came back', () => {
    // Took 130 early, the rest at 105: holding all to 105 would have been worse.
    const exits = [
      exit({ size: 1.5, price: 130, exit_time: '2025-01-01T11:00:00Z' }),
      exit({ size: 1.5, price: 105, exit_time: '2025-01-01T12:00:00Z' }),
    ];
    const a = analyseScaleOut(trade({ size: 3, pnl: 52.5, entry_price: 100 }), exits);
    expect(a.scaleOutEdge).toBeLessThan(0);
  });

  it('handles a short, where profit is below entry', () => {
    const exits = [
      exit({ size: 1, price: 95, exit_time: '2025-01-01T11:00:00Z' }),
      exit({ size: 1, price: 80, exit_time: '2025-01-01T12:00:00Z' }),
    ];
    const a = analyseScaleOut(
      trade({ direction: 'SELL', size: 2, entry_price: 100, pnl: 25 }),
      exits
    );
    // Holding to 80 would have beaten the 87.5 average.
    expect(a.scaleOutEdge).toBeGreaterThan(0);
  });

  it('refuses a verdict when the entry price is missing', () => {
    const exits = [exit({ size: 1, price: 105 }), exit({ size: 1, price: 110 })];
    const a = analyseScaleOut(
      trade({ entry_price: undefined as unknown as number }),
      exits
    );
    expect(a.scaleOutEdge).toBeNull();
  });

  it('refuses a verdict when the trade has no P&L yet', () => {
    const exits = [
      exit({ size: 1, price: 105, exit_time: '2025-01-01T11:00:00Z' }),
      exit({ size: 1, price: 110, exit_time: '2025-01-01T12:00:00Z' }),
    ];
    expect(analyseScaleOut(trade({ pnl: null }), exits).scaleOutEdge).toBeNull();
  });

  it('does not divide by zero on a breakeven average', () => {
    const exits = [
      exit({ size: 1, price: 100, exit_time: '2025-01-01T11:00:00Z' }),
      exit({ size: 1, price: 100, exit_time: '2025-01-01T12:00:00Z' }),
    ];
    const a = analyseScaleOut(trade({ entry_price: 100, size: 2, pnl: 0 }), exits);
    expect(a.heldToLastPnl).toBeNull();
    expect(a.scaleOutEdge).toBeNull();
  });
});
