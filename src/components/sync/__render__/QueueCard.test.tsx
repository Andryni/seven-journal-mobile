import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueueCard } from '../QueueCard';
import { toQueueCard } from '../../../features/sync/normalize';
import type { SyncTradeRow } from '../../../features/sync/normalize';

/**
 * One card, one job: offer the decision, or state that it has already been
 * made.
 *
 * An OPEN position is promoted while it is still open, so its staging row
 * deliberately stays `pending` until the broker closes the position — the
 * close event completes the journal trade. Rendering the promote button again
 * for that same row is therefore not a harmless duplicate: it inserts a
 * SECOND journal trade for one position. These two tests are what stops that
 * from being possible through the UI.
 */

const row = (over: Partial<SyncTradeRow>): SyncTradeRow => ({
  id: 'stg-1',
  external_id: '123456',
  payload: { symbol: 'BTCUSD', direction: 'BUY', size: 1, entry_price: 81046.29, pnl: 502.99 },
  is_open: true,
  open_time: '2026-09-19T20:29:00Z',
  close_time: null,
  status: 'pending',
  created_at: '2026-09-19T20:29:05Z',
  ...over,
});

function renderCard(rowOver: Partial<SyncTradeRow>, onPromote = jest.fn()) {
  const card = toQueueCard(row(rowOver));
  const utils = render(
    <QueueCard
      card={card}
      connectorLabel="MT5 - Compte demo"
      closeTimeLabel={null}
      onPromote={onPromote}
      onLink={jest.fn()}
      onDismiss={jest.fn()}
    />
  );
  return { ...utils, onPromote };
}

describe('QueueCard', () => {
  it('offers promote/link/dismiss for an undecided row', () => {
    const { getByText, onPromote } = renderCard({});
    const promote = getByText(/Promouvoir|^Promote$/);
    expect(promote).toBeTruthy();
    expect(getByText(/Lier|Link/)).toBeTruthy();
    expect(getByText(/Ignorer|Dismiss/)).toBeTruthy();

    fireEvent.press(promote);
    expect(onPromote).toHaveBeenCalledTimes(1);
  });

  it('replaces the actions with a note once the position is in the journal', () => {
    const { getByText, queryByText, onPromote } = renderCard({ resolution: 'created' });
    expect(getByText(/Déjà au journal|Already in the journal/)).toBeTruthy();
    // No second decision to make: promoting again would duplicate the trade,
    // and dismissing would strand the one the broker still has to close.
    expect(queryByText(/Promouvoir|^Promote$/)).toBeNull();
    expect(queryByText(/Lier|^Link$/)).toBeNull();
    expect(queryByText(/Ignorer|^Dismiss$/)).toBeNull();
    expect(onPromote).not.toHaveBeenCalled();
  });
});
