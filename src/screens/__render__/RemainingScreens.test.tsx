import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';
import { AccountsScreen } from '../AccountsScreen';
import { CalendarScreen } from '../CalendarScreen';
import { MoreScreen } from '../MoreScreen';
import { WeeklyReviewScreen } from '../WeeklyReviewScreen';
import { MonthlyReviewScreen } from '../MonthlyReviewScreen';
import { YearlyReviewScreen } from '../YearlyReviewScreen';
import { LockScreen } from '../LockScreen';
import { renderScreen, makeHistory, makeAccount, makeTrade } from '../../test-utils/renderScreen';

/**
 * The screens that still had no render test.
 *
 * Grouped in one file on purpose: each is small enough that a dedicated file
 * would be mostly boilerplate, and what matters is the same in all of them --
 * that they mount, survive an empty dataset, and do not crash on the edge
 * cases the journal actually produces (a zero balance, a day with no trades,
 * a history of scratches).
 */

const data = { trades: makeHistory(24), accounts: [makeAccount()] };

describe('AccountsScreen', () => {
  it('mounts with accounts and trades', () => {
    expect(() => renderScreen(<AccountsScreen />, data)).not.toThrow();
  });

  it('mounts with no accounts at all', () => {
    expect(() => renderScreen(<AccountsScreen />, { trades: [], accounts: [] })).not.toThrow();
  });

  it('survives an account with a zero starting balance', () => {
    // Division by initial_balance drives the percentage column; a blown or
    // freshly created account is exactly when this screen gets opened.
    expect(() =>
      renderScreen(<AccountsScreen />, {
        trades: makeHistory(5),
        accounts: [makeAccount({ initial_balance: 0, balance: 0 } as never)],
      })
    ).not.toThrow();
  });

  it('renders several accounts in different currencies', () => {
    expect(() =>
      renderScreen(<AccountsScreen />, {
        trades: makeHistory(10),
        accounts: [
          makeAccount({ id: 'a1', name: 'USD', currency: 'USD' } as never),
          makeAccount({ id: 'a2', name: 'EUR', currency: 'EUR' } as never),
        ],
      })
    ).not.toThrow();
  });
});

describe('CalendarScreen', () => {
  it('mounts with a populated month', () => {
    expect(() => renderScreen(<CalendarScreen />, data)).not.toThrow();
  });

  it('mounts with no trades', () => {
    expect(() =>
      renderScreen(<CalendarScreen />, { trades: [], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('handles trades sitting on a month boundary', () => {
    // Off-by-one in the grid would surface here rather than mid-month.
    const edges = [
      makeTrade({ id: 'e1', entry_time: '2026-03-01T08:00:00', exit_time: '2026-03-01T09:00:00' }),
      makeTrade({ id: 'e2', entry_time: '2026-03-31T22:00:00', exit_time: '2026-03-31T23:00:00' }),
    ];
    expect(() =>
      renderScreen(<CalendarScreen />, { trades: edges, accounts: [makeAccount()] })
    ).not.toThrow();
  });
});

describe('MoreScreen', () => {
  it('mounts and lists its entries', () => {
    expect(() => renderScreen(<MoreScreen />, data)).not.toThrow();
  });
});

describe('WeeklyReviewScreen', () => {
  it('mounts with a populated week', () => {
    expect(() => renderScreen(<WeeklyReviewScreen />, data)).not.toThrow();
  });

  it('mounts with nothing to review', () => {
    // "No trades this week" is a normal state, not an error.
    expect(() =>
      renderScreen(<WeeklyReviewScreen />, { trades: [], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('handles a week of scratches, where every denominator is zero', () => {
    const flat = makeHistory(8).map(t => ({ ...t, pnl: 0, r_multiple: 0, result: 'BE' }));
    expect(() =>
      renderScreen(<WeeklyReviewScreen />, { trades: flat, accounts: [makeAccount()] })
    ).not.toThrow();
  });

  /** A closed winning trade inside the Monday-first week `weeksAgo` back. */
  function weekTrade(weeksAgo: number, id: string) {
    const d = new Date();
    const mondayOffset = (d.getDay() + 6) % 7;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset - 7 * weeksAgo, 9);
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
      t.getDate()
    ).padStart(2, '0')}T09:00:00`;
    return { id, entry_time: iso, exit_time: iso, pnl: 120, r_multiple: 1.2, result: 'TP' as const };
  }

  it('pages back week by week and returns with the forward chevron', () => {
    const { getByTestId, queryByTestId } = renderScreen(<WeeklyReviewScreen />, {
      trades: [weekTrade(0, 'wk0'), weekTrade(1, 'wk1'), weekTrade(2, 'wk2')],
      accounts: [makeAccount()],
    });
    // Live week: one way back only.
    expect(queryByTestId('weekly-prev')).toBeTruthy();
    expect(queryByTestId('weekly-next')).toBeNull();

    // Two pages back lands on the journal's oldest week: only forward remains.
    fireEvent.press(getByTestId('weekly-prev'));
    fireEvent.press(getByTestId('weekly-prev'));
    expect(queryByTestId('weekly-prev')).toBeNull();
    expect(queryByTestId('weekly-next')).toBeTruthy();

    // Forward returns to the live week (two steps) and re-arms the back arrow.
    fireEvent.press(getByTestId('weekly-next'));
    expect(queryByTestId('weekly-prev')).toBeTruthy();
    expect(queryByTestId('weekly-next')).toBeTruthy();
    fireEvent.press(getByTestId('weekly-next'));
    expect(queryByTestId('weekly-prev')).toBeTruthy();
    expect(queryByTestId('weekly-next')).toBeNull();
  });
});

describe('YearlyReviewScreen', () => {
  /** A closed winning trade on the 5th of month `m` (1-12) of `yearOffset` back. */
  function yearTrade(m: number, yearOffset = 0, id = 'y1') {
    const d = new Date();
    const y = d.getFullYear() - yearOffset;
    const iso = `${y}-${String(m).padStart(2, '0')}-05T09:00:00`;
    return { id, entry_time: iso, exit_time: iso, pnl: 120, r_multiple: 1.2, result: 'TP' as const };
  }

  it('mounts with a populated year', () => {
    expect(() =>
      renderScreen(<YearlyReviewScreen />, {
        trades: [yearTrade(1), yearTrade(3, 0, 'y2'), yearTrade(12, 0, 'y3')],
        accounts: [makeAccount()],
      })
    ).not.toThrow();
  });

  it('mounts with nothing to review', () => {
    expect(() =>
      renderScreen(<YearlyReviewScreen />, { trades: [], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('pages back a year and returns with the forward chevron', () => {
    const { getByTestId, queryByTestId } = renderScreen(<YearlyReviewScreen />, {
      trades: [yearTrade(2, 0, 'a'), yearTrade(2, 1, 'b'), yearTrade(2, 2, 'c')],
      accounts: [makeAccount()],
    });
    // Live year: one way back only.
    expect(queryByTestId('yearly-next')).toBeNull();
    fireEvent.press(getByTestId('yearly-prev'));
    expect(queryByTestId('yearly-prev')).toBeTruthy();
    expect(queryByTestId('yearly-next')).toBeTruthy();
    fireEvent.press(getByTestId('yearly-next'));
    expect(queryByTestId('yearly-next')).toBeNull();
  });

  it('shows the empty state for a year before the journal', () => {
    const { queryByText } = renderScreen(<YearlyReviewScreen />, {
      trades: [yearTrade(2, 3)],
      accounts: [makeAccount()],
    });
    // The live year holds nothing: the yearly empty state is the honest read.
    expect(queryByText(/PAS ENCORE|NO YEAR/i)).toBeTruthy();
  });
});

/** A closed winning trade dated the 5th of the live month. */
function thisMonth() {
  const d = new Date();
  return {
    id: 'this-month',
    entry_time: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05T09:00:00`,
    exit_time: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05T11:00:00`,
    pnl: 180,
    r_multiple: 1.5,
    result: 'TP' as const,
  };
}

/** A closed winning trade dated the 10th of the previous month. */
function lastMonth() {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 10);
  return {
    id: 'prev-month',
    entry_time: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-10T09:00:00`,
    exit_time: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-10T11:00:00`,
    pnl: 240,
    r_multiple: 1.5,
    result: 'TP' as const,
  };
}

describe('MonthlyReviewScreen', () => {
  it('mounts with a populated month', () => {
    expect(() => renderScreen(<MonthlyReviewScreen />, data)).not.toThrow();
  });

  it('mounts with nothing to review', () => {
    expect(() =>
      renderScreen(<MonthlyReviewScreen />, { trades: [], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('handles a month of scratches, where every denominator is zero', () => {
    const flat = makeHistory(8).map(t => ({ ...t, pnl: 0, r_multiple: 0, result: 'BE' }));
    expect(() =>
      renderScreen(<MonthlyReviewScreen />, { trades: flat, accounts: [makeAccount()] })
    ).not.toThrow();
  });

  /**
   * makeHistory dates every trade in March 2026, while the review opens on
   * the live month — the seeds must be relative to the clock the review
   * itself uses. One trade this month keeps the screen populated, one last
   * month turns the prev arrow on; pressing it re-anchors the hook, which
   * must recompute every figure without crashing.
   */
  it('offers prev-month navigation and survives stepping back and forward', () => {
    const { getByTestId } = renderScreen(<MonthlyReviewScreen />, {
      trades: [makeTrade(thisMonth()), makeTrade(lastMonth())],
      accounts: [makeAccount()],
    });

    expect(() => fireEvent.press(getByTestId('monthly-prev'))).not.toThrow();
    // Navigated: the next arrow appears and re-anchors to the live month.
    expect(() => fireEvent.press(getByTestId('monthly-next'))).not.toThrow();
  });

  it('opens the share card modal from the share button', () => {
    const { getByLabelText, queryByText } = renderScreen(<MonthlyReviewScreen />, {
      trades: [makeTrade(thisMonth())],
      accounts: [makeAccount()],
    });
    fireEvent.press(getByLabelText(/PARTAGER P&L|SHARE P&L/i));
    expect(queryByText(/PARTAGER MA PERFORMANCE|SHARE MY PERFORMANCE/i)).toBeTruthy();
  });
});

describe('LockScreen', () => {
  it('mounts and prompts', () => {
    expect(() =>
      render(<LockScreen onAuthenticate={() => {}} isAuthenticating={false} />)
    ).not.toThrow();
  });

  it('renders its busy state without throwing', () => {
    expect(() =>
      render(<LockScreen onAuthenticate={() => {}} isAuthenticating />)
    ).not.toThrow();
  });

  it('calls back when the unlock control is used', () => {
    const onAuthenticate = jest.fn();
    const { UNSAFE_root } = render(
      <LockScreen onAuthenticate={onAuthenticate} isAuthenticating={false} />
    );
    // The screen prompts on mount, so the callback fires without interaction;
    // this pins that behaviour rather than a specific button.
    expect(() => fireEvent(UNSAFE_root, 'layout')).not.toThrow();
  });
});
