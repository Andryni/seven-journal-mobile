import { buildPostMortem } from '../postmortem';
import type { Trade } from '../../../types/domain';

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2390,
    stop_loss: 2395,
    take_profit: 2420,
    size: 1,
    entry_time: new Date().toISOString(),
    exit_time: new Date().toISOString(),
    pnl: -200,
    r_multiple: -2,
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
    result: 'SL',
    session: 'New York',
    created_at: new Date().toISOString(),
    ...over,
  };
}

describe('buildPostMortem', () => {
  it('diagnoses a stop placed inside the noise (MAE beyond 1R)', () => {
    // Risk = 5 (2400-2395); MAE dipped to 2392 = 1.6R against.
    const pm = buildPostMortem(trade({ mae_price: 2392, mfe_price: 2402 }), 3);
    expect(pm.findings.map(f => f.key)).toContain('stoppedThroughNoise');
    expect(pm.mae).toBe(1.6);
    expect(pm.isLoss).toBe(true);
    expect(pm.n).toBe(3);
  });

  it('diagnoses a give-back (was up, ended down)', () => {
    // MFE reached 2408 (+1.6R) then closed at 2390.
    const pm = buildPostMortem(trade({ mae_price: 2399, mfe_price: 2408 }));
    expect(pm.findings.map(f => f.key)).toContain('giveBack');
    expect(pm.mfe).toBe(1.6);
  });

  it('flags costs that ate a meaningful share of the loss', () => {
    const pm = buildPostMortem(trade({ commission: 20, swap: 10 }));
    const costs = pm.findings.find(f => f.key === 'costsAteIt');
    expect(costs).toBeDefined();
    expect(costs?.value).toBeGreaterThanOrEqual(15);
  });

  it('says when the journal cannot see the path', () => {
    const pm = buildPostMortem(trade({}));
    expect(pm.findings.map(f => f.key)).toContain('noExcursions');
    expect(pm.mae).toBeNull();
    expect(pm.mfe).toBeNull();
  });

  it('reports a missing stop rather than skipping it', () => {
    const pm = buildPostMortem(trade({ stop_loss: 0 }));
    expect(pm.findings.map(f => f.key)).toContain('noStop');
  });
});
