import {
  calculatePositionSize,
  calculatePlannedRR,
  estimateRiskAtStop,
  instrumentsForMarket,
  unitForMarket,
  formatSize,
  estimatePnl,
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  MARKET_TYPES,
} from '../positionSizing';

describe('calculatePositionSize', () => {
  it('sizes gold so the stop costs exactly the risked amount', () => {
    // 1% of 100k = $1000 risk. Stop is 5.00 away = 50 pips (pip 0.1).
    // Tick value per lot = $10 → 50 ticks * 10 = $500/lot → 2 lots.
    const r = calculatePositionSize({
      instrument: 'XAUUSD',
      balance: 100000,
      riskType: 'percent',
      riskValue: 1,
      entryPrice: 2000,
      stopLoss: 1995,
    });
    expect(r.riskAmount).toBe(1000);
    expect(r.stopTicks).toBe(50);
    expect(r.tickValue).toBe(10);
    expect(r.size).toBe(2);
    expect(r.unit).toBe('lot');
  });

  it('round-trips: the sized position loses exactly the risk at stop', () => {
    const { size, riskAmount } = calculatePositionSize({
      instrument: 'EURUSD',
      balance: 50000,
      riskType: 'percent',
      riskValue: 2,
      entryPrice: 1.1,
      stopLoss: 1.09,
    });
    const loss = estimateRiskAtStop('EURUSD', size!, 1.1, 1.09);
    expect(loss).toBeCloseTo(riskAmount!, 0);
  });

  it('accepts an absolute currency risk', () => {
    const r = calculatePositionSize({
      instrument: 'XAUUSD',
      balance: 100000,
      riskType: 'usd',
      riskValue: 250,
      entryPrice: 2000,
      stopLoss: 1995,
    });
    expect(r.riskAmount).toBe(250);
    expect(r.size).toBe(0.5);
  });

  it('scales inversely with stop distance', () => {
    const tight = calculatePositionSize({
      instrument: 'XAUUSD', balance: 100000, riskType: 'percent',
      riskValue: 1, entryPrice: 2000, stopLoss: 1999,
    });
    const wide = calculatePositionSize({
      instrument: 'XAUUSD', balance: 100000, riskType: 'percent',
      riskValue: 1, entryPrice: 2000, stopLoss: 1990,
    });
    expect(tight.size!).toBeGreaterThan(wide.size!);
  });

  it.each([
    ['unknown instrument', { instrument: 'DOGEUSD' }],
    ['zero balance', { balance: 0 }],
    ['zero risk', { riskValue: 0 }],
    ['stop equal to entry', { stopLoss: 2000 }],
    ['negative entry', { entryPrice: -1 }],
    ['NaN entry', { entryPrice: NaN }],
  ])('returns nulls for %s', (_label, override) => {
    const r = calculatePositionSize({
      instrument: 'XAUUSD',
      balance: 100000,
      riskType: 'percent',
      riskValue: 1,
      entryPrice: 2000,
      stopLoss: 1995,
      ...(override as object),
    });
    expect(r.size).toBeNull();
  });
});

describe('calculatePlannedRR', () => {
  it('computes 2R for a long with twice the reward', () => {
    expect(calculatePlannedRR('BUY', 100, 95, 110)).toBe(2);
  });

  it('computes 2R for the mirrored short', () => {
    expect(calculatePlannedRR('SELL', 100, 105, 90)).toBe(2);
  });

  it('is negative when the target sits the wrong side of entry', () => {
    expect(calculatePlannedRR('BUY', 100, 95, 90)!).toBeLessThan(0);
  });

  it('returns null when the stop is at entry', () => {
    expect(calculatePlannedRR('BUY', 100, 100, 110)).toBeNull();
  });

  it('returns null on missing inputs', () => {
    expect(calculatePlannedRR('BUY', 0, 95, 110)).toBeNull();
  });
});

describe('INSTRUMENTS', () => {
  it('every spec is internally coherent', () => {
    Object.entries(INSTRUMENTS).forEach(([key, spec]) => {
      expect(spec.tick).toBeGreaterThan(0);
      expect(spec.tickValue).toBeGreaterThan(0);
      expect(spec.step).toBeGreaterThan(0);
      expect(spec.label).toBeTruthy();
      expect(key).toMatch(/^[A-Z0-9]+$/);
      // The unit must agree with the market, or screens will label sizes wrong.
      expect(spec.unit).toBe(unitForMarket(spec.market));
    });
  });

  it('prices futures in whole contracts only', () => {
    instrumentsForMarket('Futures').forEach(k => {
      expect(INSTRUMENTS[k].step).toBe(1);
    });
  });

  it('partitions the catalogue across the three markets', () => {
    const total = MARKET_TYPES.reduce((n, m) => n + instrumentsForMarket(m).length, 0);
    expect(total).toBe(INSTRUMENT_KEYS.length);
  });
});

describe('futures sizing', () => {
  it('returns whole contracts, never a fraction', () => {
    // $1000 risk, ES stop 8 pts = 32 ticks * $12.50 = $400/contract
    // → exact 2.5 contracts, floored to 2.
    const r = calculatePositionSize({
      instrument: 'ES', balance: 100000, riskType: 'usd',
      riskValue: 1000, entryPrice: 5000, stopLoss: 4992,
    });
    expect(r.size).toBe(2);
    expect(r.unit).toBe('contract');
    expect(Number.isInteger(r.size!)).toBe(true);
  });

  it('reports the risk of the rounded size, not the requested budget', () => {
    const r = calculatePositionSize({
      instrument: 'ES', balance: 100000, riskType: 'usd',
      riskValue: 1000, entryPrice: 5000, stopLoss: 4992,
    });
    expect(r.riskAmount).toBe(1000);
    expect(r.actualRisk).toBe(800); // 2 contracts, not the 2.5 asked for
    expect(r.actualRisk!).toBeLessThanOrEqual(r.riskAmount!);
  });

  it('flags a budget too small for even one contract', () => {
    const r = calculatePositionSize({
      instrument: 'ES', balance: 2000, riskType: 'usd',
      riskValue: 100, entryPrice: 5000, stopLoss: 4992,
    });
    expect(r.size).toBeNull();
    expect(r.belowMinimum).toBe(true);
    // The trader still needs to see why it is impossible.
    expect(r.riskAmount).toBe(100);
    expect(r.stopTicks).toBe(32);
  });

  it('lets the micro contract take the trade the e-mini cannot', () => {
    const args = {
      balance: 2000, riskType: 'usd' as const,
      riskValue: 100, entryPrice: 5000, stopLoss: 4992,
    };
    expect(calculatePositionSize({ ...args, instrument: 'ES' }).size).toBeNull();
    expect(calculatePositionSize({ ...args, instrument: 'MES' }).size).toBe(2);
  });
});

describe('crypto sizing', () => {
  it('sizes in fractional coin units', () => {
    // $500 risk, BTC stop $1000 = 100000 ticks * 0.01 = $1000 per coin → 0.5
    const r = calculatePositionSize({
      instrument: 'BTCUSD', balance: 50000, riskType: 'usd',
      riskValue: 500, entryPrice: 60000, stopLoss: 59000,
    });
    expect(r.size).toBeCloseTo(0.5, 4);
    expect(r.unit).toBe('unit');
  });
});

describe('never exceeds the stated risk budget', () => {
  it.each(INSTRUMENT_KEYS)('%s floors rather than rounds up', key => {
    const entry = INSTRUMENTS[key].tick * 10000;
    const r = calculatePositionSize({
      instrument: key, balance: 100000, riskType: 'usd',
      riskValue: 777, entryPrice: entry, stopLoss: entry - INSTRUMENTS[key].tick * 37,
    });
    if (r.size !== null) {
      expect(r.actualRisk!).toBeLessThanOrEqual(r.riskAmount!);
    }
  });
});

describe('formatSize', () => {
  it('shows contracts as integers and lots to 2dp', () => {
    expect(formatSize(3, 'contract')).toBe('3');
    expect(formatSize(1.5, 'lot')).toBe('1.50');
  });

  it('trims trailing zeros on crypto units', () => {
    expect(formatSize(0.5, 'unit')).toBe('0.5');
  });
});

describe('estimatePnl', () => {
  it('values a 10 point gold move on 1 lot at $1000', () => {
    // 10 / 0.1 = 100 ticks * $10 = $1000
    expect(estimatePnl('XAUUSD', 1, 10)).toBe(1000);
  });

  it('values 1 ES point on 1 contract at $50', () => {
    // 1 / 0.25 = 4 ticks * $12.50
    expect(estimatePnl('ES', 1, 1)).toBe(50);
  });

  it('prices the micro at a tenth of the e-mini', () => {
    expect(estimatePnl('MES', 1, 1) * 10).toBeCloseTo(estimatePnl('ES', 1, 1), 6);
  });

  it('returns a loss for an adverse move', () => {
    expect(estimatePnl('ES', 2, -3)).toBe(-300);
  });

  it('agrees with the sizing engine on what the stop costs', () => {
    const r = calculatePositionSize({
      instrument: 'NQ', balance: 100000, riskType: 'usd',
      riskValue: 1000, entryPrice: 20000, stopLoss: 19950,
    });
    expect(estimatePnl('NQ', r.size!, -50)).toBeCloseTo(-r.actualRisk!, 2);
  });

  it('falls back to a 1:1 tick for an unknown symbol', () => {
    expect(estimatePnl('WHATEVER', 3, 2)).toBe(6);
  });
});
