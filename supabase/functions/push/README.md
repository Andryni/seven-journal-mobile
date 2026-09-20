# Push sweep (`push`)

Delivers the alerts that must arrive **while the app is closed**. The app's own
notifications are local and need the process alive; these three do not:

| Alert | When it fires | Why it cannot wait |
|---|---|---|
| `connector_silent` | a connector has sent nothing for `PUSH_SILENT_MINUTES` (default 45) — or has never been seen, an hour after it was created | a dead auto-journal silently punches holes in the history. Days later the trades are no longer reconstructible from the terminal |
| `lock` | a session lock fired in the last 24 h | that is the minute the trader must be told: the next trade is the one that hurts |
| `risk` | realised loss today ≥ `PUSH_RISK_PCT` (default 70) of the account's effective daily limit | the point of an early warning is that there is still room to stop |

## The rule is in the database, the delivery is here

`public.push_sweep(...)` (schema.sql, SECTION 8) decides what is due **and
claims it** in the same transaction — `push_alerts` plus a cooldown. So:

- running the sweep every minute still sends one `connector_silent` per
  connector per cooldown window (default 6 h), never a stream of them;
- two sweeps racing cannot double-send;
- the thresholds can be changed with env vars here, but the *rule* cannot be
  bypassed by a client.

This function only reads the due alerts, groups them by user, posts them to
Expo, and disables tokens Expo answers `DeviceNotRegistered` for (disabled, not
deleted: a reinstall hands the same token back and must revive that row).

## Deploy

```bash
npx supabase functions deploy push
npx supabase secrets set PUSH_CRON_SECRET=<a long random string>
# optional
npx supabase secrets set PUSH_SILENT_MINUTES=45 PUSH_RISK_PCT=70 PUSH_COOLDOWN='6 hours'
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform; do
not set them by hand.

## Schedule it

The schema's last block schedules the sweep with `pg_cron` + `pg_net` every 15
minutes, **if** both extensions are present and the URL is configured:

```sql
alter database postgres
  set app.push_url    = 'https://<project-ref>.supabase.co/functions/v1/push';
alter database postgres
  set app.push_secret = '<the same value as PUSH_CRON_SECRET>';
```

Then re-run `supabase/schema.sql` (the settings only apply to new sessions, and
the block is idempotent). It prints a `notice` saying whether the job was
scheduled — and if anything is missing it schedules nothing and keeps working,
because the function can always be driven by hand or by any external scheduler.

## Manual run

```bash
curl -X POST "$SUPABASE_URL/functions/v1/push" \
  -H "x-cron-secret: $PUSH_CRON_SECRET"
# → { "swept": 2, "messages": 3, "sent": 3, "disabled": 0 }
```

`swept` is the number of alerts the database said were due, `messages` the
number of device deliveries that implies (a user with two phones counts twice).
A run that returns `swept: 0` is the normal, healthy answer — the ledger is
what keeps it quiet.

## Client side

The app registers its device token through `register_push_token(token,
platform, locale)` and the token is unregistered on sign-out. The `locale`
column is why the alert text is composed in the database: an OS notification is
rendered without the app running, so it cannot be translated later. Without it
every alert would arrive in French.

The switch lives in Settings → Notifications → **Server alerts** (off by
default: a phone that starts receiving notifications it did not ask for is a
phone that uninstalls the app).
