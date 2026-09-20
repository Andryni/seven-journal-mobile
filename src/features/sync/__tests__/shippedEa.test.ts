import { readFileSync } from 'fs';
import { join } from 'path';
import {
  EA_MIN_CANDLES,
  EA_MIN_LIVE_ANSWER,
  EA_SHIPPED_LABEL,
  EA_SHIPPED_VERSION,
} from '../eaVersion';

/**
 * The EA ships with the app (assets/ea/SevenJournalSync.mq5), and the connector
 * sheet hands it to the trader. That makes the file a PROMISE: the same screen
 * says "this terminal is too old, it cannot resend levels for an open
 * position", and then offers the build that fixes it.
 *
 * If the shipped file were older than the promise, nothing would break here —
 * it would break a week later, on someone's VPS, as a completion request that
 * still goes unanswered. So the file is checked against the app's own version
 * claims, from the real source on disk.
 *
 * Two copies of the same EA exist by design: `bridge/mt5/` is the development
 * copy, `assets/ea/` the one that ships. This test reads the SHIPPED one; the
 * copy is refreshed with the bridge file and the check below is what proves
 * they still agree.
 */
const SHIPPED = join(__dirname, '..', '..', '..', '..', 'assets', 'ea', 'SevenJournalSync.mq5');
const BRIDGE = join(__dirname, '..', '..', '..', '..', 'bridge', 'mt5', 'SevenJournalSync.mq5');

const source = readFileSync(SHIPPED, 'utf8');
const bridgeSource = readFileSync(BRIDGE, 'utf8');

function versionFrom(text: string, pattern: RegExp): { major: number; minor: number } | null {
  const m = text.match(pattern);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

describe('the EA shipped with the app', () => {
  it('declares the version the app promises', () => {
    // `#define EA_VERSION` is what the heartbeat reports; `#property version`
    // is what MetaEditor shows. They are two literals of the same fact.
    const reported = versionFrom(source, /#define\s+EA_VERSION\s+"(\d+)\.(\d+)"/);
    const property = versionFrom(source, /#property\s+version\s+"(\d+)\.(\d+)"/);

    expect(reported).toEqual(EA_SHIPPED_VERSION);
    expect(property).toEqual(EA_SHIPPED_VERSION);
  });

  it('is at least the build the app claims can answer for an open position', () => {
    const shippedIsNewer =
      EA_SHIPPED_VERSION.major > EA_MIN_LIVE_ANSWER.major ||
      (EA_SHIPPED_VERSION.major === EA_MIN_LIVE_ANSWER.major &&
        EA_SHIPPED_VERSION.minor >= EA_MIN_LIVE_ANSWER.minor);

    expect(shippedIsNewer).toBe(true);
    expect(EA_SHIPPED_LABEL).toBe(`v${EA_SHIPPED_VERSION.major}.${EA_SHIPPED_VERSION.minor}`);
  });

  it('is identical to the bridge copy in the repository', () => {
    // Not a formality: editing `bridge/mt5/` and forgetting the asset is the
    // realistic mistake, and it would ship an old EA under a new app.
    expect(source).toEqual(bridgeSource);
  });

  it('still knows how to rebuild a live position', () => {
    // The v1.16 capability the warning text promises is ONE function away from
    // being silently dropped in a refactor. Cheap to assert, expensive to lose.
    expect(source).toContain('LivePositionLevels');
    expect(source).toContain('CopyRates');
    expect(source).toContain('ea_version');
  });

  it('can answer a candle request — the replay the app offers', () => {
    // The app gates the "ask the terminal for candles" button on v1.17. If the
    // shipped EA lost its side of the contract, that button would sit there
    // doing nothing on every install, with no error anywhere.
    expect(source).toContain('candle_requests');
    expect(source).toContain('ParseCandleRequests');
    expect(source).toContain('BuildCandlesEvent');
    expect(source).toContain('type\\\":\\\"candles');
  });

  it('announces a version the app can gate on', () => {
    const shipped = EA_SHIPPED_VERSION;
    for (const min of [EA_MIN_LIVE_ANSWER, EA_MIN_CANDLES]) {
      const atLeast =
        shipped.major > min.major ||
        (shipped.major === min.major && shipped.minor >= min.minor);
      expect(atLeast).toBe(true);
    }
  });
});
