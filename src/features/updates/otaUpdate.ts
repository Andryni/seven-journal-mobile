import { useCallback, useEffect, useState } from 'react';
import { Updates, updatesAvailable } from './updatesModule';
import { shouldOfferUpdate } from './updatePolicy';

/**
 * Already-downloaded updates, offered instead of waiting for a cold start.
 *
 * app.json ships `updates.checkAutomatically: ON_LOAD` (the default), so a
 * published update IS fetched at launch and applied on the NEXT launch. On a
 * phone that is never fully closed — which is every phone — "the next launch"
 * can be days away, and that is exactly how the trader ended up reporting bugs
 * we had already fixed: the screenshots they sent showed a bundle three
 * sessions old.
 *
 * So: check once after the app is usable, fetch in the background, and offer a
 * one-tap restart when something is ready. Nothing blocks, nothing is forced:
 * an update that arrives while a trade is being entered must never steal the
 * screen.
 */

export type UpdateState = 'idle' | 'available' | 'ready';

export function useOtaUpdate() {
  const [state, setState] = useState<UpdateState>('idle');

  useEffect(() => {
    if (!updatesAvailable || !Updates) return;

    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled) return;

        if (!check.isAvailable) return;

        // Download now, so the restart is instant when the trader taps.
        await Updates.fetchUpdateAsync();
        if (cancelled) return;

        if (
          shouldOfferUpdate({
            available: true,
            embedded: Updates.isEmbeddedLaunch,
            found: check.isAvailable,
          })
        ) {
          setState('ready');
        }
      } catch {
        // A failed check is silent on purpose: the app already works, and an
        // error toast about a background download is noise the trader cannot
        // act on. The next launch retries.
        setState('idle');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(async () => {
    try {
      await Updates?.reloadAsync();
    } catch {
      // Nothing to do: the update is already downloaded and will be applied at
      // the next launch by checkAutomatically.
      setState('idle');
    }
  }, []);

  return { state, apply };
}
