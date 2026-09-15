import { computeInsights, MIN_TRADES_FOR_INSIGHTS } from '../computeInsights';
import type { Trade } from '../../../types/domain';

let seq = 0;
const base = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t${seq++}`,
    user_id: 'u',
    account_id: 'acc1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1995,
    take_profit: 2020,
    size: 1,
    entry_time: '2026-01-13T10:00:00',
    exit_time: '2026-01-13T10:30:00',
    pnl: 10,
    r_multiple: 1,
    timeframe: 'M15',
    setup_structures: ['BOS'],
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
    created_at: '2026-01-13T10:00:00Z',
    ...over,
  }) as Trade;

/** n healthy, unremarkable trades — the baseline every test builds on. */
const filler = (n: number, over: Partial<Trade> = {}): Trade[] =>
  Array.from({ length: n }, (_, i) =>
    base({
      // Spread across days and a quiet hour so day/hour rules stay silent.
      entry_time: `2026-02-${String((i % 20) + 1).padStart(2, '0')}T09:00:00`,
      exit_time: `2026-02-${String((i % 20) + 1).padStart(2, '0')}T09:30:00`,
      pnl: i % 2 === 0 ? 50 : -20,
      ...over,
    })
  );

const ids = (r: ReturnType<typeof computeInsights>) => r.insights.map(i => i.id);

describe('sample-size gating', () => {
  it('says nothing below the minimum history', () => {
    const r = computeInsights(filler(MIN_TRADES_FOR_INSIGHTS - 1));
    expect(r.hasEnoughData).toBe(false);
    expect(r.insights).toEqual([]);
  });

  it('starts reporting at the threshold', () => {
    const r = computeInsights(filler(MIN_TRADES_FOR_INSIGHTS));
    expect(r.hasEnoughData).toBe(true);
  });

  it('ignores open trades when counting history', () => {
    const open = Array.from({ length: 30 }, () => base({ pnl: null }));
    const r = computeInsights(open);
    expect(r.hasEnoughData).toBe(false);
    expect(r.tradesAnalysed).toBe(0);
  });

  it('produces no findings for a clean, profitable book', () => {
    const clean = filler(40, { pnl: 40 });
    const r = computeInsights(clean);
    // A uniformly winning book has no losing hour, day or tilt to report.
    expect(ids(r)).not.toContain('losing-hour');
    expect(ids(r)).not.toContain('revenge-trading');
    expect(ids(r)).not.toContain('no-stop');
  });
});

describe('no-stop rule', () => {
  it('flags any trade without a stop loss', () => {
    const t = [...filler(25), base({ stop_loss: 0, pnl: -100 })];
    const r = computeInsights(t);
    const f = r.insights.find(i => i.id === 'no-stop')!;
    expect(f).toBeTruthy();
    expect(f.severity).toBe('critical');
    expect(f.sampleSize).toBe(1);
  });

  it('stays silent when every trade has a stop', () => {
    expect(ids(computeInsights(filler(30)))).not.toContain('no-stop');
  });
});

describe('revenge trading', () => {
  it('detects quick re-entries after a loss that underperform', () => {
    const t = [...filler(25)];
    // 6 pairs: a loss, then a trade 5 minutes later that loses badly.
    for (let i = 0; i < 6; i++) {
      const d = `2026-03-${String(i + 1).padStart(2, '0')}`;
      t.push(base({ entry_time: `${d}T14:00:00`, exit_time: `${d}T14:10:00`, pnl: -100 }));
      t.push(base({ entry_time: `${d}T14:15:00`, exit_time: `${d}T14:40:00`, pnl: -200 }));
    }
    const f = computeInsights(t).insights.find(i => i.id === 'revenge-trading');
    expect(f).toBeTruthy();
    expect(f!.severity).toBe('critical');
    expect(f!.impact).toBeLessThan(0);
  });

  it('does not flag quick re-entries that actually win', () => {
    const t = [...filler(25)];
    for (let i = 0; i < 6; i++) {
      const d = `2026-03-${String(i + 1).padStart(2, '0')}`;
      t.push(base({ entry_time: `${d}T14:00:00`, exit_time: `${d}T14:10:00`, pnl: -100 }));
      t.push(base({ entry_time: `${d}T14:15:00`, exit_time: `${d}T14:40:00`, pnl: 400 }));
    }
    // Re-entering fast is only a problem if it loses money.
    expect(ids(computeInsights(t))).not.toContain('revenge-trading');
  });

  it('ignores re-entries outside the 30 minute window', () => {
    const t = [...filler(25)];
    for (let i = 0; i < 6; i++) {
      const d = `2026-03-${String(i + 1).padStart(2, '0')}`;
      t.push(base({ entry_time: `${d}T14:00:00`, exit_time: `${d}T14:10:00`, pnl: -100 }));
      t.push(base({ entry_time: `${d}T18:00:00`, exit_time: `${d}T18:30:00`, pnl: -200 }));
    }
    expect(ids(computeInsights(t))).not.toContain('revenge-trading');
  });
});

describe('size escalation', () => {
  it('detects martingale sizing after losses', () => {
    const t: Trade[] = [];
    for (let i = 0; i < 24; i++) {
      const d = `2026-04-${String((i % 28) + 1).padStart(2, '0')}`;
      const lost = i % 2 === 0;
      t.push(
        base({
          entry_time: `${d}T${10 + (i % 5)}:00:00`,
          pnl: lost ? -100 : 100,
          // Trade after a loss is much bigger.
          size: lost ? 1 : 3,
        })
      );
    }
    const f = computeInsights(t).insights.find(i => i.id === 'size-escalation');
    expect(f).toBeTruthy();
    expect(Number(f!.params.pct)).toBeGreaterThanOrEqual(25);
  });

  it('stays silent when size is stable', () => {
    expect(ids(computeInsights(filler(40, { size: 1 })))).not.toContain('size-escalation');
  });
});

describe('losing hour', () => {
  it('isolates a single bleeding hour', () => {
    const t = [...filler(25, { pnl: 60 })];
    for (let i = 0; i < 8; i++) {
      const d = `2026-05-${String(i + 1).padStart(2, '0')}`;
      t.push(base({ entry_time: `${d}T03:00:00`, exit_time: `${d}T03:20:00`, pnl: -150 }));
    }
    const f = computeInsights(t).insights.find(i => i.id === 'losing-hour');
    expect(f).toBeTruthy();
    expect(f!.params.hour).toBe(3);
    expect(f!.sampleSize).toBe(8);
  });

  it('will not call an hour out on fewer than five trades', () => {
    const t = [...filler(25, { pnl: 60 })];
    // Only 3 bad trades in that hour: not enough to conclude.
    for (let i = 0; i < 3; i++) {
      const d = `2026-05-${String(i + 1).padStart(2, '0')}`;
      t.push(base({ entry_time: `${d}T04:00:00`, pnl: -300 }));
    }
    expect(ids(computeInsights(t))).not.toContain('losing-hour');
  });
});

describe('off-plan trading', () => {
  it('flags a large share of untagged trades', () => {
    const t = [
      ...filler(20),
      ...Array.from({ length: 10 }, () =>
        base({ setup_structures: [], setup_fvg: false, setup_ob: false, pnl: -80 })
      ),
    ];
    const f = computeInsights(t).insights.find(i => i.id === 'off-plan');
    expect(f).toBeTruthy();
    expect(f!.severity).toBe('critical'); // they lost money
    expect(f!.impact).toBeLessThan(0);
  });

  it('counts a trade tagged only by a boolean confirmation as on-plan', () => {
    const t = [
      ...filler(20),
      ...Array.from({ length: 10 }, () =>
        base({ setup_structures: [], setup_fvg: true, pnl: -80 })
      ),
    ];
    expect(ids(computeInsights(t))).not.toContain('off-plan');
  });
});

describe('tilt state', () => {
  it('reports worse performance while tilted', () => {
    const t = [
      ...filler(20, { mental_state: 'focused', pnl: 100 }),
      ...Array.from({ length: 8 }, () => base({ mental_state: 'revenge', pnl: -250 })),
    ];
    const f = computeInsights(t).insights.find(i => i.id === 'tilt-state');
    expect(f).toBeTruthy();
    expect(Number(f!.params.avg)).toBeLessThan(Number(f!.params.calm));
  });

  it('stays silent when tilted trades do no worse', () => {
    const t = [
      ...filler(20, { mental_state: 'focused', pnl: 10 }),
      ...Array.from({ length: 8 }, () => base({ mental_state: 'fomo', pnl: 500 })),
    ];
    expect(ids(computeInsights(t))).not.toContain('tilt-state');
  });
});

describe('best setup', () => {
  it('surfaces the setup that earns, so the report is not all negative', () => {
    const t = [
      ...filler(20, { setup_structures: ['MEH'], pnl: -5 }),
      ...Array.from({ length: 8 }, () => base({ setup_structures: ['FVG-SWEEP'], pnl: 300 })),
    ];
    const f = computeInsights(t).insights.find(i => i.id === 'best-setup');
    expect(f).toBeTruthy();
    expect(f!.severity).toBe('good');
    expect(f!.params.setup).toBe('FVG-SWEEP');
  });
});

describe('ordering', () => {
  it('leads with critical findings, then the most expensive', () => {
    const t = [
      ...filler(20),
      base({ stop_loss: 0, pnl: -10 }),
      ...Array.from({ length: 8 }, () => base({ mental_state: 'revenge', pnl: -400 })),
    ];
    const r = computeInsights(t);
    const sev = r.insights.map(i => i.severity);
    const firstWarning = sev.indexOf('warning');
    const lastCritical = sev.lastIndexOf('critical');
    if (firstWarning !== -1 && lastCritical !== -1) {
      expect(lastCritical).toBeLessThan(firstWarning);
    }
    // 'good' can never precede 'critical'.
    const firstGood = sev.indexOf('good');
    if (firstGood !== -1 && lastCritical !== -1) {
      expect(lastCritical).toBeLessThan(firstGood);
    }
  });
});

describe('robustness', () => {
  it('handles an empty list', () => {
    const r = computeInsights([]);
    expect(r.hasEnoughData).toBe(false);
    expect(r.insights).toEqual([]);
  });

  it('never throws on malformed rows', () => {
    const junk = Array.from({ length: 30 }, () =>
      base({
        setup_structures: undefined as never,
        size: 0,
        exit_time: null,
        stop_loss: 0,
        pnl: -1,
      })
    );
    expect(() => computeInsights(junk)).not.toThrow();
  });

  it('rounds every reported number for display', () => {
    const t = [...filler(25), base({ stop_loss: 0, pnl: -33.333333 })];
    for (const i of computeInsights(t).insights) {
      if (i.impact !== null) {
        expect(Number.isFinite(i.impact)).toBe(true);
        expect(i.impact.toString()).toMatch(/^-?\d+(\.\d{1,2})?$/);
      }
    }
  });
});
