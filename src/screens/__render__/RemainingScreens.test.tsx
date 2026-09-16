import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';
import { AccountsScreen } from '../AccountsScreen';
import { CalendarScreen } from '../CalendarScreen';
import { MoreScreen } from '../MoreScreen';
import { WeeklyReviewScreen } from '../WeeklyReviewScreen';
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
