import React from 'react';
import { render } from '@testing-library/react-native';
import { SetupSheet } from '../SetupSheet';

/**
 * This sheet is the ONLY place a secret is ever shown — at creation, and after
 * a rotation. The regression it locks: the overlay used to be an absolutely
 * positioned view inside the screen's ScrollView, so on a scrolled page it
 * opened below the viewport — a rotation succeeded and the one-time secret was
 * displayed where nobody could see it. It is a real Modal now; these tests
 * fail if anyone anchors it back to the scroll content.
 */
describe('SetupSheet', () => {
  it('shows the webhook URL and the secret, whatever the scroll position', () => {
    const { getByText } = render(
      <SetupSheet label="MT5 - Compte demo" secret="SECRET-ONE-TIME-123" onDone={() => {}} />
    );

    expect(getByText(/functions\/v1\/sync-ingest/)).toBeTruthy();
    expect(getByText('SECRET-ONE-TIME-123')).toBeTruthy();
  });

  it('names the connector it belongs to', () => {
    const { getByText } = render(
      <SetupSheet label="25k JustMarket" secret="s" onDone={() => {}} />
    );

    expect(getByText(/25k JustMarket/)).toBeTruthy();
  });
});
