import {
  isMissingColumnError,
  withoutPostReleaseColumns,
  POST_RELEASE_COLUMNS,
} from '../postReleaseColumns';

describe('isMissingColumnError', () => {
  it('detects the PostgREST schema-cache code', () => {
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
  });

  it('detects the raw Postgres undefined-column code', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
  });

  it('detects the message form', () => {
    expect(
      isMissingColumnError({ message: "Could not find the 'commission' column of 'trades'" })
    ).toBe(true);
    expect(isMissingColumnError({ message: 'column "swap" does not exist' })).toBe(true);
  });

  it('does not swallow unrelated failures', () => {
    // A retry must not mask an RLS denial or a network error: those need to
    // surface, not be silently retried without the cost fields.
    expect(isMissingColumnError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingColumnError({ message: 'network request failed' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe('withoutPostReleaseColumns', () => {
  it('drops only the post-release columns', () => {
    const payload = { pair: 'XAUUSD', pnl: 100, commission: 7, swap: 1.5 };
    expect(withoutPostReleaseColumns(payload)).toEqual({ pair: 'XAUUSD', pnl: 100 });
  });

  it('leaves a payload without those columns untouched', () => {
    const payload = { pair: 'XAUUSD', pnl: 100 };
    expect(withoutPostReleaseColumns(payload)).toEqual(payload);
  });

  it('does not mutate the original payload', () => {
    const payload = { pair: 'XAUUSD', commission: 7 };
    withoutPostReleaseColumns(payload);
    expect(payload.commission).toBe(7);
  });

  it('covers every declared post-release column', () => {
    const payload = Object.fromEntries(POST_RELEASE_COLUMNS.map(c => [c, 1]));
    expect(withoutPostReleaseColumns(payload)).toEqual({});
  });
});
