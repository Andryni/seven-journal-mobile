import { shouldOfferUpdate } from '../updatePolicy';

/**
 * The banner is only useful if it is rare and true. See the note in
 * updatePolicy.ts: the embedded launch is the case that must stay silent,
 * because "restart to update" there restarts into the same bundle.
 */
describe('shouldOfferUpdate', () => {
  it('offers a fetched update on a non-embedded launch', () => {
    expect(shouldOfferUpdate({ available: true, embedded: false, found: true })).toBe(true);
  });

  it('stays quiet when the server has nothing newer', () => {
    expect(shouldOfferUpdate({ available: true, embedded: false, found: false })).toBe(false);
  });

  it('stays quiet on an embedded launch', () => {
    // Expo Go and dev builds are always embedded; so is the first run after a
    // fresh install, where there is nothing to replace yet.
    expect(shouldOfferUpdate({ available: true, embedded: true, found: true })).toBe(false);
  });

  it('stays quiet when the build cannot receive updates at all', () => {
    expect(shouldOfferUpdate({ available: false, embedded: false, found: true })).toBe(false);
  });
});
