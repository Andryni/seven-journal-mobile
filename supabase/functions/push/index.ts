/**
 * Push sweep — Supabase Edge Function.
 *
 * The one channel the app could not reach: alerts that must arrive while the
 * app is CLOSED. Everything the app schedules itself (src/features/
 * notifications) needs the process alive, which is precisely the situation the
 * two costly failures never happen in — a terminal that stopped reporting, and
 * a lock that just fired.
 *
 * Division of labour, deliberately:
 *
 *   * the DATABASE decides what is due and CLAIMS it (public.push_sweep, see
 *     schema.sql SECTION 8). The decision needs the trader's data and an
 *     atomic write against the alert ledger; both live there, and putting the
 *     rule in the database means it cannot be bypassed by a client;
 *   * this function only DELIVERS: it reads the due alerts, groups them by
 *     user, posts them to Expo and disables tokens Expo says are dead.
 *
 * It is idempotent by construction, not by convention: push_sweep only returns
 * an alert when its cooldown has elapsed, so running the sweep every minute
 * would still send one "terminal silent" per connector per cooldown window.
 * That is what lets it be scheduled aggressively without being annoying.
 *
 * Auth: a shared secret in `x-cron-secret` (env PUSH_CRON_SECRET), or the
 * service-role key as a bearer token for manual runs from the dashboard. It is
 * not a user-facing endpoint and never will be.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

interface DueAlert {
  user_id: string;
  kind: string;
  subject: string;
  title: string;
  body: string;
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * A ticket error is per-message and does not fail the batch. Only
 * DeviceNotRegistered is actionable: the handset uninstalled the app or
 * revoked the token, so the row is disabled rather than deleted — a reinstall
 * hands the same token back and must revive it.
 */
function deadToken(ticket: ExpoTicket | undefined): boolean {
  return ticket?.details?.error === 'DeviceNotRegistered';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const cronSecret = Deno.env.get('PUSH_CRON_SECRET') ?? '';
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authorised =
    (cronSecret !== '' && req.headers.get('x-cron-secret') === cronSecret) ||
    (serviceKey !== '' && bearer === serviceKey);

  if (!authorised) return json({ error: 'forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceKey,
    { auth: { persistSession: false } },
  );

  // Tunables are env-driven so a deployment can change its mind without a
  // redeploy of the rules themselves (which live in the database).
  const silentMinutes = Number(Deno.env.get('PUSH_SILENT_MINUTES') ?? '45');
  const riskPct = Number(Deno.env.get('PUSH_RISK_PCT') ?? '70');
  const cooldown = Deno.env.get('PUSH_COOLDOWN') ?? '6 hours';

  const { data, error } = await admin.rpc('push_sweep', {
    p_silent_minutes: Number.isFinite(silentMinutes) ? silentMinutes : 45,
    p_risk_pct: Number.isFinite(riskPct) ? riskPct : 70,
    p_cooldown: cooldown,
  });

  if (error) return json({ error: 'sweep_failed', detail: error.message }, 500);

  const alerts = (data ?? []) as DueAlert[];
  if (alerts.length === 0) return json({ swept: 0, sent: 0 });

  // ---- Tokens, once, for every user involved in this sweep. ---------------
  const userIds = [...new Set(alerts.map((a) => a.user_id))];
  const { data: tokenRows } = await admin
    .from('push_tokens')
    .select('id, user_id, token')
    .in('user_id', userIds)
    .is('disabled_at', null);

  const byUser = new Map<string, { id: string; token: string }[]>();
  for (const row of tokenRows ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({ id: row.id, token: row.token });
    byUser.set(row.user_id, list);
  }

  // ---- Build the message list. A user with two devices gets both. --------
  const messages: { to: string; title: string; body: string; data: Record<string, string> }[] = [];
  const tokenIdByToken = new Map<string, string>();

  for (const alert of alerts) {
    for (const t of byUser.get(alert.user_id) ?? []) {
      tokenIdByToken.set(t.token, t.id);
      messages.push({
        to: t.token,
        title: alert.title,
        body: alert.body,
        data: { kind: alert.kind, subject: alert.subject },
      });
    }
  }

  let sent = 0;
  const dead: string[] = [];

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });

      if (!res.ok) continue;

      const payload = (await res.json()) as { data?: ExpoTicket | ExpoTicket[] };
      const tickets = Array.isArray(payload.data)
        ? payload.data
        : payload.data
          ? [payload.data]
          : [];

      tickets.forEach((ticket, index) => {
        if (ticket?.status === 'ok') {
          sent++;
          return;
        }
        const token = batch[index]?.to;
        if (token && deadToken(ticket)) dead.push(token);
      });
    } catch {
      // A network failure is retried by the next sweep: the alert is already
      // claimed, so this delivery is lost by design rather than re-sent
      // forever. Being told an hour later is better than being told twice a
      // minute, and the ledger keeps the cooldown honest in both directions.
      continue;
    }
  }

  if (dead.length > 0) {
    const ids = dead.map((t) => tokenIdByToken.get(t)).filter((x): x is string => !!x);
    if (ids.length > 0) {
      await admin
        .from('push_tokens')
        .update({ disabled_at: new Date().toISOString() })
        .in('id', ids);
    }
  }

  return json({ swept: alerts.length, messages: messages.length, sent, disabled: dead.length });
});
