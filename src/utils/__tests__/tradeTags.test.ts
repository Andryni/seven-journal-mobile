import {
  normalizeTag,
  normalizeTags,
  parseTagInput,
  tagsOf,
  collectTags,
  filterTrades,
  isFilterActive,
  tagPerformance,
  MAX_TAG_LENGTH,
} from '../tradeTags';
import type { Trade } from '../../types/domain';

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 100,
    exit_price: 110,
    stop_loss: 90,
    take_profit: 130,
    size: 1,
    entry_time: '2025-01-01T10:00:00Z',
    exit_time: '2025-01-01T12:00:00Z',
    pnl: 10,
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
    tags: [],
    created_at: '2025-01-01T10:00:00Z',
    ...over,
  } as Trade;
}

describe('normalizeTag', () => {
  it('lowercases and trims', () => {
    expect(normalizeTag('  FVG  ')).toBe('fvg');
  });

  it('drops a leading hash so #news and news are one tag', () => {
    expect(normalizeTag('#news')).toBe('news');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeTag('news   release')).toBe('news release');
  });

  it('returns empty for a tag with no content', () => {
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag('#')).toBe('');
  });

  it('truncates absurdly long tags', () => {
    expect(normalizeTag('x'.repeat(100))).toHaveLength(MAX_TAG_LENGTH);
  });

  it('survives non-string input', () => {
    expect(normalizeTag(null as unknown as string)).toBe('');
  });
});

describe('normalizeTags', () => {
  it('removes duplicates that differ only in case', () => {
    expect(normalizeTags(['FVG', 'fvg', ' Fvg '])).toEqual(['fvg']);
  });

  it('preserves the order of first appearance', () => {
    expect(normalizeTags(['b', 'a', 'b'])).toEqual(['b', 'a']);
  });

  it('discards empties', () => {
    expect(normalizeTags(['', '  ', 'ok'])).toEqual(['ok']);
  });

  it('returns an empty array for a non-array', () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags('fvg')).toEqual([]);
  });
});

describe('parseTagInput', () => {
  it('splits on commas', () => {
    expect(parseTagInput('fvg, london, tired')).toEqual(['fvg', 'london', 'tired']);
  });

  it('does not split on spaces, so multi-word tags survive', () => {
    // Splitting here would turn one meaningful tag into two useless ones.
    expect(parseTagInput('news release')).toEqual(['news release']);
  });

  it('splits on newlines', () => {
    expect(parseTagInput('a\nb')).toEqual(['a', 'b']);
  });

  it('is empty for empty input', () => {
    expect(parseTagInput('')).toEqual([]);
  });
});

describe('tagsOf', () => {
  it('reads and normalises a trade tags', () => {
    expect(tagsOf(trade({ tags: ['FVG', '#news'] }))).toEqual(['fvg', 'news']);
  });

  it('is empty when the column is missing entirely', () => {
    // An unmigrated database returns rows without the key.
    const bare = trade();
    delete (bare as Record<string, unknown>).tags;
    expect(tagsOf(bare)).toEqual([]);
  });
});

describe('collectTags', () => {
  it('counts occurrences and sorts by frequency', () => {
    const list = [
      trade({ tags: ['fvg', 'london'] }),
      trade({ tags: ['fvg'] }),
      trade({ tags: ['tired'] }),
    ];
    expect(collectTags(list)).toEqual([
      { tag: 'fvg', count: 2 },
      { tag: 'london', count: 1 },
      { tag: 'tired', count: 1 },
    ]);
  });

  it('breaks ties alphabetically so the list is stable', () => {
    const list = [trade({ tags: ['zulu'] }), trade({ tags: ['alpha'] })];
    expect(collectTags(list).map(c => c.tag)).toEqual(['alpha', 'zulu']);
  });

  it('merges tags differing only in case', () => {
    const list = [trade({ tags: ['FVG'] }), trade({ tags: ['fvg'] })];
    expect(collectTags(list)).toEqual([{ tag: 'fvg', count: 2 }]);
  });
});

describe('filterTrades', () => {
  const london = trade({ tags: ['fvg'], session: 'London', pnl: 10, r_multiple: 2 });
  const asia = trade({
    tags: ['tired'],
    session: 'Asia',
    pnl: -5,
    r_multiple: -1,
    direction: 'SELL',
    mental_state: 'tired',
  });
  const open = trade({ tags: [], pnl: null, exit_price: null, r_multiple: null });
  const all = [london, asia, open];

  it('returns everything for an empty filter', () => {
    // The default state must not show an empty journal.
    expect(filterTrades(all, {})).toHaveLength(3);
  });

  it('matches text against the pair', () => {
    expect(filterTrades(all, { query: 'xau' })).toHaveLength(3);
    expect(filterTrades(all, { query: 'eur' })).toHaveLength(0);
  });

  it('matches text against tags, not just notes', () => {
    expect(filterTrades(all, { query: 'tired' })).toEqual([asia]);
  });

  it('filters by a single tag', () => {
    expect(filterTrades(all, { tags: ['fvg'] })).toEqual([london]);
  });

  it("is case-insensitive on the requested tag", () => {
    expect(filterTrades(all, { tags: ['FVG'] })).toEqual([london]);
  });

  it('combines tags with OR in any mode', () => {
    expect(filterTrades(all, { tags: ['fvg', 'tired'], tagMode: 'any' })).toHaveLength(2);
  });

  it('combines tags with AND in all mode', () => {
    const both = trade({ tags: ['fvg', 'tired'] });
    const list = [london, asia, both];
    expect(filterTrades(list, { tags: ['fvg', 'tired'], tagMode: 'all' })).toEqual([both]);
  });

  it('narrows across dimensions with AND', () => {
    // London AND tagged fvg: the whole point of cross-filtering.
    expect(filterTrades(all, { tags: ['fvg'], sessions: ['London'] })).toEqual([london]);
    expect(filterTrades(all, { tags: ['fvg'], sessions: ['Asia'] })).toHaveLength(0);
  });

  it('filters by mental state', () => {
    expect(filterTrades(all, { mentalStates: ['tired'] })).toEqual([asia]);
  });

  it('filters by direction', () => {
    expect(filterTrades(all, { directions: ['SELL'] })).toEqual([asia]);
  });

  it('filters by outcome', () => {
    expect(filterTrades(all, { outcome: 'win' })).toEqual([london]);
    expect(filterTrades(all, { outcome: 'loss' })).toEqual([asia]);
    expect(filterTrades(all, { outcome: 'open' })).toEqual([open]);
  });

  it('filters by an R range', () => {
    expect(filterTrades(all, { minR: 1 })).toEqual([london]);
    expect(filterTrades(all, { maxR: 0 })).toEqual([asia]);
  });

  it('excludes trades with no R rather than treating them as 0', () => {
    // A null R sits inside most ranges if coerced, silently padding results.
    expect(filterTrades(all, { minR: -10, maxR: 10 })).not.toContain(open);
  });

  it('includes a trade exactly on the R bound', () => {
    expect(filterTrades(all, { minR: 2, maxR: 2 })).toEqual([london]);
  });

  it('tolerates a null trade list', () => {
    expect(filterTrades(null as unknown as Trade[], { query: 'x' })).toEqual([]);
  });
});

describe('isFilterActive', () => {
  it('is false for an empty filter', () => {
    expect(isFilterActive({})).toBe(false);
    expect(isFilterActive({ query: '  ', tags: [], outcome: 'all' })).toBe(false);
  });

  it('is true as soon as one dimension constrains', () => {
    expect(isFilterActive({ tags: ['fvg'] })).toBe(true);
    expect(isFilterActive({ outcome: 'win' })).toBe(true);
    expect(isFilterActive({ minR: 1 })).toBe(true);
  });
});

describe('tagPerformance', () => {
  it('ignores tags below the minimum sample', () => {
    // Two trades is noise; presenting it as an insight is the failure mode.
    const list = [trade({ tags: ['rare'] }), trade({ tags: ['rare'] })];
    expect(tagPerformance(list, 3)).toEqual([]);
  });

  it('computes win rate and expectancy per tag', () => {
    const list = [
      trade({ tags: ['fvg'], pnl: 100 }),
      trade({ tags: ['fvg'], pnl: 100 }),
      trade({ tags: ['fvg'], pnl: -100 }),
    ];
    const [fvg] = tagPerformance(list, 3);
    expect(fvg.trades).toBe(3);
    expect(fvg.wins).toBe(2);
    expect(fvg.winRate).toBe(66.7);
    expect(fvg.totalPnl).toBe(100);
    expect(fvg.expectancy).toBe(33.33);
  });

  it('excludes open trades from the sample', () => {
    const list = [
      trade({ tags: ['fvg'], pnl: 10 }),
      trade({ tags: ['fvg'], pnl: 10 }),
      trade({ tags: ['fvg'], pnl: 10 }),
      trade({ tags: ['fvg'], pnl: null }),
    ];
    expect(tagPerformance(list, 3)[0].trades).toBe(3);
  });

  it('sorts worst expectancy first, because the point is what to stop doing', () => {
    const good = Array.from({ length: 3 }, () => trade({ tags: ['good'], pnl: 100 }));
    const bad = Array.from({ length: 3 }, () => trade({ tags: ['bad'], pnl: -100 }));
    expect(tagPerformance([...good, ...bad], 3).map(r => r.tag)).toEqual(['bad', 'good']);
  });

  it('reports a null average R when no trade carries one', () => {
    const list = Array.from({ length: 3 }, () =>
      trade({ tags: ['fvg'], pnl: 10, r_multiple: null })
    );
    expect(tagPerformance(list, 3)[0].avgR).toBeNull();
  });

  it('counts a trade under each of its tags', () => {
    const list = Array.from({ length: 3 }, () => trade({ tags: ['a', 'b'], pnl: 10 }));
    const res = tagPerformance(list, 3);
    expect(res).toHaveLength(2);
    expect(res.every(r => r.trades === 3)).toBe(true);
  });
});
