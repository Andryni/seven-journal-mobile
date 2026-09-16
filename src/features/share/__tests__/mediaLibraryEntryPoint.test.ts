import fs from 'fs';
import path from 'path';

/**
 * Which expo-media-library entry point the app imports.
 *
 * Reported from the APK: "Save" always failed with "the image could not be
 * saved". The cause was not in our logic. expo-media-library 57 moved to a
 * class-based API and replaced the old functions, at the package root, with
 * stubs that throw:
 *
 *   export async function createAssetAsync() {
 *     throw errorOnLegacyMethodUse('createAssetAsync');
 *   }
 *
 * They still exist and still type-check, so tsc, the bundler and every
 * existing test were happy while the feature was dead on device. The only
 * way to catch this class of breakage without a real gallery is to assert on
 * the import itself.
 */

const HOOK = path.join(__dirname, '..', 'useShareCard.ts');
const PKG_ROOT = path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'expo-media-library');

describe('expo-media-library entry point', () => {
  const source = fs.readFileSync(HOOK, 'utf8');

  it('imports the legacy entry point, not the package root', () => {
    expect(source).toMatch(/expo-media-library\/legacy/);
    // The bare specifier would resolve to the throwing stubs.
    expect(source).not.toMatch(/require\('expo-media-library'\)/);
    expect(source).not.toMatch(/from 'expo-media-library'/);
  });

  it('still loads it lazily, so an unlinked module cannot crash the screen', () => {
    // A static import evaluates at module scope; on a build without the
    // native module that takes the whole screen down instead of degrading.
    expect(source).toMatch(/require\('expo-media-library\/legacy'\)/);
  });

  it('the functions we call are real there, and stubs at the root', () => {
    // Guards the assumption rather than trusting it: if a future version
    // removes the legacy entry or un-deprecates the root, this says so.
    const legacy = fs.readFileSync(
      path.join(PKG_ROOT, 'build', 'legacy', 'MediaLibrary.js'),
      'utf8'
    );
    const rootStubs = fs.readFileSync(
      path.join(PKG_ROOT, 'build', 'legacyWarnings.js'),
      'utf8'
    );

    for (const fn of [
      'createAssetAsync',
      'getAlbumAsync',
      'createAlbumAsync',
      'addAssetsToAlbumAsync',
    ]) {
      expect(legacy).toContain(`function ${fn}`);
      // The root version of the same name is the throwing stub.
      expect(rootStubs).toContain(`function ${fn}`);
      expect(rootStubs).toContain('errorOnLegacyMethodUse');
    }
  });

  it('surfaces the underlying reason instead of a bare failure message', () => {
    // Swallowing the error is what made this take a round trip to diagnose:
    // the throw already named the offending method.
    expect(source).toMatch(/err instanceof Error \? err\.message/);
  });
});
