import {
  EA_MIN_ANSWER,
  EA_MIN_LIVE_ANSWER,
  eaSupport,
  eaVersionLabel,
  parseEaVersion,
} from '../eaVersion';

/**
 * A request the terminal cannot honour is the worst kind of silence: the app
 * has already told the trader it was sent. These tests pin the two thresholds
 * (v1.15 answers at all, v1.16 answers for a position still open) and the
 * absence rule — no version field means an EA older than the field.
 */

const beat = (ea_version: string | null, last_sync_at: string | null = '2026-09-20T10:00:00.000Z') => ({
  ea_version,
  last_sync_at,
});

describe('parseEaVersion', () => {
  it('reads the usual shapes', () => {
    expect(parseEaVersion('1.16')).toEqual({ major: 1, minor: 16 });
    expect(parseEaVersion('v1.15')).toEqual({ major: 1, minor: 15 });
    expect(parseEaVersion('1.16.2 build 3')).toEqual({ major: 1, minor: 16 });
  });

  it('refuses anything it cannot read', () => {
    expect(parseEaVersion(null)).toBeNull();
    expect(parseEaVersion('')).toBeNull();
    expect(parseEaVersion('latest')).toBeNull();
  });
});

describe('eaSupport', () => {
  it('says nothing before the first heartbeat', () => {
    expect(eaSupport(beat(null, null))).toBe('never');
  });

  it('says nothing when the schema does not have the column yet', () => {
    // The app fell back to an older column set: nothing was queried, so an
    // absent version must not be read as an outdated EA.
    expect(eaSupport({ ...beat(null), schema_partial: true })).toBe('never');
    expect(eaSupport({ ...beat('1.14'), schema_partial: true })).toBe('never');
  });

  it('treats a missing version as an EA older than the field', () => {
    expect(eaSupport(beat(null))).toBe('unreported');
  });

  it('compares numerically, not as text', () => {
    // The trap: "1.9" > "1.15" lexically, and 1.9 predates the answer path.
    expect(eaSupport(beat('1.9'))).toBe('legacy');
    expect(eaSupport(beat('1.14'))).toBe('legacy');
    expect(eaSupport(beat('1.15'))).toBe('partial');
  });

  it('marks v1.16 and above as able to answer for live positions too', () => {
    expect(eaSupport(beat('1.16'))).toBe('current');
    expect(eaSupport(beat('1.16.4'))).toBe('current');
    expect(eaSupport(beat('2.0'))).toBe('current');
  });

  it('keeps the two thresholds in the documented order', () => {
    expect(EA_MIN_LIVE_ANSWER.minor).toBeGreaterThan(EA_MIN_ANSWER.minor);
  });
});

describe('eaVersionLabel', () => {
  it('renders the version the way the card shows it', () => {
    expect(eaVersionLabel('1.16')).toBe('v1.16');
    expect(eaVersionLabel('v1.15.0')).toBe('v1.15');
    expect(eaVersionLabel(null)).toBeNull();
  });
});
