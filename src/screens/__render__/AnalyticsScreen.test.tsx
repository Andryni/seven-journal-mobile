import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { AnalyticsScreen } from '../AnalyticsScreen';
import { renderScreen, makeHistory, makeAccount, makeTrade } from '../../test-utils/renderScreen';

/**
 * 1500 lines, six tabs, a dozen charts — and until now no render test.
 *
 * Every bug this screen has shipped (a percentage axis labelled in dollars,
 * a drawdown axis printing the same label twice) was invisible to tsc and to
 * the unit tests, and only appeared once real trades were drawn. So these
 * tests mount it WITH data and walk the tabs.
 */
describe('AnalyticsScreen', () => {
  const data = { trades: makeHistory(40), accounts: [makeAccount()] };

  it('mounts with a populated history', () => {
    expect(() => renderScreen(<AnalyticsScreen />, data)).not.toThrow();
  });

  it('mounts with no trades at all', () => {
    // The empty state is the first thing a new user sees.
    expect(() => renderScreen(<AnalyticsScreen />, { trades: [], accounts: [makeAccount()] })).not.toThrow();
  });

  it('mounts with a single trade, where most denominators are 1', () => {
    expect(() =>
      renderScreen(<AnalyticsScreen />, { trades: [makeTrade()], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('opens every tab without throwing', () => {
    const { getAllByText } = renderScreen(<AnalyticsScreen />, data);
    // Tab words reappear in card titles, so take the first match rather than
    // demanding a unique one.
    for (const label of [
      /EDGE/i,
      /RÉPARTITION|BREAKDOWN/i,
      /TIMING/i,
      /MENTAL|MIND/i,
      /PROP FIRM|CROISSANCE|GROWTH/i,
      /PERFORMANCE/i,
    ]) {
      const nodes = getAllByText(label);
      expect(nodes.length).toBeGreaterThan(0);
      expect(() => fireEvent.press(nodes[0])).not.toThrow();
    }
  });

  it('switches date ranges without throwing', () => {
    const { getByText } = renderScreen(<AnalyticsScreen />, data);
    for (const label of ['7J', '30J', '90J', 'TOUT']) {
      const node = getByText(label);
      expect(() => fireEvent.press(node)).not.toThrow();
    }
  });

  /**
   * NOTE ON WHAT IS NOT TESTED HERE.
   *
   * I tried to assert that the prop-firm consistency chart never labels its
   * axis with a currency symbol -- the bug that shipped. It cannot be done at
   * this level: the tab's content renders behind a loading skeleton in the
   * test environment, so only the header and tab strip are in the tree. An
   * assertion written against that would pass whatever the chart does, which
   * is worse than no test.
   *
   * The axis rule is covered where it is decidable instead:
   * src/utils/__tests__/chartScale.test.ts pins the tick formatting, and the
   * yAxisSuffix prop is what carries the unit. These screen tests cover the
   * thing they CAN prove: that every tab, date range and account shape mounts
   * and survives interaction.
   */

  it('handles a history of losses only', () => {
    const losses = makeHistory(12).map(t => ({ ...t, pnl: -100, r_multiple: -1, result: 'SL' }));
    expect(() =>
      renderScreen(<AnalyticsScreen />, { trades: losses, accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('handles a prop account, which unlocks the challenge panels', () => {
    expect(() =>
      renderScreen(<AnalyticsScreen />, {
        trades: makeHistory(25),
        accounts: [
          makeAccount({
            type: 'challenge',
            profit_target: 1000,
            max_drawdown: 500,
            daily_loss_limit: 200,
          } as never),
        ],
      })
    ).not.toThrow();
  });
});
