/**
 * When to offer a restart for an update. Pure on purpose: the `logic` jest
 * project has no React Native and no Expo, so the decision must be importable
 * without dragging `expo-updates` in behind it.
 *
 * The case worth being careful about is the embedded launch — the running
 * bundle IS the one compiled into the binary, so "restart to update" would
 * restart into the same code. A button that does nothing teaches the trader to
 * ignore the button, and the next one will be a fix they actually need.
 */

export interface UpdateOfferFacts {
  /** The build can fetch updates at all (false in Expo Go and in dev). */
  available: boolean;
  /** The running bundle is the one baked into the binary. */
  embedded: boolean;
  /** The update server reported something newer. */
  found: boolean;
}

export function shouldOfferUpdate(facts: UpdateOfferFacts): boolean {
  return facts.available && !facts.embedded && facts.found;
}
