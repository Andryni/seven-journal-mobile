import { Asset } from 'expo-asset';
import * as Sharing from 'expo-sharing';

/**
 * Hand the trader the EA file from the phone.
 *
 * The connector card already tells them WHEN the terminal is too old to answer
 * (see eaVersion.ts) — and that warning used to dead-end: fixing it meant
 * opening MetaEditor on a PC and finding the file in the repository. The
 * information was actionable and the action was out of reach.
 *
 * The file is bundled (assets/ea/SevenJournalSync.mq5, see metro.config.js),
 * so this works with no network and no repository access: resolve the asset,
 * then hand it to the OS share sheet — save to Files, mail it to yourself, send
 * it to the VPS. MQL5/Experts is where it goes on the other end; the connector
 * sheet says so.
 */

export type EaShareResult =
  /** The share sheet opened. */
  | 'shared'
  /** No share sheet on this platform (web, or a stripped build). */
  | 'unsupported'
  /** The bundled asset could not be resolved — a build problem, not a user one. */
  | 'missing';

/**
 * The asset id, resolved lazily.
 *
 * At module scope this require makes EVERY importer of this file (the
 * connector sheet, and any test that mounts it) depend on the bundler having
 * registered the extension — see metro.config.js. Inside the function, only
 * the action that actually shares the file pays for it.
 */
function eaAssetId(): number {
  return require('../../../assets/ea/SevenJournalSync.mq5') as number;
}

export async function shareEaFile(): Promise<EaShareResult> {
  try {
    const asset = Asset.fromModule(eaAssetId());
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return 'missing';

    if (!(await Sharing.isAvailableAsync())) return 'unsupported';

    await Sharing.shareAsync(uri, {
      mimeType: 'text/plain',
      UTI: 'public.plain-text',
      dialogTitle: 'SevenJournalSync.mq5',
    });
    return 'shared';
  } catch {
    return 'missing';
  }
}
