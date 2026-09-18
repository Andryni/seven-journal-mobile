/**
 * Auto-journal sync ingest — Supabase Edge Function.
 *
 * The single write-only webhook every bridge posts to: the MQL5 EA, the CSV
 * importer and (later) the cTrader OAuth bridge. Design notes live in
 * docs/auto-journal-sync.md; the schema in supabase/schema.sql (SECTION 4).
 *
 * Security model, in one paragraph: the caller holds a per-connector secret
 * stored on sync_ingest_accounts. That lookup — never the payload — decides
 * which user_id the events belong to, so a forged body can only ever land in
 * the secret owner's queue. The webhook can write staging rows and nothing
 * else: no reads are exposed, and `trades` is only touched through the
 * human-action RPCs (promote/link/dismiss), which revalidate ownership.
 *
 * Pipeline per request:
 *   1. Bearer secret -> sync_ingest_accounts (must exist, must be active).
 *   2. Store the raw payload BEFORE any validation — a parser bug is then
 *      replayable and a dispute has its evidence.
 *   3. Dispatch on `type`: "trades" upserts the queue (structural dedupe on
 *      (ingest_account_id, external_id)), "heartbeat" only touches sync
 *      bookkeeping and retires vanished open positions as `stale`.
 *   4. A close event for an already-promoted OPEN position completes the
 *      journal trade via apply_broker_close.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// Event contract (see docs/auto-journal-sync.md §payload). The bridge sends
// ONE event per broker position: entry deals aggregated (size, weighted price,
// earliest time), exits listed individually, pnl NET of commission and swap.
// ---------------------------------------------------------------------------

interface IngestEvent {
  external_id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  size: number;
  entry_price: number;
  entry_time: string; // ISO-8601 UTC
  is_open: boolean;
  close_time?: string | null;
  pnl?: number | null;
  commission?: number | null;
  swap?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  close_reason?: 'TP' | 'SL' | 'BE' | 'CLOSED';
  mae_price?: number | null;
  mfe_price?: number | null;
  exits?: { size: number; price: number; exit_time: string; pnl?: number | null }[];
}

const num = (x: unknown): number | null =>
  typeof x === 'number' && isFinite(x) ? x : null;

const str = (x: unknown, max: number): string | null =>
  typeof x === 'string' && x.trim() !== '' ? x.trim().slice(0, max) : null;

/**
 * Brokers suffix symbols (EURUSD.m, EURUSD.pro, GOLD-c...). The journal stores
 * canonical pairs, so strip the usual suffix shapes. Keep it conservative:
 * an unknown suffix survives here and normalize_pair() on the SQL side is the
 * second chance at match time.
 */
function canonicalSymbol(raw: unknown): string | null {
  const s = str(raw, 24);
  if (!s) return null;
  return s.toUpperCase().replace(/\.(M|PRO|RAW|C|A|CASH)$/i, '');
}

const CLOSE_REASONS = ['TP', 'SL', 'BE', 'CLOSED'];

function parseEvent(raw: unknown): IngestEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;

  const external_id = str(e.external_id, 64);
  const symbol = canonicalSymbol(e.symbol);
  const direction = e.direction === 'SELL' ? 'SELL' : e.direction === 'BUY' ? 'BUY' : null;
  const entry_price = num(e.entry_price);
  const entryMs = Date.parse(String(e.entry_time ?? ''));
  if (!external_id || !symbol || !direction || entry_price === null || isNaN(entryMs)) {
    return null;
  }

  const size = num(e.size);
  if (size === null || size <= 0) return null;

  const is_open = e.is_open === true;
  const closeMs = e.close_time != null ? Date.parse(String(e.close_time)) : NaN;

  let close_reason: IngestEvent['close_reason'] = null;
  if (!is_open) {
    close_reason = CLOSE_REASONS.includes(String(e.close_reason))
      ? (String(e.close_reason) as IngestEvent['close_reason'])
      : 'CLOSED';
  }

  // Exits are optional detail; a malformed list is dropped, not fatal — the
  // position-level numbers (pnl, exit price) are authoritative without it.
  const exits = Array.isArray(e.exits)
    ? (e.exits as Record<string, unknown>[])
        .map((x) => ({
          size: num(x.size),
          price: num(x.price),
          exit_time: (() => {
            const ms = Date.parse(String(x.exit_time ?? ''));
            return isNaN(ms) ? null : new Date(ms).toISOString();
          })(),
          pnl: num(x.pnl),
        }))
        .filter((x) => x.size !== null && x.price !== null)
        .slice(0, 20)
    : [];

  return {
    external_id,
    symbol,
    direction,
    size,
    entry_price,
    entry_time: new Date(entryMs).toISOString(),
    is_open,
    close_time: isNaN(closeMs) ? null : new Date(closeMs).toISOString(),
    pnl: num(e.pnl),
    commission: num(e.commission) ?? 0,
    swap: num(e.swap) ?? 0,
    stop_loss: num(e.stop_loss),
    take_profit: num(e.take_profit),
    close_reason,
    mae_price: num(e.mae_price),
    mfe_price: num(e.mfe_price),
    exits,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ---- 1. Identity: the secret IS the connector. --------------------------
  const auth = req.headers.get('authorization') ?? '';
  const secret = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!secret) return json({ error: 'missing_secret' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: ingest, error: ingestErr } = await admin
    .from('sync_ingest_accounts')
    .select('id, user_id, is_active')
    .eq('secret', secret)
    .maybeSingle();

  if (ingestErr || !ingest) return json({ error: 'unknown_secret' }, 401);
  if (!ingest.is_active) return json({ error: 'connector_disabled' }, 403);

  const ingestId: string = ingest.id;
  const userId: string = ingest.user_id;

  // ---- 2. Body. A body that fails JSON.parse is still archived. -----------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    await admin.from('sync_raw_events').insert({
      ingest_account_id: ingestId,
      payload: { parse_error: 'invalid_json' },
      source_ip: req.headers.get('x-forwarded-for') ?? null,
    });
    return json({ error: 'invalid_json' }, 422);
  }

  const sourceIp = req.headers.get('x-forwarded-for') ?? null;
  const type = str(body.type, 20) ?? 'trades';

  // ---- Heartbeat: bookkeeping only. No raw event (1440/day otherwise), no
  // staging writes. Open positions absent from the heartbeat for long enough
  // are retired as `stale` — recoverable, see the schema comments.
  if (type === 'heartbeat') {
    const openIds = Array.isArray(body.open_ids)
      ? (body.open_ids as unknown[]).map((x) => str(x, 64)).filter((x): x is string => !!x)
      : [];

    await admin
      .from('sync_ingest_accounts')
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'ok', last_error: null })
      .eq('id', ingestId);

    if (openIds.length > 0) {
      await admin
        .from('sync_trades')
        .update({ status: 'stale', resolved_by: 'system' })
        .eq('ingest_account_id', ingestId)
        .eq('status', 'pending')
        .eq('is_open', true)
        .not('external_id', 'in', `(${openIds.join(',')})`);
    } else {
      await admin
        .from('sync_trades')
        .update({ status: 'stale', resolved_by: 'system' })
        .eq('ingest_account_id', ingestId)
        .eq('status', 'pending')
        .eq('is_open', true);
    }
    return json({ ok: true });
  }

  if (type !== 'trades' && type !== 'batch') {
    return json({ error: 'unknown_type' }, 422);
  }

  // ---- 3. Archive verbatim, then validate. --------------------------------
  const { data: rawEvent } = await admin
    .from('sync_raw_events')
    .insert({ ingest_account_id: ingestId, payload: body, source_ip: sourceIp })
    .select('id')
    .maybeSingle();

  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0 || events.length > 500) {
    await admin
      .from('sync_ingest_accounts')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: events.length === 0 ? 'empty' : 'error',
        last_error: events.length === 0 ? null : 'batch_too_large',
      })
      .eq('id', ingestId);
    return json({ error: 'bad_events_count' }, 422);
  }

  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  let closedCompleted = 0;

  for (const raw of events) {
    const ev = parseEvent(raw);
    if (!ev) {
      rejected++;
      continue;
    }

    const payload: Record<string, unknown> = { ...ev };
    delete (payload as { raw_event_id?: string }).raw_event_id;
    if (rawEvent) payload.raw_event_id = rawEvent.id;

    const { data: existing } = await admin
      .from('sync_trades')
      .select('id, status, is_open, resolution, resolved_trade_id')
      .eq('ingest_account_id', ingestId)
      .eq('external_id', ev.external_id)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin.from('sync_trades').insert({
        user_id: userId,
        ingest_account_id: ingestId,
        external_id: ev.external_id,
        payload,
        is_open: ev.is_open,
        open_time: ev.entry_time,
        close_time: ev.close_time,
      });
      if (!error) inserted++;
      continue;
    }

    // dismissed is a human decision: it stands. stale recovers on sight.
    if (existing.status === 'dismissed') {
      updated++; // counted, untouched
      continue;
    }

    const closingAnOpenRow = existing.is_open === true && !ev.is_open;

    await admin
      .from('sync_trades')
      .update({
        payload,
        is_open: ev.is_open,
        open_time: ev.entry_time,
        close_time: ev.close_time,
        status: 'pending',
        resolved_by: null,
      })
      .eq('id', existing.id);
    updated++;

    // The position was already promoted while OPEN and has now closed:
    // complete the journal trade instead of leaving a half-written one.
    if (closingAnOpenRow && existing.status === 'promoted' && existing.resolved_trade_id) {
      const { error } = await admin.rpc('apply_broker_close', { p_staging_id: existing.id });
      if (!error) closedCompleted++;
    }
  }

  // Bookkeeping for the connectors card.
  await admin
    .from('sync_ingest_accounts')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: rejected === events.length ? 'error' : 'ok',
      last_error: rejected > 0 ? `${rejected} event(s) rejected` : null,
    })
    .eq('id', ingestId);

  // Opportunistic retention sweep — pg_cron nightly is the proper schedule,
  // this keeps a database without cron honest anyway. 5% of requests.
  if (Math.random() < 0.05) {
    await admin.rpc('purge_old_sync_events');
  }

  return json({ inserted, updated, rejected, closedCompleted });
});
