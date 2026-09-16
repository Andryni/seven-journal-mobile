import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { TradesScreen } from '../TradesScreen';
import { renderScreen, makeHistory, makeAccount, makeTrade } from '../../test-utils/renderScreen';

/**
 * The blotter: a filtered, searchable list feeding a detail modal.
 *
 * Worth testing with data rather than empty, because the list only exercises
 * its row rendering, filtering and empty-state logic once there are trades.
 */
describe('TradesScreen', () => {
  const data = { trades: makeHistory(30), accounts: [makeAccount()] };

  it('mounts with a populated blotter', () => {
    expect(() => renderScreen(<TradesScreen />, data)).not.toThrow();
  });

  it('shows the empty state rather than a blank list', () => {
    const { queryByText } = renderScreen(<TradesScreen />, {
      trades: [],
      accounts: [makeAccount()],
    });
    // "No position found" is information; an empty screen reads as a bug.
    expect(queryByText(/aucune position|no position/i)).toBeTruthy();
  });

  it('renders an open position without inventing a result', () => {
    const open = makeTrade({ id: 'open', pnl: null as never, exit_time: null as never });
    const { getAllByText } = renderScreen(<TradesScreen />, {
      trades: [open],
      accounts: [makeAccount()],
    });
    // The row shows the open status instead of a P&L figure. Several nodes
    // can carry the word, so assert presence rather than uniqueness.
    // Default locale is French, so the row reads "EN COURS".
    expect(getAllByText(/^(OPEN|EN COURS)$/i).length).toBeGreaterThan(0);
  });

  it('filters by search text without throwing', () => {
    const { getByPlaceholderText } = renderScreen(<TradesScreen />, data);
    const search = getByPlaceholderText(/recherch|search/i);
    expect(() => {
      fireEvent.changeText(search, 'XAU');
      fireEvent.changeText(search, 'zzzz');
      fireEvent.changeText(search, '');
    }).not.toThrow();
  });

  it('opens the detail modal when a row is tapped', () => {
    const { getAllByText } = renderScreen(<TradesScreen />, {
      trades: [makeTrade({ pair: 'XAUUSD' })],
      accounts: [makeAccount()],
    });
    // The row shows the pair; tapping it must not throw (the modal mounts a
    // second tree with its own hooks).
    expect(() => fireEvent.press(getAllByText('XAUUSD')[0])).not.toThrow();
  });

  it('handles a mix of open and closed positions', () => {
    const mixed = [
      ...makeHistory(8),
      makeTrade({ id: 'o1', pnl: null as never, exit_time: null as never }),
    ];
    expect(() =>
      renderScreen(<TradesScreen />, { trades: mixed, accounts: [makeAccount()] })
    ).not.toThrow();
  });
});
