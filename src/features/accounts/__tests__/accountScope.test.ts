import {
  scopeTrades,
  accountsWithTrades,
  isAggregateScope,
  hasMixedCurrencies,
} from '../accountScope';
import type { Trade, TradingAccount } from '../../../types/domain';

const acc = (id: string, currency = 'USD'): TradingAccount =>
  ({
    id,
    user_id: 'u',
    name: id,
    type: 'personal',
    balance: 1000,
    initial_balance: 1000,
    currency,
    is_active: true,
    max_daily_loss_limit: null,
    created_at: '2026-01-01T00:00:00Z',
  }) as TradingAccount;

const trade = (id: string, accountId: string): Trade =>
  ({ id, account_id: accountId, pnl: 10 }) as Trade;

describe('scopeTrades', () => {
  it('keeps only the selected account', () => {
    const r = scopeTrades([trade('1', 'a'), trade('2', 'b')], 'a');
    expect(r.map(t => t.id)).toEqual(['1']);
  });

  it('returns everything when no account is selected', () => {
    const all = [trade('1', 'a'), trade('2', 'b')];
    expect(scopeTrades(all, null)).toHaveLength(2);
  });

  it('returns an empty list for an account that never traded', () => {
    expect(scopeTrades([trade('1', 'a')], 'zzz')).toEqual([]);
  });
});

describe('accountsWithTrades', () => {
  it('excludes dormant accounts', () => {
    const r = accountsWithTrades([trade('1', 'a')], [acc('a'), acc('b')]);
    expect(r.map(a => a.id)).toEqual(['a']);
  });

  it('ignores trades whose account no longer exists', () => {
    const r = accountsWithTrades([trade('1', 'deleted')], [acc('a')]);
    expect(r).toEqual([]);
  });
});

describe('isAggregateScope', () => {
  it('is false whenever an account is selected', () => {
    const t = [trade('1', 'a'), trade('2', 'b')];
    expect(isAggregateScope(t, [acc('a'), acc('b')], 'a')).toBe(false);
  });

  it('is false when only one account has traded', () => {
    // Owning three accounts but trading one is still a single-account view.
    expect(isAggregateScope([trade('1', 'a')], [acc('a'), acc('b'), acc('c')], null)).toBe(false);
  });

  it('is true once two accounts have traded and none is selected', () => {
    const t = [trade('1', 'a'), trade('2', 'b')];
    expect(isAggregateScope(t, [acc('a'), acc('b')], null)).toBe(true);
  });

  it('is false with no trades at all', () => {
    expect(isAggregateScope([], [acc('a'), acc('b')], null)).toBe(false);
  });
});

describe('hasMixedCurrencies', () => {
  it('detects a total adding EUR to USD', () => {
    const t = [trade('1', 'a'), trade('2', 'b')];
    expect(hasMixedCurrencies(t, [acc('a', 'USD'), acc('b', 'EUR')], null)).toBe(true);
  });

  it('is false when the traded accounts agree', () => {
    const t = [trade('1', 'a'), trade('2', 'b')];
    expect(hasMixedCurrencies(t, [acc('a', 'EUR'), acc('b', 'EUR')], null)).toBe(false);
  });

  it('ignores a differing currency on a dormant account', () => {
    expect(hasMixedCurrencies([trade('1', 'a')], [acc('a', 'USD'), acc('b', 'GBP')], null)).toBe(
      false
    );
  });

  it('is false when a single account is selected', () => {
    const t = [trade('1', 'a'), trade('2', 'b')];
    expect(hasMixedCurrencies(t, [acc('a', 'USD'), acc('b', 'EUR')], 'a')).toBe(false);
  });

  it('treats a missing currency as USD', () => {
    const t = [trade('1', 'a'), trade('2', 'b')];
    const noCurrency = { ...acc('b'), currency: undefined } as unknown as TradingAccount;
    expect(hasMixedCurrencies(t, [acc('a', 'USD'), noCurrency], null)).toBe(false);
  });
});
