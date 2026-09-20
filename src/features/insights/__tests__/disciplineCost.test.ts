import type { Trade } from '../../../types/domain';
import { MIN_TRADES_FOR_COST, disciplineCost } from '../disciplineCost';

/**
 * The one number in this app that exists purely to change behaviour, so the
 * two ways it can lie are both tested here:
 *
 *   * double counting — one trade appearing in two buckets, which inflates the
 *     total and turns a defensible figure into one the trader can disprove;
 *   * a negative cost — a "bad" bucket that beats the trader's own baseline,
 *     reported as a saving, which is the tool agreeing with a habit it should
 *     be questioning.
 */
let clock = Date.UTC(2026, 8, 1, 10, 0, 0);

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2405,
    stop_loss: 2395,
    take_profit: 2415,
    size: 1,
    entry_time: new Date(clock).toISOString(),
    exit_time: new Date(clock + 20 * 60 * 1000).toISOString(),
    pnl: 50,
    r_multiple: 1,
    timeframe: 'M15',
    setup_structures: ['FVG'],
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
    created_at: new Date(clock).toISOString(),
    ...over,
  }) as Trade;

/** n clean, well-spaced winning trades: the baseline. */
function baseline(n: number): Trade[] {
  const out: Trade[] = [];
  for (let i = 0; i < n; i++) {
    clock += 4 * 60 * 60 * 1000;
    out.push(trade());
  }
  return out;
}

beforeEach(() => {
  clock = Date.UTC(2026, 8, 1, 10, 0, 0);
});

describe('disciplineCost — refuses to speak too early', () => {
  it('says nothing below the minimum sample', () => {
    expect(disciplineCost(baseline(MIN_TRADES_FOR_COST - 1))).toBeNull();
  });

  it('says nothing when the baseline itself is too thin', () => {
    // 20 trades, all in a tilt state: there is no clean behaviour to compare
    // against, so any "cost" would be invented.
    const tilted = baseline(20).map(t => ({ ...t, mental_state: 'revenge' as const }));
    expect(disciplineCost(tilted)).toBeNull();
  });

  it('ignores trades that are still open', () => {
    const open = baseline(20).map(t => ({ ...t, pnl: null, exit_time: null }));
    expect(disciplineCost(open)).toBeNull();
  });
});

describe('disciplineCost — attribution', () => {
  it('costs a tilt bucket against the trader own baseline', () => {
    const trades = baseline(20);
    // Ten tilt losses of -100 against a +50 baseline: 150 per trade.
    const tilted = Array.from({ length: 10 }, () => {
      clock += 4 * 60 * 60 * 1000;
      return trade({ mental_state: 'fomo', pnl: -100 });
    });

    const cost = disciplineCost([...trades, ...tilted]);
    expect(cost).not.toBeNull();
    const tilt = cost!.byBehaviour.find(b => b.id === 'tilt');
    expect(tilt?.count).toBe(10);
    expect(tilt?.cost).toBeCloseTo(1500, 2);
    expect(cost!.cleanAvg).toBeCloseTo(50, 4);
  });

  it('assigns each trade to exactly ONE bucket', () => {
    // A revenge entry taken in a tilt state is one trade. Counting it in both
    // buckets would inflate the total by its whole loss.
    const trades = baseline(20);
    clock += 60 * 1000; // one minute after the last losing... no: after a WIN.
    const tiltAndRevenge = trade({ mental_state: 'revenge', pnl: -200 });

    const cost = disciplineCost([...trades, tiltAndRevenge]);
    expect(cost).not.toBeNull();

    const counts = cost!.byBehaviour.reduce((sum, b) => sum + b.count, 0);
    expect(counts).toBe(1);
    expect(cost!.byBehaviour[0].id).toBe('tilt');
  });

  it('never reports a negative cost', () => {
    // A tilt bucket that BEATS the baseline is not a saving. Reporting it as
    // one would be the tool endorsing the habit it exists to question.
    const trades = baseline(20);
    const lucky = Array.from({ length: 6 }, () => {
      clock += 4 * 60 * 60 * 1000;
      return trade({ mental_state: 'greedy', pnl: 400 });
    });

    const cost = disciplineCost([...trades, ...lucky]);
    expect(cost).not.toBeNull();
    const tilt = cost!.byBehaviour.find(b => b.id === 'tilt');
    expect(tilt?.count).toBe(6);
    expect(tilt?.cost).toBe(0);
    expect(cost!.total).toBe(0);
  });

  it('separates an unplanned trade from a quick re-entry', () => {
    const trades = baseline(20);
    // The baseline fixture exits 20 minutes after it enters, so the gap has
    // to be measured from that exit for the re-entry to be a re-entry.
    clock += 30 * 60 * 1000;
    const unplanned = trade({ setup_structures: [], pnl: -80 });
    clock += 30 * 60 * 1000;
    // Ten minutes after the unplanned loss, and with a setup recorded: the
    // only reason it is not clean is how quickly it followed that loss.
    const quick = trade({ pnl: -60 });

    const cost = disciplineCost([...trades, unplanned, quick]);
    expect(cost).not.toBeNull();
    expect(cost!.byBehaviour.map(b => b.id).sort()).toEqual(['off-plan', 'revenge']);
  });

  it('reports the share of the period gross P&L', () => {
    const trades = baseline(20);
    // Six losses, not ten: at ten the period's gross P&L would be exactly
    // zero, which is the one case where a share is mathematically meaningless
    // (and correctly reported as null).
    const tilted = Array.from({ length: 6 }, () => {
      clock += 4 * 60 * 60 * 1000;
      return trade({ mental_state: 'revenge', pnl: -100 });
    });

    const cost = disciplineCost([...trades, ...tilted])!;
    expect(cost.gross).toBeCloseTo(20 * 50 - 6 * 100, 2);
    expect(cost.shareOfGross).not.toBeNull();
    expect(cost.shareOfGross!).toBeGreaterThan(0);
  });
});
