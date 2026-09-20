import {
  DEFAULT_PREFLIGHT_KEYS,
  localDayKey,
  preFlightRequired,
  preFlightSatisfied,
} from '../preFlight';

/**
 * The rule that decides whether a trader is asked to confirm their own rules
 * before entering. Getting it wrong in either direction is expensive: too
 * eager and the app gets uninstalled, too lax and the one device that exists
 * to prevent an impulsive entry stops preventing anything.
 */
describe('preFlightRequired', () => {
  it('does not gate a trader who has written no checklist', () => {
    // Nothing to confirm. An app that invents rules for the user is an app
    // that gets deleted.
    expect(preFlightRequired({ itemCount: 0, completedOn: null, tradeDay: '2026-09-20' })).toBe(
      false
    );
  });

  it('gates the day until the items are ticked', () => {
    expect(preFlightRequired({ itemCount: 4, completedOn: null, tradeDay: '2026-09-20' })).toBe(
      true
    );
  });

  it('stops gating once today is done', () => {
    expect(
      preFlightRequired({ itemCount: 4, completedOn: '2026-09-20', tradeDay: '2026-09-20' })
    ).toBe(false);
  });

  it('does not carry yesterday into today', () => {
    // The whole point of a checklist is that it is daily: "I ticked these last
    // Tuesday" is exactly the reasoning it exists to interrupt.
    expect(
      preFlightRequired({ itemCount: 4, completedOn: '2026-09-19', tradeDay: '2026-09-20' })
    ).toBe(true);
  });
});

describe('preFlightSatisfied', () => {
  it('lets anything through when the gate is off', () => {
    expect(preFlightSatisfied(false, false)).toBe(true);
  });

  it('requires every item when the gate is on', () => {
    expect(preFlightSatisfied(true, false)).toBe(false);
    expect(preFlightSatisfied(true, true)).toBe(true);
  });
});

describe('localDayKey', () => {
  it('keys the day in the device timezone, not UTC', () => {
    // 23:30 local on the 20th is the 21st in UTC for a trader at UTC+3 — the
    // same off-by-one that once made the daily lock write under a date the app
    // never queried.
    expect(localDayKey(new Date(2026, 8, 20, 23, 30))).toBe('2026-09-20');
    expect(localDayKey(new Date(2026, 8, 20, 0, 5))).toBe('2026-09-20');
  });

  it('pads month and day', () => {
    expect(localDayKey(new Date(2026, 0, 3, 12))).toBe('2026-01-03');
  });
});

describe('the seeded checklist', () => {
  it('stays short enough to be finished', () => {
    // A list nobody completes is a list nobody reads.
    expect(DEFAULT_PREFLIGHT_KEYS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_PREFLIGHT_KEYS.length).toBeLessThanOrEqual(5);
  });
});
