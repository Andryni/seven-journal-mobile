/**
 * Renaming a connector, decided on the device.
 *
 * The rule itself lives in the database (`rename_sync_ingest_account` raises on
 * an empty label and on a name already taken, case-insensitively), and that
 * function stays the authority. This module exists so the sheet can say WHY the
 * SAVE button is unavailable before the round trip, and so the rule is
 * unit-testable without a component or a server.
 *
 * The normalisation is the same on both sides, deliberately: collapsing runs of
 * whitespace means " MT5   #1 " and "MT5 #1" are one name, not two that later
 * collide in the database.
 */

/** Matches the server's `left(…, 60)` and the table's practical width. */
export const CONNECTOR_LABEL_MAX = 60;

export type ConnectorLabelIssue = 'empty' | 'too_long' | 'duplicate';

/** Trim + collapse inner whitespace. Never truncates: see `connectorLabelIssue`. */
export function normalizeConnectorLabel(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * What is wrong with this label, or null when it can be saved.
 *
 * `taken` is the other connectors' current labels — the caller excludes the
 * connector being renamed, so re-saving an unchanged name is never a
 * "duplicate". Comparison is case-insensitive, matching the server.
 */
export function connectorLabelIssue(raw: string, taken: string[] = []): ConnectorLabelIssue | null {
  const label = normalizeConnectorLabel(raw);
  if (label === '') return 'empty';
  if (label.length > CONNECTOR_LABEL_MAX) return 'too_long';
  if (taken.some(other => normalizeConnectorLabel(other).toLowerCase() === label.toLowerCase())) {
    return 'duplicate';
  }
  return null;
}
