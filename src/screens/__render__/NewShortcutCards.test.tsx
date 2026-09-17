import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { DashboardScreen } from '../DashboardScreen';
import { AnalyticsScreen } from '../AnalyticsScreen';
import {
  renderScreen,
  makeAccount,
  makeTrade,
} from '../../test-utils/renderScreen';

/**
 * The two new shortcut cards share one invariant: they read journaled trades
 * and stay honest when the journal is empty. The dashboard's version is also
 * interactive — its share button must open the modal preselected on the
 * month scope, which is the whole point of the pin.
 */

/**
 * A mid-month trade with BOTH timestamps in the live month: selectTrades and
 * every other scoper key off exit_time first, so seeding only entry_time
 * leaves the trade outside the month window and the card silently hides.
 */
function thisMonthISO(day = 5) {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T09:00:00`;
}

/** A closed winning trade inside the Monday-first week `weeksAgo` back. */
function weekISO(weeksAgo: number, dayOffset = 2) {
  const d = new Date();
  const mondayOffset = (d.getDay() + 6) % 7;
  const t = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - mondayOffset + dayOffset - 7 * weeksAgo,
    9
  );
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}T09:00:00`;
}

describe('PinnedMonthCard on DashboardScreen', () => {
  it('stays hidden while the pin is off (default)', () => {
    const { queryByText } = renderScreen(<DashboardScreen />, {
      trades: [makeTrade({ entry_time: thisMonthISO(), exit_time: thisMonthISO(6) })],
      accounts: [makeAccount()],
    });
    expect(queryByText(/CARTE ÉPINGLÉE|PINNED CARD/i)).toBeNull();
  });

  it('shows the card and opens the share modal on the month scope when pinned', () => {
    // Arm the persisted preference before mounting.
    const { usePinnedCards } = require('../../features/dashboard/usePinnedCards');
    usePinnedCards.setState({ pinnedMonth: true });

    const { getByTestId, queryByText } = renderScreen(<DashboardScreen />, {
      trades: [makeTrade({ entry_time: thisMonthISO(), exit_time: thisMonthISO(6) })],
      accounts: [makeAccount()],
    });

    expect(() => fireEvent.press(getByTestId('pinned-month-share'))).not.toThrow();
    // The share sheet title proves the modal opened.
    expect(queryByText(/PARTAGER MA PERFORMANCE|SHARE MY PERFORMANCE/i)).toBeTruthy();

    usePinnedCards.setState({ pinnedMonth: false });
  });
});

describe('PinnedWeekCard on DashboardScreen', () => {
  it('stays hidden while the pin is off (default)', () => {
    const { queryByText } = renderScreen(<DashboardScreen />, {
      trades: [makeTrade({ entry_time: weekISO(0), exit_time: weekISO(0) })],
      accounts: [makeAccount()],
    });
    expect(queryByText(/THE WEEK|LA SEMAINE/i)).toBeNull();
  });

  it('shows the card and opens the share modal on the week scope when pinned', () => {
    const { usePinnedCards } = require('../../features/dashboard/usePinnedCards');
    usePinnedCards.setState({ pinnedWeek: true });

    const { getByTestId, queryByText } = renderScreen(<DashboardScreen />, {
      trades: [makeTrade({ entry_time: weekISO(0), exit_time: weekISO(0) })],
      accounts: [makeAccount()],
    });

    expect(() => fireEvent.press(getByTestId('pinned-week-share'))).not.toThrow();
    expect(queryByText(/PARTAGER MA PERFORMANCE|SHARE MY PERFORMANCE/i)).toBeTruthy();

    usePinnedCards.setState({ pinnedWeek: false });
  });
});

describe('PinnedMonthCard navigation', () => {
  it('pages back to a past month and its export anchors to that month', () => {
    const { usePinnedCards } = require('../../features/dashboard/usePinnedCards');
    usePinnedCards.setState({ pinnedMonth: true });

    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 10, 9);
    const prevISO = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-10T09:00:00`;

    const { getByTestId, queryByTestId, queryByText } = renderScreen(<DashboardScreen />, {
      trades: [
        makeTrade({ entry_time: thisMonthISO(), exit_time: thisMonthISO(6) }),
        makeTrade({ id: 't-prev', entry_time: prevISO, exit_time: prevISO, pnl: 90 }),
      ],
      accounts: [makeAccount()],
    });

    // Live month: no way forward, one way back (the journal holds a past month).
    expect(queryByTestId('pinned-month-next')).toBeNull();
    fireEvent.press(getByTestId('pinned-month-prev'));
    // Now on the previous month: forward exists, back is gone (journal start).
    expect(queryByTestId('pinned-month-prev')).toBeNull();
    expect(queryByTestId('pinned-month-next')).toBeTruthy();
    // The share button still opens the sheet while anchored on the past month.
    expect(() => fireEvent.press(getByTestId('pinned-month-share'))).not.toThrow();
    expect(queryByText(/PARTAGER MA PERFORMANCE|SHARE MY PERFORMANCE/i)).toBeTruthy();

    usePinnedCards.setState({ pinnedMonth: false });
  });
});

describe('ExecutiveSummaryCard on DashboardScreen', () => {
  it('renders the three-line brief from seeded metrics', () => {
    const { queryByText } = renderScreen(<DashboardScreen />, {
      trades: [makeTrade({ entry_time: thisMonthISO(), exit_time: thisMonthISO(6) })],
      accounts: [makeAccount()],
    });
    // Line 1 interpolates (net · win rate · count) — the very bug class the
    // yearly review shipped with, asserted here so it cannot return.
    expect(queryByText(/\$180 de net|\$180 net/)).toBeTruthy();
    expect(queryByText(/de réussite sur|win rate over/)).toBeTruthy();
  });

  it('stays hidden for an empty journal', () => {
    const { queryByText } = renderScreen(<DashboardScreen />, {
      trades: [],
      accounts: [makeAccount()],
    });
    expect(queryByText(/de réussite sur|win rate over/)).toBeNull();
  });
});

describe('MonthlyPerformanceCard in AnalyticsScreen', () => {
  it('mounts the performance tab with monthly rows', () => {
    const { getAllByText } = renderScreen(<AnalyticsScreen />, {
      trades: [makeTrade(), makeTrade({ id: 't2', pnl: -40, result: 'SL' as const })],
      accounts: [makeAccount()],
    });
    // Open the PERFORMANCE tab.
    const tabs = getAllByText(/PERFORMANCE/i);
    expect(() => fireEvent.press(tabs[0])).not.toThrow();
  });

  it('renders nothing for an empty journal (no months to show)', () => {
    expect(() =>
      renderScreen(<AnalyticsScreen />, { trades: [], accounts: [makeAccount()] })
    ).not.toThrow();
  });
});
