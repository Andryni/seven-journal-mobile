import {
  QUIET_AFTER_MS,
  connectorHealth,
  silenceMs,
  type ConnectorHeartbeat,
} from '../connectorHealth';

/**
 * Health is the difference between "configured" and "working".
 *
 * The card used to read `last_sync_status` alone, so a terminal that died two
 * days ago kept a green dot and the trader read an empty queue as a broken app.
 * These tests pin the precedence between the states, because that precedence is
 * the whole feature: a paused feed must not look like a silent one, and a stale
 * 'error' must not outrank the silence it is a symptom of.
 */

const NOW = Date.parse('2026-09-20T10:00:00.000Z');

const connector = (over: Partial<ConnectorHeartbeat> = {}): ConnectorHeartbeat => ({
  is_active: true,
  last_sync_at: '2026-09-20T09:59:30.000Z',
  last_sync_status: 'ok',
  ...over,
});

const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

describe('connectorHealth', () => {
  it('reports a recent heartbeat as ok', () => {
    expect(connectorHealth(connector(), NOW)).toBe('ok');
  });

  it('reports silence past the threshold, whatever the stored status says', () => {
    // The trap: 'ok' stays stored forever, so silence has to win.
    expect(connectorHealth(connector({ last_sync_at: at(11), last_sync_status: 'ok' }), NOW)).toBe(
      'quiet'
    );
    expect(connectorHealth(connector({ last_sync_at: at(60 * 48), last_sync_status: 'ok' }), NOW)).toBe(
      'quiet'
    );
  });

  it('tolerates a heartbeat inside the threshold', () => {
    expect(connectorHealth(connector({ last_sync_at: at(9) }), NOW)).toBe('ok');
    expect(connectorHealth(connector({ last_sync_at: at(QUIET_AFTER_MS / 60_000) }), NOW)).toBe('ok');
  });

  it('puts a paused feed above every heartbeat state', () => {
    // Deliberate and actionable: the terminal gets a 403, and no amount of
    // recency changes that.
    expect(connectorHealth(connector({ is_active: false }), NOW)).toBe('paused');
    expect(
      connectorHealth(connector({ is_active: false, last_sync_at: at(5000), last_sync_status: 'error' }), NOW)
    ).toBe('paused');
  });

  it('separates never-seen from silent', () => {
    expect(connectorHealth(connector({ last_sync_at: null, last_sync_status: null }), NOW)).toBe(
      'never'
    );
    // A malformed timestamp cannot vouch for a feed: silence, not health.
    expect(connectorHealth(connector({ last_sync_at: 'not-a-date' }), NOW)).toBe('quiet');
  });

  it('keeps error and empty for fresh heartbeats only', () => {
    expect(connectorHealth(connector({ last_sync_status: 'error' }), NOW)).toBe('error');
    expect(connectorHealth(connector({ last_sync_status: 'empty' }), NOW)).toBe('empty');
    // Two days old: the error describes a terminal that is not even talking.
    expect(connectorHealth(connector({ last_sync_status: 'error', last_sync_at: at(60 * 48) }), NOW)).toBe(
      'quiet'
    );
  });
});

describe('silenceMs', () => {
  it('measures the gap, and never a negative one for a clock ahead of us', () => {
    expect(silenceMs(connector({ last_sync_at: at(5) }), NOW)).toBe(5 * 60_000);
    expect(silenceMs(connector({ last_sync_at: at(-5) }), NOW)).toBe(0);
  });

  it('returns null when there is no heartbeat at all', () => {
    expect(silenceMs(connector({ last_sync_at: null }), NOW)).toBeNull();
  });
});
