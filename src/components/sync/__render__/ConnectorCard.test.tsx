import React from 'react';
import { render } from '@testing-library/react-native';
import { ConnectorCard } from '../ConnectorCard';
import type { IngestAccountRow } from '../../../features/sync/useSyncQueue';

/**
 * The row has to say whether this terminal can answer a completion request.
 *
 * A request the EA cannot honour is the worst kind of silence: the app has
 * already told the trader it was sent, and nothing on screen explained why the
 * levels never arrived. The version is reported from v1.16, so its ABSENCE is
 * itself the warning.
 */

const connector = (over: Partial<IngestAccountRow> = {}): IngestAccountRow => ({
  id: 'conn-1',
  platform: 'mt5_ea',
  label: 'MT5 #1',
  is_active: true,
  account_id: 'acc-1',
  last_sync_at: new Date().toISOString(),
  last_sync_status: 'ok',
  last_error: null,
  broker_balance: 25000,
  broker_equity: 25000,
  broker_currency: 'USD',
  broker_state_at: new Date().toISOString(),
  ea_version: '1.16',
  ...over,
});

function renderCard(
  over: Partial<IngestAccountRow> = {},
  pendingRequests = 0,
  linked: { name: string; capital: string } | null = { name: '25K JustMarket', capital: '$25,000' }
) {
  return render(
    <ConnectorCard
      connector={connector(over)}
      linked={linked}
      pendingRequests={pendingRequests}
      isLast
      onPress={jest.fn()}
      onLongPress={jest.fn()}
    />
  );
}

describe('ConnectorCard — EA version', () => {
  it('shows the reported build and no warning on a current EA', () => {
    const { getByText, queryByText } = renderCard();
    expect(getByText(/v1\.16/)).toBeTruthy();
    expect(queryByText(/trop ancien|too old|non annoncée|not reported/)).toBeNull();
  });

  it('warns when no version is reported (build older than the field)', () => {
    const { getByText } = renderCard({ ea_version: null });
    expect(getByText(/non annoncée|not reported/)).toBeTruthy();
  });

  it('warns on a build that cannot answer at all', () => {
    const { getAllByText, getByText } = renderCard({ ea_version: '1.14' });
    // Twice on purpose: the build on the row (next to the platform) and inside
    // the warning that explains what it cannot do.
    expect(getAllByText(/v1\.14/)).toHaveLength(2);
    expect(getByText(/trop ancien|too old/)).toBeTruthy();
  });

  it('flags a v1.15 only alongside a request it cannot fully serve', () => {
    // v1.15 answers for closed positions: a permanent warning on every row
    // would be noise, but a stuck request must be explained.
    const quiet = renderCard({ ea_version: '1.15' });
    expect(quiet.queryByText(/encore ouverte|still open/)).toBeNull();

    const waiting = renderCard({ ea_version: '1.15' }, 3);
    expect(waiting.getByText(/encore ouverte|still open/)).toBeTruthy();
  });

  it('says nothing about a version before the first heartbeat', () => {
    // Unlinked, so the row's primary line is the status itself.
    const { getByText, queryByText } = renderCard(
      { ea_version: null, last_sync_at: null, last_sync_status: null },
      0,
      null
    );
    expect(getByText(/Jamais connecté|Never connected/)).toBeTruthy();
    expect(queryByText(/non annoncée|not reported/)).toBeNull();
  });

  it('counts the requests still waiting on the terminal', () => {
    const { getByText } = renderCard({}, 2);
    expect(getByText(/2 demande|2 request/)).toBeTruthy();
  });
});
