import type { TFunction } from '../../../i18n';
import { errorText, failureText, knownFailureKey, needsSchema } from '../rpcError';

/**
 * The sync queue's toasts are only as good as this module: the failure it
 * cannot read is the failure the trader cannot act on, and the shape it gets
 * in production is NOT an Error — `supabase.rpc()` resolves a plain
 * `{ message, details, hint, code }` object. Every case below is copied from a
 * real response.
 */

/** Echoes the key, so the assertions read as "which sentence, not which text". */
const t = ((key: string) => `<${key}>`) as unknown as TFunction;

describe('errorText', () => {
  it('reads the message off a PostgREST plain object (the shape the app gets)', () => {
    // supabase.rpc() resolves { data, error }, and error is NOT an Error.
    expect(
      errorText({
        message: 'no target account for staging 8f14e45f-ceea-467a-9d5a-1f0c1b2f3b9c',
        details: null,
        hint: null,
        code: 'P0001',
      }),
    ).toBe('no target account for staging 8f14e45f-ceea-467a-9d5a-1f0c1b2f3b9c');
  });

  it('reads a raised exception verbatim, minus the SQLSTATE prefix', () => {
    expect(errorText({ message: 'P0001: staging row not pending' })).toBe('staging row not pending');
  });

  it('keeps working for a thrown Error and a bare string', () => {
    expect(errorText(new Error('Utilisateur non authentifié'))).toBe('Utilisateur non authentifié');
    expect(errorText('boom')).toBe('boom');
  });

  it('falls back to details when a body came back without a message', () => {
    // A 5xx with an empty body leaves message: '' — details is the only clue.
    expect(errorText({ message: '  ', details: 'connection reset', hint: '' })).toBe(
      'connection reset',
    );
  });

  it('returns an empty string for nothing at all', () => {
    expect(errorText(null)).toBe('');
    expect(errorText(undefined)).toBe('');
    expect(errorText({ message: '' })).toBe('');
  });
});

describe('needsSchema', () => {
  it('recognises the constraint and missing-object families', () => {
    expect(
      needsSchema('new row for relation "trades" violates check constraint "trades_result_check"'),
    ).toBe(true);
    expect(needsSchema('column trades.sync_source_id does not exist')).toBe(true);
    expect(needsSchema('Could not find the function public.promote_sync_trades')).toBe(true);
  });

  it('leaves an application-level failure alone', () => {
    expect(needsSchema('staging row not pending')).toBe(false);
  });
});

describe('knownFailureKey', () => {
  it('maps each server failure to its one next step', () => {
    expect(knownFailureKey('no target account for staging abc')).toBe('syncErrNoRouting');
    expect(knownFailureKey('bad target account for staging abc')).toBe('syncErrBadAccount');
    expect(knownFailureKey('staging row not pending')).toBe('syncErrNotPending');
    expect(knownFailureKey('unauthenticated')).toBe('syncErrAuth');
    expect(knownFailureKey('TypeError: Network request failed')).toBe('syncErrNetwork');
  });

  it('returns null for a text it has no advice for', () => {
    expect(knownFailureKey('new row for relation "trades" violates check constraint "x"')).toBeNull();
  });
});

describe('failureText', () => {
  it('translates a recognised failure instead of showing raw server words', () => {
    expect(failureText({ message: 'no target account for staging abc' }, t, '<fallback>')).toBe(
      '<syncErrNoRouting>',
    );
  });

  it('appends the schema hint to a check-constraint failure', () => {
    // This is the 'CLOSED' constraint case: the message is precise but means
    // nothing without the one action that fixes it.
    const text = failureText(
      { message: 'new row for relation "trades" violates check constraint "trades_result_check"' },
      t,
      '<fallback>',
    );
    expect(text).toContain('violates check constraint');
    expect(text).toContain('<syncSchemaHint>');
  });

  it('passes an unknown message through and uses the fallback for silence', () => {
    expect(failureText({ message: 'something odd' }, t, '<fallback>')).toBe('something odd');
    expect(failureText({ message: '' }, t, '<fallback>')).toBe('<fallback>');
    expect(failureText(undefined, t, '<fallback>')).toBe('<fallback>');
  });
});
