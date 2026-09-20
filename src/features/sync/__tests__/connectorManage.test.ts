import {
  CONNECTOR_LABEL_MAX,
  connectorLabelIssue,
  normalizeConnectorLabel,
} from '../connectorManage';

/**
 * The rename rule, mirrored from the RPC that enforces it.
 *
 * Both sides have to agree, because the point of checking here is that the
 * trader gets the sentence instead of a 23505 from Postgres: an empty name, an
 * over-long one, or a name another connector already has — the last compared
 * case-insensitively, on the normalised form, since " MT5  #1 " and "mt5 #1"
 * are one name on a phone screen and must not become two in the database.
 */

describe('normalizeConnectorLabel', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeConnectorLabel('  MT5   #1 ')).toBe('MT5 #1');
    expect(normalizeConnectorLabel('\tMT5\n#2')).toBe('MT5 #2');
    expect(normalizeConnectorLabel('   ')).toBe('');
  });

  it('never truncates silently', () => {
    const long = 'x'.repeat(CONNECTOR_LABEL_MAX + 5);
    expect(normalizeConnectorLabel(long)).toHaveLength(CONNECTOR_LABEL_MAX + 5);
  });
});

describe('connectorLabelIssue', () => {
  it('refuses an empty name', () => {
    expect(connectorLabelIssue('')).toBe('empty');
    expect(connectorLabelIssue('   ')).toBe('empty');
  });

  it('refuses a name longer than the server would keep', () => {
    expect(connectorLabelIssue('x'.repeat(CONNECTOR_LABEL_MAX))).toBeNull();
    expect(connectorLabelIssue('x'.repeat(CONNECTOR_LABEL_MAX + 1))).toBe('too_long');
  });

  it('refuses a name another connector already has, case-insensitively', () => {
    expect(connectorLabelIssue('MT5 #1', ['MT5 #2'])).toBeNull();
    expect(connectorLabelIssue('mt5  #2', ['MT5 #2'])).toBe('duplicate');
  });

  it('treats the connector itself as available (unchanged name is not a duplicate)', () => {
    // The caller passes only the OTHER labels; an unchanged name must save as a
    // no-op rather than as an error.
    expect(connectorLabelIssue('MT5 #1', [])).toBeNull();
  });
});
