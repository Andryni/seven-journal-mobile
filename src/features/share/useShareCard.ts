import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useT } from '../../i18n';
import { shareFileName, type SharePeriod } from '../../utils/shareScope';

/**
 * Turning the on-screen card into a real PNG.
 *
 * What was here before called Sharing.shareAsync(text) with a plain string.
 * That API takes a file URI, so on a device the call either threw or opened a
 * share sheet for a file named after the first line of the text -- which is
 * why "share" never produced anything usable. Nothing was ever rendered to an
 * image at all.
 *
 * expo-media-library is imported lazily, for the same reason
 * notificationsModule.ts defers expo-notifications: it is a native module, and
 * evaluating it where it is not linked throws at import time and takes the
 * whole screen down. Saving to the gallery degrades to "unavailable" instead.
 */

type MediaLibraryModule = typeof import('expo-media-library');

let mediaLibrary: MediaLibraryModule | null = null;
let mediaLibraryChecked = false;

function getMediaLibrary(): MediaLibraryModule | null {
  if (mediaLibraryChecked) return mediaLibrary;
  mediaLibraryChecked = true;
  try {
    mediaLibrary = require('expo-media-library') as MediaLibraryModule;
  } catch {
    mediaLibrary = null;
  }
  return mediaLibrary;
}

export type ShareBusyState = null | 'sharing' | 'saving';

export function useShareCard() {
  const { t } = useT();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState<ShareBusyState>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /**
   * Render the card at 3x so the PNG is crisp on a retina feed rather than
   * the size it happens to occupy on this particular screen.
   */
  const capture = useCallback(async (): Promise<string> => {
    if (!cardRef.current) throw new Error('card not mounted');
    return captureRef(cardRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      // A fixed width keeps the export identical across phone sizes.
      width: 1080,
      height: undefined,
    });
  }, []);

  const share = useCallback(
    async (period: SharePeriod) => {
      if (busy) return;
      setBusy('sharing');
      try {
        const uri = await capture();

        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(t('shareUnavailableTitle'), t('shareUnavailableBody'));
          return;
        }

        /**
         * Copy to a named file so the share sheet shows something meaningful
         * instead of the random cache filename captureRef produces.
         *
         * Uses the SDK 54+ File/Paths API rather than the legacy one: the old
         * FileSystem.cacheDirectory constant no longer exists in expo-file-
         * system 57's main entry point.
         */
        let shareUri = uri;
        try {
          const target = new File(Paths.cache, shareFileName(period));
          if (target.exists) target.delete();
          new File(uri).copy(target);
          shareUri = target.uri;
        } catch {
          // A copy failure is not worth losing the share over.
        }

        await Sharing.shareAsync(shareUri, {
          mimeType: 'image/png',
          dialogTitle: t('scExportShare'),
          UTI: 'public.png',
        });
      } catch (err) {
        console.warn('share card failed', err);
        Alert.alert(t('shareFailedTitle'), t('shareFailedBody'));
      } finally {
        setBusy(null);
      }
    },
    [busy, capture, t]
  );

  const saveToGallery = useCallback(
    async (period: SharePeriod) => {
      if (busy) return;
      const ML = getMediaLibrary();
      if (!ML) {
        Alert.alert(t('saveUnavailableTitle'), t('saveUnavailableBody'));
        return;
      }

      setBusy('saving');
      try {
        const perm = await ML.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('savePermissionTitle'), t('savePermissionBody'));
          return;
        }

        const uri = await capture();
        const asset = await ML.createAssetAsync(uri);

        /**
         * Filing the image in its own album is a convenience on Android and a
         * failure waiting to happen on iOS, where it needs a broader
         * permission. The asset is already saved by this point, so a failure
         * here must not be reported to the user as a failed save.
         */
        try {
          const album = await ML.getAlbumAsync('Seven Journal');
          if (album) {
            await ML.addAssetsToAlbumAsync([asset], album, false);
          } else if (Platform.OS === 'android') {
            await ML.createAlbumAsync('Seven Journal', asset, false);
          }
        } catch {
          // Saved to the camera roll regardless; that is what was asked for.
        }

        setSavedAt(Date.now());
      } catch (err) {
        console.warn('save to gallery failed', err);
        Alert.alert(t('saveFailedTitle'), t('saveFailedBody'));
      } finally {
        setBusy(null);
      }
    },
    [busy, capture, t]
  );

  return { cardRef, busy, savedAt, share, saveToGallery };
}
