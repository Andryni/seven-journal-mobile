import React from 'react';
import { render } from '@testing-library/react-native';
import { LiveDriftBanner } from '../LiveDriftBanner';
import type { DriftAlert } from '../../../features/guard/liveDrift';

/**
 * The banner exists for the case the notification cannot cover: the app is
 * already open and a push would be easy to miss and impossible to re-read.
 *
 * Silence is the behaviour that earns it a place on a dashboard held to nine
 * sections, so that is what gets tested first.
 */
describe('LiveDriftBanner', () => {
  it('renders nothing when no rule is breached', () => {
    expect(render(<LiveDriftBanner alert={null} />).toJSON()).toBeNull();
  });

  it('states the count against the rule for a trade-count breach', () => {
    const alert: DriftAlert = {
      code: 'MAX_TRADES_PER_DAY',
      count: 4,
      limit: 3,
      key: '2026-09-16:MAX_TRADES_PER_DAY:4',
    };
    const { getByText } = render(<LiveDriftBanner alert={alert} />);
    // Both numbers matter: the breach means nothing without the rule.
    expect(getByText(/4/)).toBeTruthy();
    expect(getByText(/3/)).toBeTruthy();
  });

  it('states a losing streak against its limit', () => {
    const alert: DriftAlert = {
      code: 'MAX_CONSECUTIVE_LOSSES',
      count: 2,
      limit: 2,
      key: '2026-09-16:MAX_CONSECUTIVE_LOSSES:2',
    };
    const { getByText } = render(<LiveDriftBanner alert={alert} />);
    expect(getByText(/pertes cons/i)).toBeTruthy();
  });

  it('announces itself as an alert to screen readers', () => {
    const alert: DriftAlert = {
      code: 'MAX_TRADES_PER_DAY',
      count: 5,
      limit: 3,
      key: 'k',
    };
    const { getByRole } = render(<LiveDriftBanner alert={alert} />);
    expect(getByRole('alert')).toBeTruthy();
  });
});
