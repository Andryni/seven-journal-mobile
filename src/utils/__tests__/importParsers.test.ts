import { parseTradingViewExport, generateTradeCSV } from '../importParsers';
import { parseCsv } from '../csv';

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

describe('parseTradingViewExport — robustness regressions', () => {
  it('does not shift columns when a field contains a quoted comma', () => {
    // Before RFC 4180 parsing this imported size=2010 and a garbage price.
    const csv = [
      'Symbol,Type,Entry price,Exit price,Size,Profit,Notes',
      'XAUUSD,Long,2000.5,2010.5,1.5,150,"Long, scaled in"',
    ].join('\n');
    const [t] = parseTradingViewExport(csv);
    expect(t.entry_price).toBeCloseTo(2000.5);
    expect(t.exit_price).toBeCloseTo(2010.5);
    expect(t.size).toBeCloseTo(1.5);
    expect(t.pnl).toBe(150);
  });

  it('reads localized numbers instead of truncating them', () => {
    const csv = ['Symbol,Type,Price,Profit', 'XAUUSD,Long,"2 000,50","1,234.56"'].join('\n');
    const [t] = parseTradingViewExport(csv);
    expect(t.entry_price).toBeCloseTo(2000.5);
    expect(t.pnl).toBeCloseTo(1234.56);
  });

  it('accepts semicolon-delimited exports', () => {
    const csv = ['Symbol;Type;Price;Profit', 'EURUSD;Short;1.0850;-40'].join('\n');
    const [t] = parseTradingViewExport(csv);
    expect(t.pair).toBe('EURUSD');
    expect(t.direction).toBe('SELL');
    expect(t.pnl).toBe(-40);
  });

  it('never invents risk data', () => {
    const csv = ['Symbol,Type,Price,Profit', 'XAUUSD,Long,2000,150'].join('\n');
    const [t] = parseTradingViewExport(csv);
    expect(t.stop_loss).toBe(0);
    expect(t.take_profit).toBe(0);
    expect(t.r_multiple).toBeNull();
  });

  it('skips rows with no usable entry price rather than importing zeros', () => {
    const csv = [
      'Symbol,Type,Price,Profit',
      'XAUUSD,Long,,150',
      'XAUUSD,Long,2000,150',
    ].join('\n');
    expect(parseTradingViewExport(csv)).toHaveLength(1);
  });

  it('marks a row with no profit as still open', () => {
    const csv = ['Symbol,Type,Price,Profit', 'XAUUSD,Long,2000,'].join('\n');
    const [t] = parseTradingViewExport(csv);
    expect(t.pnl).toBeNull();
    expect(t.result).toBe('OPEN');
  });
});

describe('generateTradeCSV', () => {
  const trade = {
    id: '1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1990,
    take_profit: 2020,
    size: 1,
    timeframe: 'H1',
    entry_time: '2026-01-13T09:30:00.000Z',
    exit_time: '2026-01-13T10:30:00.000Z',
    pnl: 100,
    r_multiple: 1,
    result: 'TP',
    mental_state: 'CALM',
    notes: 'Long, scaled in — said "ok"',
  } as never;

  it('escapes a note containing commas and quotes', () => {
    const line = generateTradeCSV([trade]).split('\n')[1];
    expect(line).toContain('"Long, scaled in — said ""ok"""');
  });

  it('survives a round-trip back through the CSV parser', () => {
    // The exported file is only useful if it can be read back intact.
    const rows = parseCsv(generateTradeCSV([trade]));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(rows[0].length);
    expect(rows[1][rows[0].indexOf('Notes')]).toBe('Long, scaled in — said "ok"');
    expect(rows[1][rows[0].indexOf('PnL')]).toBe('100');
  });
});

describe('parseTradingViewExport — exit reason is not the P&L sign', () => {
  const csv = [
    'Symbol,Type,Entry Price,Exit Price,Profit,Contracts,Date/Time',
    'XAUUSD,BUY,2300.50,2310.00,95.00,1.0,2025-03-10T10:00:00Z',
    'EURUSD,SELL,1.0850,1.0900,-50.00,0.5,2025-03-11T14:30:00Z',
  ].join('\n');

  it('does not claim a target was hit on a profitable row', () => {
    // TradingView exports carry no TP level, so there is no evidence the
    // target was reached. Labelling every green row 'TP' inflated the hit
    // rate of every setup in the playbook.
    const trades = parseTradingViewExport(csv);
    expect(trades[0].pnl).toBe(95);
    expect(trades[0].result).not.toBe('TP');
  });

  it('does not claim a stop was hit on a losing row', () => {
    const trades = parseTradingViewExport(csv);
    expect(trades[1].pnl).toBe(-50);
    expect(trades[1].result).not.toBe('SL');
  });

  it('preserves the real P&L, which is what statistics classify on', () => {
    const trades = parseTradingViewExport(csv);
    expect(trades[0].pnl).toBeGreaterThan(0);
    expect(trades[1].pnl).toBeLessThan(0);
  });
});
