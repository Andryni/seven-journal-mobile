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
  /** Volume-weighted exit price of a closed position; feeds the R-multiple. */
  exit_price?: number | null;
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
  return s.toUpperCase().replace(/\.(M|PRO|RAW|C|A|CASH|STD)$/i, '');
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
    exit_price: num(e.exit_price),
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

/**
 * Candles for one position, as the terminal produced them.
 *
 * Validated like every other bridge payload: unparseable bars are dropped one
 * by one rather than failing the batch, the series is SORTED by time (a chart
 * drawn in arrival order is a chart of nothing), and the count is capped — a
 * terminal left attached for a month on one position must not be able to post
 * an unbounded array into the database.
 */
const MAX_BARS = 2000;

interface CandleEvent {
  external_id: string;
  timeframe: 'M1' | 'M5' | 'M15';
  bars: { t: string; o: number; h: number; l: number; c: number }[];
  truncated: boolean;
}

function parseCandles(raw: unknown): CandleEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;

  const external_id = str(e.external_id, 64);
  if (!external_id) return null;

  const tf = str(e.timeframe, 4);
  const timeframe: CandleEvent['timeframe'] = tf === 'M5' ? 'M5' : tf === 'M15' ? 'M15' : 'M1';

  const rows = Array.isArray(e.bars) ? (e.bars as Record<string, unknown>[]) : [];
  const bars = rows
    .map((b) => {
      const ms = Date.parse(String(b?.t ?? ''));
      const o = num(b?.o);
      const h = num(b?.h);
      const l = num(b?.l);
      const c = num(b?.c);
      if (isNaN(ms) || o === null || h === null || l === null || c === null) return null;
      return { t: new Date(ms).toISOString(), o, h, l, c };
    })
    .filter((b): b is { t: string; o: number; h: number; l: number; c: number } => b !== null)
    .sort((a, b) => a.t.localeCompare(b.t))
    .slice(0, MAX_BARS);

  if (bars.length === 0) return null;

  return {
    external_id,
    timeframe,
    bars,
    truncated: e.truncated === true || rows.length > MAX_BARS,
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

    /**
     * Broker-reported state, v1.14. Absent from older EAs, so each field is
     * only written when present -- overwriting a known balance with null on
     * an upgrade-lagging terminal would erase the reconciliation silently.
     */
    const beat: Record<string, unknown> = {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'ok',
      last_error: null,
    };
    const balance = num(body.balance);
    const equity = num(body.equity);
    const currency = str(body.currency, 8);
    if (balance !== null) {
      beat.broker_balance = balance;
      beat.broker_state_at = new Date().toISOString();
    }
    if (equity !== null) beat.broker_equity = equity;
    if (currency) beat.broker_currency = currency.toUpperCase();
    /**
     * Which EA build is attached (v1.16+). Written only when present, like the
     * balance: a terminal that has not been updated keeps whatever it reported
     * before rather than being silently reset to "unknown". The app reads NULL
     * here as "older than the field", which is what licenses the upgrade
     * warning instead of a promise the terminal cannot honour.
     */
    const eaVersion = str(body.ea_version, 16);
    if (eaVersion) beat.ea_version = eaVersion;
    /**
     * WHO is connected (v1.18+): the broker account number and server name,
     * reported by the terminal itself. Written only when present, like the
     * version — a terminal that has not been recompiled keeps whatever it last
     * reported, and the app keeps reading null as "not reported by this build".
     * The login is the one identity that cannot drift: the trader's label can.
     */
    const login = str(body.login, 32);
    if (login) beat.broker_login = login;
    const server = str(body.server, 120);
    if (server) beat.broker_server = server;

    await admin.from('sync_ingest_accounts').update(beat).eq('id', ingestId);

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

    // ---- Request handout (chat -> EA round trip, schema.sql SECTION 5). ---
    // The bridge polls nothing extra: pending back-fill requests ride along
    // in the heartbeat response. Served is set BEFORE the terminal has
    // rebuilt anything — at-most-once delivery, on purpose. A rebuild that
    // fails (terminal offline mid-request) leaves the gaps in place and a
    // NEW request can be queued, because the dedupe only guards rows still
    // pending. An old EA simply ignores the field it never read.
    /**
     * `select('*')`, not a column list: `kind` and `timeframe` only exist once
     * schema.sql SECTION 9 has been run, and naming a column a database does
     * not have makes PostgREST fail the WHOLE query. A database one migration
     * behind would then stop serving back-fill requests as well — a new
     * feature silently breaking an old one. Unknown extra columns are ignored.
     */
    const { data: pendingReqs } = await admin
      .from('sync_requests')
      .select('*')
      .eq('ingest_account_id', ingestId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    const requests: { id: string; external_ids: string[] }[] = [];
    const candleRequests: { id: string; external_ids: string[]; timeframe: string }[] = [];

    if (pendingReqs && pendingReqs.length > 0) {
      // Served BEFORE the terminal has answered: at-most-once delivery, on
      // purpose (an offline terminal mid-request must be re-askable, and the
      // dedupe only guards requests still pending).
      await admin
        .from('sync_requests')
        .update({ status: 'served', served_at: new Date().toISOString() })
        .in('id', pendingReqs.map((r) => r.id));

      for (const r of pendingReqs as Record<string, unknown>[]) {
        const ids = Array.isArray(r.external_ids) ? (r.external_ids as string[]) : [];
        if (ids.length === 0) continue;

        if (r.kind === 'candles') {
          candleRequests.push({
            id: String(r.id),
            external_ids: ids,
            timeframe: str(r.timeframe, 8) ?? 'M1',
          });
        } else {
          requests.push({ id: String(r.id), external_ids: ids });
        }
      }
    }

    const handout: Record<string, unknown> = { ok: true };
    if (requests.length > 0) handout.requests = requests;
    // A separate key rather than a flag on each request: the EA's parser is a
    // bracket scan (MQL5 has no JSON library), and keeping the two kinds in
    // their own arrays is what lets it read them without a real parser.
    if (candleRequests.length > 0) handout.candle_requests = candleRequests;
    return json(handout);
  }

  // ---- Candles: the trade replay payload (schema.sql SECTION 9). ----------
  // Answers ONE question the app asked about ONE position. Deliberately NOT
  // archived into sync_raw_events: a 1500-bar array would bury the event log
  // under megabytes of OHLC that is already stored once, in trade_candles.
  if (type === 'candles') {
    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length === 0 || events.length > 50) {
      await admin
        .from('sync_ingest_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'error',
          last_error: 'bad_candles_count',
        })
        .eq('id', ingestId);
      return json({ error: 'bad_candles_count' }, 422);
    }

    let stored = 0;
    let rejected = 0;

    for (const raw of events) {
      const ev = parseCandles(raw);
      if (!ev) {
        rejected++;
        continue;
      }

      const { error } = await admin.rpc('store_trade_candles', {
        p_user_id: userId,
        p_ingest_id: ingestId,
        p_external_id: ev.external_id,
        p_timeframe: ev.timeframe,
        p_bars: ev.bars,
        p_truncated: ev.truncated,
      });
      if (error) rejected++;
      else stored++;
    }

    await admin
      .from('sync_ingest_accounts')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: stored > 0 ? 'ok' : 'error',
        last_error: stored > 0 ? null : 'candles_rejected',
      })
      .eq('id', ingestId);

    return json({ ok: true, stored, rejected });
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

    /**
     * Is this event actually a CLOSE?
     *
     * Not every `is_open: false` is one. A back-fill request (the chat's
     * "ask the terminal for the missing levels") rebuilds a position from its
     * own history — and a position that is STILL OPEN has no exit deal to
     * read: no exit price, no close time, and a P&L made of entry commissions
     * alone. The EA sends that rebuild on the normal channel, so the shape of
     * the payload is the only thing telling the two apart.
     *
     * Taking such a payload as a close used to date the journal trade 1970,
     * write a phantom P&L, and mark the staging row closed — after which the
     * REAL close event could no longer complete the trade at all, because
     * completing it is guarded on the row having been open. A live position's
     * rebuild therefore updates the payload and nothing else.
     *
     * A close also has to be DATED: the EA stamps the epoch on such a rebuild
     * (no OUT deal means no close time to report), and an event dated before
     * the entry is not a close of that entry. A bridge that reports a close
     * without an exit price, but with a real close time and a P&L, is still
     * accepted — refusing it would leave the journal trade open forever.
     */
    const closeMs = ev.close_time != null ? Date.parse(ev.close_time) : NaN;
    const datedAfterEntry = !Number.isNaN(closeMs) && closeMs > Date.parse(ev.entry_time);
    const isRealClose =
      !ev.is_open &&
      (ev.exit_price != null || (ev.close_time != null && datedAfterEntry && ev.pnl != null));

    const closingAnOpenRow = existing.is_open === true && isRealClose;

    // A bridge re-sending history (re-attach, deep import) must never re-queue
    // a resolved row: the journal already holds a promoted/linked trade, and
    // a second promotion would duplicate it. Payload still refreshes so a
    // later close event completes the journal row via apply_broker_close.
    // Only pending/stale rows reopen; dismissed was already left standing.
    const resolved = existing.status !== 'pending' && existing.status !== 'stale';

    await admin
      .from('sync_trades')
      .update({
        payload,
        // A rebuild of a live position says `is_open: false` without being a
        // close: the row keeps the state it had, so the real close still finds
        // an open row to complete (see isRealClose above).
        is_open: ev.is_open || (existing.is_open === true && !isRealClose),
        open_time: ev.entry_time,
        // Neutralised the same way: the epoch is not a close time, and storing
        // it would put "1 January 1970" on the queue card of a live position.
        close_time: isRealClose ? ev.close_time : null,
        ...(resolved ? {} : { status: 'pending', resolved_by: null }),
      })
      .eq('id', existing.id);
    updated++;

    // The position was promoted while OPEN and has now closed: complete the
    // journal trade instead of leaving a half-written one.
    //
    // The guard is the RESOLUTION, never the status: promoting an open position
    // deliberately leaves its row `pending` (see promote_sync_trades) so this
    // close event still finds it. `status === 'promoted'` is therefore never
    // true here, and guarding on it silently skipped apply_broker_close — every
    // open-position promotion stayed forever without an exit price, a P&L or an
    // R multiple.
    if (closingAnOpenRow && existing.resolution === 'created' && existing.resolved_trade_id) {
      const { error } = await admin.rpc('apply_broker_close', { p_staging_id: existing.id });
      if (!error) closedCompleted++;
    }

    // A rebuilt event for an already-journaled position back-fills ONLY the
    // empty fields (apply_broker_refresh re-checks ownership against this
    // connector). This is the answer side of the chat's request path — and
    // it also means re-sending history with a NEWER EA (one that carries
    // stop/take-profit) silently repairs older promotions that lack them.
    //
    // `journaled`, not `resolved`: a position promoted while OPEN keeps its
    // row `pending` on purpose (the close event still has to complete it), so
    // guarding on the STATUS skipped every one of those rows — the levels the
    // coach had just promised the terminal would resend never landed for the
    // open trades that needed them most. The resolution is what says "this
    // row already produced a journal trade".
    const journaled = existing.resolution === 'created' || existing.resolution === 'linked';
    if (
      journaled &&
      existing.resolved_trade_id &&
      (ev.stop_loss != null || ev.take_profit != null || ev.mae_price != null || ev.mfe_price != null)
    ) {
      await admin.rpc('apply_broker_refresh', {
        p_user_id: userId,
        p_ingest_id: ingestId,
        p_trade_id: existing.resolved_trade_id,
        p_stop_loss: ev.stop_loss,
        p_take_profit: ev.take_profit,
        p_mae: ev.mae_price,
        p_mfe: ev.mfe_price,
      });
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

  // Retention is handled by pg_cron nightly (scheduled in supabase/schema.sql,
  // SECTION 4) — nothing to sweep here on the hot path.
  return json({ inserted, updated, rejected, closedCompleted });
});
