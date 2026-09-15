import {
  calculatePositionSize,
  calculatePlannedRR,
  estimateRiskAtStop,
  INSTRUMENTS,
} from '../positionSizing';

describe('calculatePositionSize', () => {
  it('sizes gold so the stop costs exactly the risked amount', () => {
    // 1% of 100k = $1000 risk. Stop is 5.00 away = 50 pips (pip 0.1).
    // Pip value per lot = 0.1 * 100 = $10 → 50 * 10 = $500/lot → 2 lots.
    const r = calculatePositionSize({
      instrument: 'XAUUSD',
      balance: 100000,
      riskType: 'percent',
      riskValue: 1,
      entryPrice: 2000,
      stopLoss: 1995,
    });
    expect(r.riskAmount).toBe(1000);
    expect(r.stopPips).toBe(50);
    expect(r.pipValue).toBe(10);
    expect(r.lotSize).toBe(2);
  });

  it('round-trips: the sized position loses exactly the risk at stop', () => {
    const { lotSize, riskAmount } = calculatePositionSize({
      instrument: 'EURUSD',
      balance: 50000,
      riskType: 'percent',
      riskValue: 2,
      entryPrice: 1.1,
      stopLoss: 1.09,
    });
    const loss = estimateRiskAtStop('EURUSD', lotSize!, 1.1, 1.09);
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
    expect(r.lotSize).toBe(0.5);
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
    expect(tight.lotSize!).toBeGreaterThan(wide.lotSize!);
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
    expect(r.lotSize).toBeNull();
    expect(r.riskAmount).toBeNull();
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
  it('every spec has a positive pip and contract size', () => {
    Object.entries(INSTRUMENTS).forEach(([key, spec]) => {
      expect(spec.pip).toBeGreaterThan(0);
      expect(spec.contractSize).toBeGreaterThan(0);
      expect(spec.label).toBeTruthy();
      expect(key).toMatch(/^[A-Z0-9]+$/);
    });
  });
});
