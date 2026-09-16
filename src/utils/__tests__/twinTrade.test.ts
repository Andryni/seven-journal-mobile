import {
  twinScore,
  maxTwinScore,
  findTwinTrades,
  aggregateTwins,
  isTwinSignificant,
  MIN_TWIN_SAMPLE,
} from '../twinTrade';
import type { Trade } from '../../types/domain';

const base: Trade = {
  id: 't1',
  user_id: 'u',
  account_id: 'a',
  pair: 'XAUUSD',
  direction: 'BUY',
  entry_price: 2400,
  exit_price: 2410,
  stop_loss: 2395,
  take_profit: 2420,
  size: 0.5,
  entry_time: '2026-09-01T10:00:00Z',
  exit_time: '2026-09-01T12:00:00Z',
  pnl: 200,
  r_multiple: 2,
  timeframe: 'M15',
  setup_structures: ['FVG'],
  setup_fvg: true,
  setup_ob: false,
  setup_liquidity_sweep: false,
  bookmap_absorption: null,
  bookmap_passive_orders: null,
  bookmap_aggressive_orders: null,
  bookmap_vwap_position: null,
  mental_state: 'revenge',
  cookie_jar_ref: false,
  rule_40_percent: false,
  screenshot_before_url: null,
  screenshot_after_url: null,
  notes: null,
  result: 'TP',
  session: 'London',
  created_at: '2026-09-01T10:00:00Z',
};

const twin = (over: Partial<Trade>, id: string): Trade => ({
  ...base,
  id,
  entry_time: `2026-09-0${(Number(id.slice(1)) % 9) + 1}T10:00:00Z`,
  ...over,
});

describe('twinScore', () => {
  it('scores a perfect match across every dimension', () => {
    const score = twinScore(base, {
      pair: 'XAUUSD',
      direction: 'BUY',
      session: 'London',
      timeframe: 'M15',
      mentalState: 'revenge',
      tags: ['news'],
      setupStructures: ['FVG'],
    });
    // 4 dimensions + 1 (FVG) — the trade carries no tags.
    expect(score).toBe(5);
  });

  it('never scores a different pair, however similar the rest', () => {
    const other = twin({ pair: 'EURUSD' }, 't9');
    expect(twinScore(other, { pair: 'XAUUSD', direction: 'BUY' })).toBe(0);
  });

  it('caps tag and structure contributions', () => {
    const loaded = twin(
      {
        tags: ['a', 'b', 'c', 'd'],
        setup_structures: ['FVG', 'OB', 'SWEEP'],
      },
      't2'
    );
    const score = twinScore(loaded, {
      pair: 'XAUUSD',
      tags: ['a', 'b', 'c', 'd'],
      setupStructures: ['FVG', 'OB', 'SWEEP'],
    });
    expect(score).toBe(4); // 2 + 2, not 7
  });
});

describe('findTwinTrades', () => {
  const criteria = {
    pair: 'XAUUSD',
    direction: 'BUY' as const,
    session: 'London',
    mentalState: 'revenge',
  };

  it('returns only closed twins at or above the threshold, best first', () => {
    const history = [
      twin({ direction: 'BUY', session: 'London', mental_state: 'revenge', pnl: 100 }, 't2'),
      twin({ direction: 'SELL', session: 'Asia', mental_state: 'focused', pnl: -50 }, 't3'),
      twin({ direction: 'BUY', session: 'London', mental_state: 'revenge', pnl: null }, 't4'),
      twin({ pair: 'EURUSD', pnl: 500 }, 't5'),
    ];
    const twins = findTwinTrades(history, criteria);
    expect(twins.map(t => t.id)).toEqual(['t2']);
  });

  it('is empty without a pair', () => {
    expect(findTwinTrades([base], { pair: '' })).toEqual([]);
  });
});

/**
 * The bar scales with what was asked for.
 *
 * It used to be a constant 3, derived from a `DIMENSIONS = 5` that did not
 * match the real ceiling of 8. That broke the rule at both ends, and both
 * ends are covered below.
 */
describe('maxTwinScore', () => {
  it('counts only the dimensions the criteria actually specify', () => {
    expect(maxTwinScore({ pair: 'XAUUSD' })).toBe(0);
    expect(maxTwinScore({ pair: 'XAUUSD', direction: 'BUY' })).toBe(1);
    expect(
      maxTwinScore({ pair: 'XAUUSD', direction: 'BUY', session: 'London', timeframe: 'M15' })
    ).toBe(3);
  });

  it('caps tags and structures at two each, matching twinScore', () => {
    const criteria = {
      pair: 'XAUUSD',
      direction: 'BUY' as const,
      session: 'London',
      timeframe: 'M15',
      mentalState: 'revenge',
      tags: ['a', 'b', 'c', 'd'],
      setupStructures: ['FVG', 'OB', 'BOS'],
    };
    // 4 single dimensions + 2 tags + 2 structures.
    expect(maxTwinScore(criteria)).toBe(8);
    // The ceiling must be reachable: a trade matching everything scores it.
    const perfect = twin(
      { tags: ['a', 'b', 'c', 'd'], setup_structures: ['FVG', 'OB', 'BOS'] },
      't20'
    );
    expect(twinScore(perfect, criteria)).toBe(maxTwinScore(criteria));
  });
});

describe('findTwinTrades — threshold scales with the criteria', () => {
  it('finds twins when the form carries only a pair and a direction', () => {
    // Previously impossible: the ceiling here is 1 and the fixed bar was 3,
    // so the panel stayed empty however much history existed.
    const history = [twin({ direction: 'BUY', pnl: 100 }, 't2')];
    const found = findTwinTrades(history, { pair: 'XAUUSD', direction: 'BUY' });
    expect(found.map(t => t.id)).toEqual(['t2']);
  });

  it('rejects a trade that shares only tags when the context differs', () => {
    // Was accepted at 3/8: two tags plus one structure cleared the old bar
    // despite the opposite direction and another session.
    const criteria = {
      pair: 'XAUUSD',
      direction: 'BUY' as const,
      session: 'London',
      timeframe: 'M15',
      mentalState: 'revenge',
      tags: ['news', 'gap'],
      setupStructures: ['FVG'],
    };
    const opposite = twin(
      {
        direction: 'SELL',
        session: 'NewYork',
        timeframe: 'H1',
        mental_state: 'focused',
        tags: ['news', 'gap'],
        setup_structures: ['FVG'],
      },
      't3'
    );
    expect(twinScore(opposite, criteria)).toBe(3);
    expect(findTwinTrades([opposite], criteria)).toEqual([]);
  });

  it('still accepts a trade matching half of a fully specified context', () => {
    const criteria = {
      pair: 'XAUUSD',
      direction: 'BUY' as const,
      session: 'London',
      timeframe: 'M15',
      mentalState: 'revenge',
      tags: ['news', 'gap'],
      setupStructures: ['FVG'],
    };
    const half = twin(
      {
        direction: 'BUY',
        session: 'London',
        timeframe: 'M15',
        mental_state: 'focused',
        tags: ['news'],
        setup_structures: [],
      },
      't4'
    );
    expect(findTwinTrades([half], criteria).map(t => t.id)).toEqual(['t4']);
  });

  it('says nothing when the pair is the only criterion', () => {
    // Every past trade on the instrument would score 0 and qualify: that is
    // a "trades on XAUUSD" list, not a twin.
    const history = [twin({ pnl: 50 }, 't5'), twin({ pnl: -20 }, 't6')];
    expect(findTwinTrades(history, { pair: 'XAUUSD' })).toEqual([]);
  });
});

describe('aggregateTwins', () => {
  it('sums P&L and R over the closed sample', () => {
    const agg = aggregateTwins([
      twin({ pnl: 150, r_multiple: 1.5 }, 't2'),
      twin({ pnl: -100, r_multiple: -1 }, 't3'),
      twin({ pnl: -100, r_multiple: null }, 't4'),
    ]);
    expect(agg.closed).toBe(3);
    expect(agg.wins).toBe(1);
    expect(agg.totalPnl).toBe(-50);
    expect(agg.totalR).toBe(0.5);
    expect(agg.avgR).toBe(0.25);
    expect(agg.winRate).toBe(33);
  });

  it('stays silent below the significance sample', () => {
    const agg = aggregateTwins([twin({ pnl: 10 }, 't2'), twin({ pnl: 20 }, 't3')]);
    expect(isTwinSignificant(agg)).toBe(false);
    expect(isTwinSignificant(aggregateTwins(Array.from({ length: MIN_TWIN_SAMPLE }, (_, i) => twin({ pnl: 10 * i }, `t${i + 2}`))))).toBe(true);
  });
});
