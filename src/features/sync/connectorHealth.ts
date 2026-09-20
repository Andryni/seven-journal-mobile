/**
 * Whether a connector is actually working, as opposed to merely configured.
 *
 * The connectors card used to read `last_sync_status` and nothing else, which
 * makes three different situations look identical:
 *
 *   1. "Connecté" three days ago — the EA's PC was rebooted, the VPS was
 *      suspended, the terminal was closed. The status is still 'ok', so the
 *      row keeps claiming a healthy feed while nothing arrives. The trader
 *      sees an empty queue and concludes the app is broken.
 *   2. A connector that is paused: still green, but the ingest function
 *      answers 403 to everything the terminal sends.
 *   3. A first-time connector that never beat once.
 *
 * The heartbeat is the signal that separates them, and its cadence is known
 * (InpBeatSeconds, 60 s by default). Silence longer than a few intervals is a
 * fault, not lag — and it is the ONE thing the trader can fix on their side.
 *
 * Pure and dependency-free (structural input, so no import of the hook), so
 * the precedence between the states stays unit-testable.
 */

/** Only the heartbeat facts: any ingest row is structurally assignable. */
export interface ConnectorHeartbeat {
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: 'ok' | 'error' | 'empty' | null;
}

export type ConnectorHealth = 'paused' | 'never' | 'quiet' | 'error' | 'empty' | 'ok';

/**
 * Silence that means something.
 *
 * Ten minutes is ten missed heartbeats: long enough that a slow HTTP round
 * trip, a terminal mid-restart or a momentary outage does not raise an alarm,
 * short enough that the trader still remembers what they were doing.
 */
export const QUIET_AFTER_MS = 10 * 60 * 1000;

/**
 * Health of one connector, most actionable state first.
 *
 * Order matters: a paused feed is a deliberate choice and outranks any stale
 * status; a silent feed outranks a stale 'error' (an error from two days ago
 * describes a terminal that is no longer even talking to us).
 */
export function connectorHealth(
  connector: ConnectorHeartbeat,
  nowMs: number = Date.now()
): ConnectorHealth {
  if (!connector.is_active) return 'paused';

  const age = silenceMs(connector, nowMs);
  if (age === null) return 'never';
  if (age > QUIET_AFTER_MS) return 'quiet';

  if (connector.last_sync_status === 'error') return 'error';
  if (connector.last_sync_status === 'empty') return 'empty';
  return 'ok';
}

/**
 * How long the connector has been silent, in ms, or null when it never beat.
 *
 * An unparseable timestamp is treated as silence rather than as "now": a
 * malformed value cannot vouch for a feed.
 */
export function silenceMs(
  connector: ConnectorHeartbeat,
  nowMs: number = Date.now()
): number | null {
  const raw = connector.last_sync_at;
  if (!raw) return null;
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - at);
}
