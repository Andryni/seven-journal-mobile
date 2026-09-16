import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { PlaybookScreen } from '../PlaybookScreen';
import { renderScreen, makeHistory, makeAccount, makeTrade } from '../../test-utils/renderScreen';

/**
 * The largest screen in the app (2000+ lines, three tabs, a debrief form, a
 * calendar grid and several derived cards) and it had no render test.
 *
 * Size is the reason it needs one: at this length a change in one tab can
 * break another without anything failing, which is how the discipline
 * checkboxes ended up on a tab with no save button.
 */
describe('PlaybookScreen', () => {
  const data = { trades: makeHistory(30), accounts: [makeAccount()] };

  it('mounts with a populated history', () => {
    expect(() => renderScreen(<PlaybookScreen />, data)).not.toThrow();
  });

  it('mounts with no trades and no debriefs', () => {
    expect(() =>
      renderScreen(<PlaybookScreen />, { trades: [], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('mounts with a single trade', () => {
    expect(() =>
      renderScreen(<PlaybookScreen />, { trades: [makeTrade()], accounts: [makeAccount()] })
    ).not.toThrow();
  });

  it('opens every tab without throwing', () => {
    const { getAllByText } = renderScreen(<PlaybookScreen />, data);
    // Tab labels repeat elsewhere on the screen (card titles reuse the same
    // words), so take the first match rather than demanding a unique one.
    for (const label of [/DEBRIEF|DÉBRIEF/i, /DISCIPLINE/i, /STRAT|SETUP/i]) {
      const nodes = getAllByText(label);
      expect(nodes.length).toBeGreaterThan(0);
      expect(() => fireEvent.press(nodes[0])).not.toThrow();
    }
  });

  it('survives remounting without throwing', () => {
    // rerender() replaces the element without its providers, so a remount is
    // the honest way to exercise the hook chain twice here.
    expect(() => {
      renderScreen(<PlaybookScreen />, data);
      renderScreen(<PlaybookScreen />, data);
    }).not.toThrow();
  });

  it('handles a history where every trade is a scratch', () => {
    // Every win-rate denominator is zero here.
    const flat = makeHistory(10).map(t => ({ ...t, pnl: 0, r_multiple: 0, result: 'BE' }));
    expect(() =>
      renderScreen(<PlaybookScreen />, { trades: flat, accounts: [makeAccount()] })
    ).not.toThrow();
  });
});
