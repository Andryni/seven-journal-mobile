import { tradeCost, hasCost, grossPnl, summarizeCosts } from '../tradingCosts';
import type { Trade } from '../../types/domain';

let seq = 0;

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t${seq++}`,
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1990,
    take_profit: 2020,
    size: 1,
    entry_time: '2026-01-05T10:00:00.000Z',
    exit_time: '2026-01-05T11:00:00.000Z',
    pnl: 100,
    commission: 0,
    swap: 0,
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
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as Trade;

beforeEach(() => {
  seq = 0;
});

describe('tradeCost', () => {
  it('sums commission and swap', () => {
    expect(tradeCost({ commission: 7, swap: 2.5 })).toBe(9.5);
  });

  it('treats missing cost data as zero, not as an error', () => {
    // A database that has not run the migration returns neither field.
    expect(tradeCost({} as Trade)).toBe(0);
    expect(tradeCost({ commission: null, swap: null })).toBe(0);
    expect(tradeCost({ commission: undefined, swap: undefined })).toBe(0);
  });

  it('normalises brokers that export costs as negative numbers', () => {
    // MT4 reports commission as -7.00. Adding that as-is would turn a cost
    // into a credit and inflate gross P&L.
    expect(tradeCost({ commission: -7, swap: -1.2 })).toBe(8.2);
  });

  it('ignores non-finite values', () => {
    expect(tradeCost({ commission: NaN, swap: 3 })).toBe(3);
  });
});

describe('hasCost', () => {
  it('distinguishes a recorded zero from a real cost', () => {
    expect(hasCost({ commission: 0, swap: 0 })).toBe(false);
    expect(hasCost({ commission: 0.5, swap: 0 })).toBe(true);
  });
});

describe('grossPnl', () => {
  it('adds costs back to the net result', () => {
    // Net 100 after paying 9.50 means the trade actually earned 109.50.
    expect(grossPnl({ pnl: 100, commission: 7, swap: 2.5 })).toBe(109.5);
  });

  it('equals net when no costs are recorded', () => {
    expect(grossPnl({ pnl: 100, commission: 0, swap: 0 })).toBe(100);
  });

  it('returns null for an open trade', () => {
    expect(grossPnl({ pnl: null, commission: 7, swap: 0 })).toBeNull();
  });

  it('makes a small loss look like a smaller loss before costs', () => {
    // -3 net having paid 7 in commission means the trade was actually +4 gross:
    // the setup worked and the broker took the edge.
    expect(grossPnl({ pnl: -3, commission: 7, swap: 0 })).toBe(4);
  });
});

describe('summarizeCosts', () => {
  it('returns a zeroed summary for an empty book', () => {
    const s = summarizeCosts([]);
    expect(s.trades).toBe(0);
    expect(s.totalCost).toBe(0);
    expect(s.avgCostPerTrade).toBe(0);
    expect(s.costRatioPct).toBeNull();
    expect(s.profitableBeforeCostsOnly).toBe(false);
  });

  it('excludes open trades from the summary', () => {
    const s = summarizeCosts([
      trade({ pnl: 100, commission: 7 }),
      trade({ pnl: null, commission: 7 }),
    ]);
    expect(s.trades).toBe(1);
    expect(s.totalCommission).toBe(7);
  });

  it('separates commission from swap', () => {
    const s = summarizeCosts([
      trade({ pnl: 50, commission: 7, swap: 1 }),
      trade({ pnl: 50, commission: 7, swap: 4 }),
    ]);
    expect(s.totalCommission).toBe(14);
    expect(s.totalSwap).toBe(5);
    expect(s.totalCost).toBe(19);
  });

  it('derives gross as net plus costs', () => {
    const s = summarizeCosts([
      trade({ pnl: 100, commission: 7 }),
      trade({ pnl: -40, commission: 7 }),
    ]);
    expect(s.netPnl).toBe(60);
    expect(s.grossPnl).toBe(74);
  });

  it('detects an edge entirely consumed by costs', () => {
    // The headline finding: 20 scalps, each +6 gross, each costing 7.
    const scalps = Array.from({ length: 20 }, () => trade({ pnl: -1, commission: 7 }));
    const s = summarizeCosts(scalps);
    expect(s.grossPnl).toBe(120);
    expect(s.netPnl).toBe(-20);
    expect(s.profitableBeforeCostsOnly).toBe(true);
  });

  it('does not raise the flag when the account is genuinely profitable', () => {
    const s = summarizeCosts([trade({ pnl: 500, commission: 7 })]);
    expect(s.profitableBeforeCostsOnly).toBe(false);
  });

  it('does not raise the flag when gross is also negative', () => {
    // Costs are not the problem here; the strategy is.
    const s = summarizeCosts([trade({ pnl: -500, commission: 7 })]);
    expect(s.profitableBeforeCostsOnly).toBe(false);
  });

  it('reports the share of gross profit eaten by costs', () => {
    const s = summarizeCosts([trade({ pnl: 90, commission: 10 })]);
    expect(s.grossPnl).toBe(100);
    expect(s.costRatioPct).toBe(10);
  });

  it('returns a null ratio rather than a nonsense percentage on a losing book', () => {
    const s = summarizeCosts([trade({ pnl: -100, commission: 10 })]);
    expect(s.costRatioPct).toBeNull();
  });

  it('contrasts net and gross expectancy', () => {
    const s = summarizeCosts([
      trade({ pnl: 10, commission: 5 }),
      trade({ pnl: 30, commission: 5 }),
    ]);
    expect(s.netExpectancy).toBe(20);
    expect(s.grossExpectancy).toBe(25);
  });

  it('counts how many trades actually carry cost data', () => {
    // Imported history rarely has costs; typed-in trades might.
    const s = summarizeCosts([
      trade({ pnl: 10, commission: 0, swap: 0 }),
      trade({ pnl: 10, commission: 7, swap: 0 }),
    ]);
    expect(s.trades).toBe(2);
    expect(s.tradesWithCost).toBe(1);
  });

  it('survives rows missing the columns entirely', () => {
    const legacy = trade({ pnl: 100 });
    delete (legacy as Partial<Trade>).commission;
    delete (legacy as Partial<Trade>).swap;
    const s = summarizeCosts([legacy]);
    expect(s.totalCost).toBe(0);
    expect(s.netPnl).toBe(100);
    expect(s.grossPnl).toBe(100);
  });
});
