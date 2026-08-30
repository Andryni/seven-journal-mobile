import { parseTradingViewExport } from '../importParsers';

describe('parseTradingViewExport — no fabricated data', () => {
  const csv = [
    'Symbol,Type,Entry Price,Exit Price,Profit,Contracts,Date/Time',
    'XAUUSD,BUY,2300.50,2310.00,95.00,1.0,2025-03-10T10:00:00Z',
    'EURUSD,SELL,1.0850,1.0900,-50.00,0.5,2025-03-11T14:30:00Z',
  ].join('\n');

  it('parses basic trade rows', () => {
    const trades = parseTradingViewExport(csv);
    expect(trades).toHaveLength(2);
    expect(trades[0].pair).toBe('XAUUSD');
    expect(trades[0].direction).toBe('BUY');
    expect(trades[0].pnl).toBe(95);
    expect(trades[1].direction).toBe('SELL');
  });

  it('NEVER fabricates an R-multiple (stays null without SL data)', () => {
    const trades = parseTradingViewExport(csv);
    for (const t of trades) {
      expect(t.r_multiple).toBeNull();
    }
  });

  it('NEVER fabricates SL/TP (0 = unknown, not a fake ±1% level)', () => {
    const trades = parseTradingViewExport(csv);
    for (const t of trades) {
      expect(t.stop_loss).toBe(0);
      expect(t.take_profit).toBe(0);
    }
  });

  it('does not invent an exit_time when the file has none', () => {
    const trades = parseTradingViewExport(csv);
    // No "exit time" column in the CSV → exit_time must stay null
    for (const t of trades) {
      expect(t.exit_time).toBeNull();
    }
  });

  it('uses the real exit time column when present', () => {
    const csvWithExit = [
      'Symbol,Type,Entry Price,Exit Price,Profit,Contracts,Date/Time,Exit Time',
      'XAUUSD,BUY,2300.50,2310.00,95.00,1.0,2025-03-10T10:00:00Z,2025-03-10T12:00:00Z',
    ].join('\n');
    const trades = parseTradingViewExport(csvWithExit);
    expect(trades[0].exit_time).toBe(new Date('2025-03-10T12:00:00Z').toISOString());
  });

  it('returns empty array for empty content', () => {
    expect(parseTradingViewExport('')).toEqual([]);
  });
});
