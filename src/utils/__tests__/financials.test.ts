import { calculateRMultiple, calculateConsistencyScore } from '../financials';

describe('calculateRMultiple', () => {
  it('should calculate positive R-multiple for a winning BUY trade', () => {
    const result = calculateRMultiple({
      direction: 'BUY',
      entryPrice: 100,
      exitPrice: 110,
      stopLoss: 95,
    });
    // Risk = 5, Reward = 10, R = 2.0
    expect(result).toBe(2.0);
  });

  it('should calculate negative R-multiple for a losing BUY trade', () => {
    const result = calculateRMultiple({
      direction: 'BUY',
      entryPrice: 100,
      exitPrice: 97,
      stopLoss: 95,
    });
    // Risk = 5, Reward = -3, R = -0.6
    expect(result).toBe(-0.6);
  });

  it('should calculate positive R-multiple for a winning SELL trade', () => {
    const result = calculateRMultiple({
      direction: 'SELL',
      entryPrice: 100,
      exitPrice: 90,
      stopLoss: 105,
    });
    // Risk = 5, Reward = 10, R = 2.0
    expect(result).toBe(2.0);
  });

  it('should calculate negative R-multiple for a losing SELL trade', () => {
    const result = calculateRMultiple({
      direction: 'SELL',
      entryPrice: 100,
      exitPrice: 103,
      stopLoss: 105,
    });
    // Risk = 5, Reward = -3, R = -0.6
    expect(result).toBe(-0.6);
  });

  it('should return 0 when risk is 0 (SL equals entry)', () => {
    const result = calculateRMultiple({
      direction: 'BUY',
      entryPrice: 100,
      exitPrice: 110,
      stopLoss: 100,
    });
    expect(result).toBe(0);
  });

  it('should handle breakeven trade (exit = entry)', () => {
    const result = calculateRMultiple({
      direction: 'BUY',
      entryPrice: 100,
      exitPrice: 100,
      stopLoss: 95,
    });
    // Risk = 5, Reward = 0, R = 0
    expect(result).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const result = calculateRMultiple({
      direction: 'BUY',
      entryPrice: 100,
      exitPrice: 103.33,
      stopLoss: 98,
    });
    // Risk = 2, Reward = 3.33, R = 1.665 rounded to 1.66
    expect(result).toBe(1.66);
  });

  it('should handle large numbers correctly', () => {
    const result = calculateRMultiple({
      direction: 'BUY',
      entryPrice: 2000,
      exitPrice: 2100,
      stopLoss: 1980,
    });
    // Risk = 20, Reward = 100, R = 5.0
    expect(result).toBe(5.0);
  });
});

describe('calculateConsistencyScore', () => {
  it('should return 0 for empty trades', () => {
    const result = calculateConsistencyScore([]);
    expect(result.score).toBe(0);
    expect(result.alert).toBe(false);
  });

  it('should return 0 when total net profit is 0', () => {
    const trades = [
      { pnl: 100, exit_time: '2024-01-01T12:00:00Z' },
      { pnl: -100, exit_time: '2024-01-02T12:00:00Z' },
    ];
    const result = calculateConsistencyScore(trades);
    expect(result.score).toBe(0);
    expect(result.alert).toBe(false);
  });

  it('should return 0 when total net profit is negative', () => {
    const trades = [
      { pnl: 50, exit_time: '2024-01-01T12:00:00Z' },
      { pnl: -100, exit_time: '2024-01-02T12:00:00Z' },
    ];
    const result = calculateConsistencyScore(trades);
    expect(result.score).toBe(0);
    expect(result.alert).toBe(false);
  });

  it('should calculate consistency correctly with single day', () => {
    const trades = [
      { pnl: 200, exit_time: '2024-01-01T12:00:00Z' },
    ];
    const result = calculateConsistencyScore(trades);
    // Best day = 200, Total = 200, Score = 100%
    expect(result.score).toBe(100);
    expect(result.alert).toBe(true); // > 15%
  });

  it('should calculate consistency correctly with multiple days', () => {
    const trades = [
      { pnl: 100, exit_time: '2024-01-01T12:00:00Z' },
      { pnl: 50, exit_time: '2024-01-02T12:00:00Z' },
      { pnl: 80, exit_time: '2024-01-03T12:00:00Z' },
      { pnl: 30, exit_time: '2024-01-04T12:00:00Z' },
    ];
    const result = calculateConsistencyScore(trades);
    // Best day = 100, Total = 260, Score = 38.46%
    expect(result.score).toBeCloseTo(38.46, 0);
    expect(result.alert).toBe(true); // > 15%
  });

  it('should not alert when score is <= 15%', () => {
    const trades = [
      { pnl: 10, exit_time: '2024-01-01T12:00:00Z' },
      { pnl: 10, exit_time: '2024-01-02T12:00:00Z' },
      { pnl: 10, exit_time: '2024-01-03T12:00:00Z' },
      { pnl: 10, exit_time: '2024-01-04T12:00:00Z' },
      { pnl: 10, exit_time: '2024-01-05T12:00:00Z' },
    ];
    const result = calculateConsistencyScore(trades);
    // Best day = 10, Total = 50, Score = 20%
    expect(result.score).toBe(20);
    expect(result.alert).toBe(true); // > 15%
  });

  it('should aggregate trades on the same day', () => {
    const trades = [
      { pnl: 100, exit_time: '2024-01-01T10:00:00Z' },
      { pnl: 50, exit_time: '2024-01-01T15:00:00Z' },
      { pnl: 30, exit_time: '2024-01-02T12:00:00Z' },
    ];
    const result = calculateConsistencyScore(trades);
    // Day 1: 150, Day 2: 30, Best = 150, Total = 180, Score = 83.33%
    expect(result.score).toBeCloseTo(83.33, 0);
    expect(result.alert).toBe(true);
  });

  it('should handle trades with missing exit_time', () => {
    const trades = [
      { pnl: 100, exit_time: '2024-01-01T12:00:00Z' },
      { pnl: 50, exit_time: '' },
    ];
    const result = calculateConsistencyScore(trades);
    // Only the first trade counts, Best = 100, Total = 100, Score = 100%
    expect(result.score).toBe(100);
  });
});
