import {
  buildChatContext,
  computeChatStats,
  toChatTrade,
  MAX_CHAT_TRADES,
} from '../buildChatContext';
import type { Trade, TradingAccount } from '../../../types/domain';

/**
 * These tests are mostly about what is NOT sent.
 *
 * The chat is the one place in the app that forwards real trades to a third
 * party, so the redaction rules deserve more scrutiny than the happy path.
 */

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400.55,
    exit_price: 2418.2,
    stop_loss: 2395,
    take_profit: 2430,
    size: 1.5,
    entry_time: '2026-03-12T09:30:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 120,
    r_multiple: 1.8,
    timeframe: 'M15',
    result: 'TP',
    session: 'London',
    mental_state: 'focused',
    notes: 'Called my broker about the slippage, spoke to Jean',
    screenshot_before_url: 'https://example.com/a.png',
    screenshot_after_url: null,
    commission: 3,
    swap: 0,
    tags: ['fvg'],
    created_at: '2026-03-12T09:30:00',
    ...over,
  } as unknown as Trade;
}

describe('what the model never receives', () => {
  const ctx = buildChatContext({ trades: [trade()] });
  const serialised = JSON.stringify(ctx);

  it('omits entry, exit, stop and target prices', () => {
    // Prices identify a broker account and add nothing to behavioural
    // reasoning -- the R multiple already carries the risk story.
    expect(serialised).not.toContain('2400.55');
    expect(serialised).not.toContain('2418.2');
    expect(serialised).not.toContain('2395');
    expect(serialised).not.toContain('2430');
  });

  it('omits free-text notes, which are a diary and often name people', () => {
    expect(serialised).not.toContain('Jean');
    expect(serialised).not.toContain('slippage');
  });

  it('omits screenshot URLs', () => {
    expect(serialised).not.toContain('example.com');
  });

  it('omits the position size', () => {
    const t = ctx.trades[0] as unknown as Record<string, unknown>;
    expect(t.size).toBeUndefined();
  });

  it('omits raw identifiers', () => {
    expect(serialised).not.toContain('"t1"');
    expect(serialised).not.toContain('account_id');
  });

  it('keeps what behaviour actually depends on', () => {
    const t = ctx.trades[0];
    expect(t.pair).toBe('XAUUSD');
    expect(t.dir).toBe('BUY');
    expect(t.r).toBe(1.8);
    expect(t.session).toBe('London');
    expect(t.mental).toBe('focused');
    expect(t.timeframe).toBe('M15');
  });
});

describe('toChatTrade', () => {
  it('derives hour, weekday and holding time', () => {
    const t = toChatTrade(trade(), 1);
    expect(t.hour).toBe(9);
    expect(t.weekday).toBe(4); // Thursday 12 March 2026
    expect(t.heldMinutes).toBe(90);
  });

  it('reports the outcome from money, not from the stated result', () => {
    // A BE exit that banked a partial gain is a win.
    expect(toChatTrade(trade({ pnl: 40, result: 'BE' }), 1).outcome).toBe('win');
    expect(toChatTrade(trade({ pnl: -40, result: 'TP' }), 1).outcome).toBe('loss');
    expect(toChatTrade(trade({ pnl: 0 }), 1).outcome).toBe('flat');
  });

  it('survives a missing or malformed timestamp', () => {
    const t = toChatTrade(trade({ entry_time: 'nonsense', exit_time: null as never }), 1);
    expect(t.heldMinutes).toBeNull();
    expect(() => JSON.stringify(t)).not.toThrow();
  });

  it('caps the tag list', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(toChatTrade(trade({ tags: many }), 1).tags.length).toBeLessThanOrEqual(6);
  });
});

describe('computeChatStats', () => {
  it('excludes breakeven trades from the win rate denominator', () => {
    const s = computeChatStats(
      [trade({ pnl: 10 }), trade({ pnl: 20 }), trade({ pnl: -5 }), trade({ pnl: 0 })],
      'USD'
    );
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.breakeven).toBe(1);
    expect(s.winRatePct).toBe(66.67);
  });

  it('reports no profit factor rather than Infinity before the first loss', () => {
    expect(computeChatStats([trade({ pnl: 50 })], 'USD').profitFactor).toBeNull();
  });

  it('measures drawdown peak-to-trough in closing order', () => {
    const s = computeChatStats(
      [
        trade({ id: 'b', exit_time: '2026-03-12T15:00:00', pnl: -60 }),
        trade({ id: 'a', exit_time: '2026-03-12T09:00:00', pnl: 100 }),
        trade({ id: 'c', exit_time: '2026-03-12T17:00:00', pnl: 20 }),
      ],
      'USD'
    );
    expect(s.maxDrawdown).toBe(60);
  });

  it('returns zeroes rather than NaN on an empty history', () => {
    const s = computeChatStats([], 'USD');
    expect(s.winRatePct).toBe(0);
    expect(s.expectancy).toBe(0);
    expect(s.avgR).toBeNull();
  });
});

describe('buildChatContext', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      trade({
        id: `t${i}`,
        pnl: i % 2 === 0 ? 50 : -20,
        exit_time: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T12:00:00`,
      })
    );

  it('never includes an open position', () => {
    const ctx = buildChatContext({
      trades: [trade({ id: 'open', pnl: null as never }), trade({ id: 'closed' })],
    });
    expect(ctx.trades).toHaveLength(1);
  });

  it('caps the window but keeps stats over the whole history', () => {
    const ctx = buildChatContext({ trades: many(200) });
    expect(ctx.trades).toHaveLength(MAX_CHAT_TRADES);
    // The model must not describe a slice as if it were the full record.
    expect(ctx.stats.trades).toBe(200);
  });

  it('always includes the focused trade, even outside the recent window', () => {
    const history = many(200);
    const oldest = history[history.length - 1];
    const ctx = buildChatContext({ trades: history, focusTradeId: oldest.id });
    expect(ctx.trades.some(t => t.n === ctx.focusTradeN)).toBe(true);
    expect(ctx.focusTradeN).not.toBeNull();
    expect(ctx.trades).toHaveLength(MAX_CHAT_TRADES);
  });

  it('reports no focus when none was asked for', () => {
    expect(buildChatContext({ trades: many(5) }).focusTradeN).toBeNull();
  });

  it('works from the very first trade — no minimum sample', () => {
    // Unlike the one-shot summary, which needs 20 trades to say anything
    // statistical, a conversation about a single trade is legitimate.
    const ctx = buildChatContext({ trades: [trade()] });
    expect(ctx.trades).toHaveLength(1);
    expect(ctx.stats.trades).toBe(1);
  });
});

describe('the v2 account block', () => {
  function account(over: Partial<TradingAccount> = {}): TradingAccount {
    return {
      id: 'a1',
      user_id: 'u',
      name: 'FTMO 50K',
      type: 'challenge',
      balance: 50000,
      initial_balance: 50000,
      currency: 'USD',
      is_active: true,
      max_daily_loss_limit: 1000,
      max_drawdown_limit: 2500,
      profit_target: 5000,
      created_at: '2026-01-01T00:00:00',
      ...over,
    } as TradingAccount;
  }

  it('carries the derived risk figures the dashboard already shows', () => {
    // "Today" from the machine running the test: isSameLocalDay buckets by
    // the local day, so the fixtures must live in it.
    const today = new Date();
    const hhmm = (h: number, m: number) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;
    };
    const ctx = buildChatContext({
      trades: [
        trade({ pnl: -400, entry_time: hhmm(9, 30) }),
        trade({ pnl: -300, entry_time: hhmm(15, 10) }),
      ],
      account: account(),
      isLocked: true,
    });
    expect(ctx.account).not.toBeNull();
    expect(ctx.account!.name).toBe('FTMO 50K');
    // Two red trades today: 700 consumed of the 1000 limit, 300 left,
    // and the guard would have locked the session at that point.
    expect(ctx.account!.todayPnl).toBe(-700);
    expect(ctx.account!.dailyLossLimit).toBe(1000);
    expect(ctx.account!.dailyRemaining).toBe(300);
    expect(ctx.account!.isLocked).toBe(true);
  });

  it('computes target and drawdown progress as bounded fractions', () => {
    const ctx = buildChatContext({
      trades: [trade({ pnl: 1250 })],
      account: account(),
    });
    expect(ctx.account!.profitTargetProgress).toBe(0.25); // 1250 / 5000
    expect(ctx.account!.drawdownUsedPct).toBe(0); // no losing day yet
    expect(ctx.account!.bestDayPnl).toBe(1250);
  });

  it('stays null without a selected account, instead of faking one', () => {
    // A combined multi-account total is not an account; handing the model
    // an anonymous aggregate dressed as one would invite confident lies.
    const ctx = buildChatContext({ trades: [trade()] });
    expect(ctx.account).toBeNull();
  });

  it('leaves limit fields null when the account has none configured', () => {
    const ctx = buildChatContext({
      trades: [trade({ pnl: 80 })],
      account: account({ max_daily_loss_limit: null, max_drawdown_limit: null, profit_target: null }),
    });
    expect(ctx.account!.dailyLossLimit).toBeNull();
    expect(ctx.account!.dailyRemaining).toBeNull();
    expect(ctx.account!.profitTargetProgress).toBeNull();
    expect(ctx.account!.drawdownUsedPct).toBeNull();
  });
});

describe('broker excursions (MAE/MFE in R)', () => {
  it('is null when no closed trade carries excursions — manual journals', () => {
    const ctx = buildChatContext({ trades: [trade()] });
    expect(ctx.excursions).toBeNull();
    expect(ctx.isAutoAccount).toBe(false);
  });

  it('flags the auto feed from the account, not from the data', () => {
    const ctx = buildChatContext({
      trades: [trade()],
      account: {
        id: 'a', user_id: 'u', name: '50k', type: 'funded', balance: 50000,
        initial_balance: 50000, currency: 'USD', is_active: true,
        max_daily_loss_limit: null, feed_mode: 'auto', created_at: '',
      } as unknown as TradingAccount,
    });
    expect(ctx.isAutoAccount).toBe(true);
  });

  it('converts MAE/MFE to R and counts noise-stops and runners', () => {
    // risk = |2400.55 - 2395| = 5.55. Excursion +22.2 => 4R; MAE -2.775 => 0.5R.
    const ctx = buildChatContext({
      trades: [
        trade({ mae_price: 2397.775, mfe_price: 2422.75 }),
        trade({
          id: 't2',
          mae_price: 2394, // beyond the stop: through the noise
          mfe_price: 2405.55, // ~0.9R
        }),
      ],
    });
    const ex = ctx.excursions!;
    expect(ex.measured).toBe(2);
    expect(ex.stoppedThroughNoise).toBe(1);
    expect(ex.runners2R).toBe(1);
    expect(ex.avgMfeR).toBeCloseTo((4 + 0.9) / 2, 1);
  });

  it('respects the SELL direction', () => {
    // SELL: stop ABOVE entry (2406.55 -> risk 6). MAE 2406.55 = 1R adverse;
    // MFE 2388.55 = (2400.55-2388.55) = 12 down = 2R favourable.
    const ctx = buildChatContext({
      trades: [
        trade({
          direction: 'SELL',
          stop_loss: 2406.55,
          mae_price: 2406.55,
          mfe_price: 2388.55,
        }),
      ],
    });
    expect(ctx.excursions!.runners2R).toBe(1);
    expect(ctx.excursions!.stoppedThroughNoise).toBe(1);
  });

  it('refuses trades whose stop is zero or on the wrong side', () => {
    const ctx = buildChatContext({
      trades: [
        trade({ mae_price: 2390, mfe_price: 2410, stop_loss: 0 }),
        trade({ mae_price: 2390, mfe_price: 2410, stop_loss: 2450, direction: 'BUY' }),
      ],
    });
    expect(ctx.excursions).toBeNull();
  });

  it('measures capture as banked R over best excursion R', () => {
    // mfeR = 4, realized 1.8 => capture 0.45.
    const ctx = buildChatContext({
      trades: [trade({ mae_price: 2397.775, mfe_price: 2422.75 })],
    });
    expect(ctx.excursions!.avgCaptureRatio).toBeCloseTo(0.45, 2);
  });
});
