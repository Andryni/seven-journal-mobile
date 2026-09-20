import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ConnectorSheet } from '../ConnectorSheet';
import type { IngestAccountRow } from '../../../features/sync/useSyncQueue';

/**
 * Repairing a feed must not mean destroying it.
 *
 * Renaming and rotating a secret both used to require deleting the connector,
 * which cascades into its queue and drops the provenance of every trade it
 * promoted. These tests pin the sheet's contract instead: a rename is only
 * offered when it is a real, valid, non-duplicate change; rotating asks for
 * confirmation first; and pausing is the strongest thing the gestures can do —
 * there is no delete here to press by accident.
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
  ...over,
});

function renderSheet(over: Partial<IngestAccountRow> = {}, otherLabels: string[] = []) {
  const onRename = jest.fn();
  const onRotateSecret = jest.fn();
  const onToggleActive = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <ConnectorSheet
      connector={connector(over)}
      otherLabels={otherLabels}
      pendingRequests={0}
      isBusy={false}
      onRename={onRename}
      onRotateSecret={onRotateSecret}
      onToggleActive={onToggleActive}
      onClose={onClose}
    />
  );
  return { ...utils, onRename, onRotateSecret, onToggleActive, onClose };
}

describe('ConnectorSheet', () => {
  it('renames with the normalised label', () => {
    const { getByLabelText, getByText, onRename } = renderSheet();
    fireEvent.changeText(getByLabelText('Nom du connecteur'), '  MT5   Challenge  ');
    fireEvent.press(getByText(/Renommer|Rename/));
    expect(onRename).toHaveBeenCalledWith('MT5 Challenge');
  });

  it('refuses to save an unchanged or duplicate name', () => {
    const { getByLabelText, getByText, onRename } = renderSheet({}, ['MT5 #2']);

    // Unchanged: nothing to write.
    fireEvent.press(getByText(/Renommer|Rename/));
    expect(onRename).not.toHaveBeenCalled();

    // Same name as another connector, different case and spacing: refused.
    fireEvent.changeText(getByLabelText('Nom du connecteur'), 'mt5  #2');
    fireEvent.press(getByText(/Renommer|Rename/));
    expect(onRename).not.toHaveBeenCalled();
    expect(getByText(/déjà ce nom|already uses this name/)).toBeTruthy();
  });

  it('asks for confirmation before regenerating the secret', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByLabelText, onRotateSecret } = renderSheet();

    fireEvent.press(getByLabelText(/Régénérer le secret|Regenerate secret/));
    expect(alert).toHaveBeenCalledTimes(1);
    // Nothing happens until the destructive option is chosen: the terminal
    // keeps a working secret until then.
    expect(onRotateSecret).not.toHaveBeenCalled();

    const destructive = alert.mock.calls[0][2]?.find(b => b.style === 'destructive');
    destructive?.onPress?.();
    expect(onRotateSecret).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('pauses an active feed and offers resume on a paused one', () => {
    const active = renderSheet();
    fireEvent.press(active.getByLabelText(/Mettre en pause|^Pause$/));
    expect(active.onToggleActive).toHaveBeenCalledTimes(1);

    const paused = renderSheet({ is_active: false });
    fireEvent.press(paused.getByLabelText(/Reprendre|Resume/));
    expect(paused.onToggleActive).toHaveBeenCalledTimes(1);
    // Resuming is offered instead of pausing, and the state is stated.
    expect(paused.getByText(/en pause|paused/i)).toBeTruthy();
  });

  it('never offers a way to delete the connector', () => {
    const { queryByText } = renderSheet();
    expect(queryByText(/Supprimer|Delete/i)).toBeNull();
  });
});
