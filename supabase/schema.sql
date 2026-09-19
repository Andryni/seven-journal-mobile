-- ============================================================================
-- Seven Journal — complete database schema.
--
-- SINGLE SOURCE OF TRUTH. This one file creates a working database from a
-- clean Supabase project, and is safe to re-run against an existing one:
-- every statement is idempotent (create if not exists / create or replace /
-- drop-then-create for policies, constraints and triggers).
--
-- It supersedes the previous schema.sql + migrations/ directory, whose
-- incremental ALTERs had to be replayed in filename order and had already
-- drifted from the application code twice.
--
-- HOW TO APPLY
--   Supabase Dashboard → SQL Editor → paste this file → Run.
--
-- MAINTENANCE RULE
--   Column names here are verified against the hooks that read them. Before
--   editing a table, open the consuming hook (src/features/**/useX.ts) and
--   copy the names from the query. Plausible-sounding guesses have been wrong
--   every single time: this file once declared playbook_setups/daily_debriefs
--   and checklist_items(label, is_checked, position) when the app was really
--   reading user_checklists(text, is_done, sort_order).
-- ============================================================================

create extension if not exists "pgcrypto";

-- Remove the legacy BEFORE-write guard from earlier deployments.
--
-- It raised P0001 on ANY write to trades while the day was locked, which is
-- the wrong enforcement point for two reasons: it made routine maintenance
-- (backfills, corrections, imports of *past* trades) impossible, and it meant
-- a trader could not even fix a typo on yesterday's journal entry after a
-- locked day. The lock exists to stop new risk being taken, not to freeze the
-- record of what already happened.
--
-- The app enforces the lock where the decision is actually made: the pre-trade
-- guard blocks the entry before it is placed, and trg_trades_enforce_lock
-- re-evaluates the rules after every write. Dropping this is a deliberate
-- narrowing of enforcement, not a loss of it.
-- CASCADE also drops any trigger still bound to it, so this single statement
-- is the whole cleanup. It is a no-op on a database that never had it.
drop function if exists public.enforce_daily_loss_limit_before_write() cascade;

-- ============================================================================
-- SECTION 1 — TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- trading_accounts
-- Consumer: src/features/accounts/useAccounts.ts
-- ---------------------------------------------------------------------------
create table if not exists public.trading_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  name                     text not null,
  type                     text not null default 'personal'
                             check (type in ('challenge','funded','personal','demo')),
  balance                  numeric not null default 0,
  initial_balance          numeric not null default 0,
  currency                 text not null default 'USD',
  is_active                boolean not null default true,
  max_daily_loss_limit     numeric,
  max_drawdown_limit       numeric,
  drawdown_type            text check (drawdown_type in ('static','trailing')),
  profit_target            numeric,
  consistency_rule_percent numeric,
  -- Market traded. Drives the position-sizing unit in the app:
  -- CFD -> lots, Futures -> whole contracts, Crypto -> fractional units.
  instrument_type          text not null default 'CFD',
  -- IANA timezone of the trader for this account, e.g. 'Indian/Antananarivo'.
  -- The daily-loss lock groups trades into trading days; doing that in UTC
  -- while the client groups them locally puts the lock on the wrong date.
  timezone                 text not null default 'UTC',
  challenge_end_date       date,
  -- Personal discipline rules. Prop-firm accounts get their limits imposed by
  -- the firm; every other account had nothing, so the Lock Guard -- the app's
  -- best idea -- only ever protected challenge traders. These apply to any
  -- account type, and NULL means "rule not set" rather than a limit of zero.
  max_trades_per_day       int check (max_trades_per_day is null or max_trades_per_day > 0),
  max_risk_per_trade_pct   numeric check (max_risk_per_trade_pct is null or max_risk_per_trade_pct > 0),
  max_consecutive_losses   int check (max_consecutive_losses is null or max_consecutive_losses > 0),
  -- How the account is fed. 'manual' = trades entered by hand (default, and
  -- every account that existed before the column). 'auto' = fed by a sync
  -- connector: the app then treats balance as derived (initial + net pnl) and
  -- the AI coach can lean on the broker-side figures. Intent, not state:
  -- the "synchronised" badge stays the live signal of an actual link.
  feed_mode                text not null default 'manual'
                             check (feed_mode in ('manual','auto')),
  created_at               timestamptz not null default now()
);

-- Columns added after the first release: bring older databases up to date.
alter table public.trading_accounts
  add column if not exists max_drawdown_limit       numeric,
  add column if not exists drawdown_type            text,
  add column if not exists profit_target            numeric,
  add column if not exists consistency_rule_percent numeric,
  add column if not exists instrument_type          text,
  add column if not exists timezone                 text,
  add column if not exists challenge_end_date       date,
  add column if not exists max_trades_per_day       int,
  add column if not exists max_risk_per_trade_pct   numeric,
  add column if not exists max_consecutive_losses   int,
  add column if not exists feed_mode                text;

-- Backfill before tightening, or the NOT NULL below fails on existing rows.
update public.trading_accounts
   set instrument_type = 'CFD'
 where instrument_type is null
    or instrument_type not in ('CFD','Futures','Crypto');

update public.trading_accounts
   set feed_mode = 'manual'
 where feed_mode is null
    or feed_mode not in ('manual','auto');

alter table public.trading_accounts
  alter column feed_mode set default 'manual',
  alter column feed_mode set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trading_accounts_feed_mode_check'
  ) then
    alter table public.trading_accounts
      add constraint trading_accounts_feed_mode_check check (feed_mode in ('manual','auto'));
  end if;
end $$;

update public.trading_accounts
   set timezone = 'UTC'
 where timezone is null or timezone = '';

alter table public.trading_accounts
  alter column instrument_type set default 'CFD',
  alter column instrument_type set not null,
  alter column timezone        set default 'UTC',
  alter column timezone        set not null;

alter table public.trading_accounts
  drop constraint if exists trading_accounts_instrument_type_check;
alter table public.trading_accounts
  add constraint trading_accounts_instrument_type_check
  check (instrument_type in ('CFD','Futures','Crypto'));

alter table public.trading_accounts
  drop constraint if exists trading_accounts_drawdown_type_check;
alter table public.trading_accounts
  add constraint trading_accounts_drawdown_type_check
  check (drawdown_type is null or drawdown_type in ('static','trailing'));

comment on column public.trading_accounts.instrument_type is
  'CFD (lots) | Futures (whole contracts) | Crypto (fractional units). Drives position sizing.';
comment on column public.trading_accounts.timezone is
  'IANA timezone used to bucket trades into trading days for the daily-loss lock.';

create index if not exists trading_accounts_user_idx
  on public.trading_accounts (user_id);

-- ---------------------------------------------------------------------------
-- trades
-- Consumer: src/features/trades/useTrades.ts
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  account_id                uuid not null references public.trading_accounts(id) on delete cascade,
  pair                      text not null,
  direction                 text not null check (direction in ('BUY','SELL')),
  entry_price               numeric not null,
  exit_price                numeric,
  stop_loss                 numeric not null default 0,
  take_profit               numeric not null default 0,
  -- Quantity in the unit implied by the account's instrument_type.
  size                      numeric not null default 0,
  entry_time                timestamptz not null default now(),
  exit_time                 timestamptz,
  pnl                       numeric,
  r_multiple                numeric,
  timeframe                 text not null default 'M15'
                              check (timeframe in ('M1','M5','M15','H1','H4','D1')),
  setup_structures          text[] not null default '{}',
  setup_fvg                 boolean not null default false,
  setup_ob                  boolean not null default false,
  setup_liquidity_sweep     boolean not null default false,
  bookmap_absorption        text,
  bookmap_passive_orders    text,
  bookmap_aggressive_orders text,
  bookmap_vwap_position     text check (bookmap_vwap_position in ('above','below','at')),
  mental_state              text not null default 'focused'
                              check (mental_state in ('focused','anxious','greedy','revenge','fomo','tired')),
  cookie_jar_ref            boolean not null default false,
  rule_40_percent           boolean not null default false,
  screenshot_before_url     text,
  screenshot_after_url      text,
  notes                     text,
  result                    text not null default 'OPEN'
                              check (result in ('TP','SL','BE','OPEN')),
  session                   text check (session in ('Asia','London','New York','Over Session')),
  -- Trading costs. `pnl` is and remains the NET figure every statistic reads;
  -- these columns exist so the net can be explained rather than asserted.
  -- Stored as positive magnitudes (a 7.00 commission is 7, not -7) so no row
  -- depends on a sign convention the UI would have to guess.
  commission                numeric not null default 0,
  swap                      numeric not null default 0,
  -- Maximum adverse / favourable excursion, stored as the extreme PRICE the
  -- trade reached while open. Prices (not R multiples) are stored because they
  -- are what the user reads off the chart, and because every derived figure --
  -- R excursion, capture ratio, heat -- can be recomputed from them if the
  -- stop or risk model changes later.
  --
  -- NULL means "not recorded" and must stay distinct from a real value: unlike
  -- a cost, a price of 0 is nonsense, so these are nullable with no backfill.
  mae_price                 numeric,
  mfe_price                 numeric,
  -- Free-form user tags. Deliberately separate from setup_structures, which
  -- drives playbook attribution: overloading that column would make every
  -- casual tag look like a strategy and corrupt the setup statistics.
  tags                      text[] not null default '{}',
  created_at                timestamptz not null default now()
);

-- Columns added after the first release: bring older databases up to date.
--
-- The defaults are declared HERE rather than backfilled with UPDATE. Postgres
-- fills existing rows as part of the ALTER, which matters because some
-- deployments carry a BEFORE trigger on trades that raises when the daily
-- session is locked: a backfill UPDATE would touch every historical row, trip
-- that trigger, and abort the whole migration with
--   P0001: Session verrouillee : la limite de perte journaliere a ete atteinte
-- ALTER TABLE does not fire row-level triggers, so this route is immune.
alter table public.trades
  add column if not exists commission numeric not null default 0,
  add column if not exists swap       numeric not null default 0,
  add column if not exists mae_price  numeric,
  add column if not exists mfe_price  numeric,
  add column if not exists tags       text[] not null default '{}';

-- Residual backfill, only for a database where these columns already exist as
-- NULLable from an earlier partial run. Row triggers are suspended for the
-- duration: this is housekeeping on historical rows, not trading activity, and
-- a lock that exists to stop a trader placing trades must not stop a migration.
do $$
declare
  v_needs_backfill boolean;
begin
  select exists (
    select 1 from public.trades
    where commission is null or swap is null or tags is null
  ) into v_needs_backfill;

  if v_needs_backfill then
    alter table public.trades disable trigger user;

    update public.trades set commission = 0 where commission is null;
    update public.trades set swap       = 0 where swap is null;
    update public.trades set tags       = '{}' where tags is null;

    alter table public.trades enable trigger user;
  end if;
exception when others then
  -- Never leave the table with its triggers switched off.
  alter table public.trades enable trigger user;
  raise;
end;
$$;

alter table public.trades
  alter column commission set default 0,
  alter column commission set not null,
  alter column swap       set default 0,
  alter column swap       set not null,
  alter column tags       set default '{}',
  alter column tags       set not null;

-- The app always filters by account and sorts by entry_time desc.
create index if not exists trades_user_account_time_idx
  on public.trades (user_id, account_id, entry_time desc);
create index if not exists trades_user_time_idx
  on public.trades (user_id, entry_time desc);
-- Tag filtering uses array containment, which needs GIN to stay fast.
create index if not exists trades_tags_idx
  on public.trades using gin (tags);

-- ---------------------------------------------------------------------------
-- daily_session_locks
-- Consumer: src/features/guard/useDailyLock.ts (keyed on the LOCAL day)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_session_locks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  sl_count    int not null default 0,
  is_locked   boolean not null default false,
  locked_at   timestamptz,
  unlock_at   timestamptz,
  lock_reason text,
  -- Machine-readable reason + interpolation values, so the client renders a
  -- localized sentence instead of storing a hardcoded French string.
  lock_code   text,
  lock_params jsonb,
  unique (user_id, date)
);

alter table public.daily_session_locks
  add column if not exists lock_code   text,
  add column if not exists lock_params jsonb;

comment on column public.daily_session_locks.lock_code is
  'Machine-readable reason, e.g. DAILY_LOSS_LIMIT. Client maps it to an i18n key.';

-- The upsert in useDailyLock targets this natural key explicitly.
create unique index if not exists daily_session_locks_user_date_key
  on public.daily_session_locks (user_id, date);

-- ---------------------------------------------------------------------------
-- playbook_setups
-- Consumer: src/features/playbook/usePlaybook.ts
-- Was AsyncStorage-only, so setups never synced and vanished on reinstall.
-- ---------------------------------------------------------------------------
-- trade_exits
-- Partial exits (scaling out) for a trade.
--
-- Why a child table rather than restructuring `trades` into executions: the
-- single `pnl` column is read by every statistic, every chart and the daily
-- loss trigger. Turning a trade into a series of executions would change the
-- meaning of that column everywhere at once, on live data, for a feature most
-- traders use on a minority of trades.
--
-- So exits are ADDITIVE detail. `trades.pnl` stays the authoritative net total
-- for the whole position; exits explain how that total was reached. A trade
-- with no exit rows behaves exactly as it always did.
-- ---------------------------------------------------------------------------
create table if not exists public.trade_exits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  trade_id   uuid not null references public.trades(id) on delete cascade,
  -- Quantity closed at this exit, in the same unit as trades.size.
  size       numeric not null check (size > 0),
  price      numeric not null,
  exit_time  timestamptz not null default now(),
  -- Net result of THIS slice. Nullable: a trader may record the scale-out
  -- levels without splitting the money, and a fabricated 0 would read as a
  -- breakeven slice.
  pnl        numeric,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists trade_exits_trade_idx
  on public.trade_exits (trade_id, exit_time);
create index if not exists trade_exits_user_idx
  on public.trade_exits (user_id);

-- ---------------------------------------------------------------------------
create table if not exists public.playbook_setups (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  description      text,
  timeframes       text[] not null default '{}',
  validation_rules text[] not null default '{}',
  tags             text[] not null default '{}',
  image_url        text,
  created_at       timestamptz not null default now()
);

create index if not exists playbook_setups_user_idx
  on public.playbook_setups (user_id);

-- ---------------------------------------------------------------------------
-- daily_debriefs
-- Consumer: src/features/playbook/usePlaybook.ts
-- ---------------------------------------------------------------------------
create table if not exists public.daily_debriefs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null,
  market_sentiment   text,
  lessons_learned    text,
  mistakes_committed text[] not null default '{}',
  mental_score       int check (mental_score between 0 and 10),
  htf_analysis       text,
  htf_image_url      text,
  rules_followed     text[] not null default '{}',
  objective_tomorrow text,
  emotion_before     text,
  day_rating         int check (day_rating between 1 and 5),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, date)
);

-- saveDebrief upserts with onConflict 'user_id,date'; without this exact
-- unique index the upsert errors out instead of updating.
create unique index if not exists daily_debriefs_user_date_key
  on public.daily_debriefs (user_id, date);

create index if not exists daily_debriefs_user_idx
  on public.daily_debriefs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- user_checklists
-- Consumer: src/features/dashboard/useChecklist.ts
-- Reads .order('sort_order').order('created_at'), updates { is_done }.
-- ---------------------------------------------------------------------------
create table if not exists public.user_checklists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,
  is_done    boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists user_checklists_user_idx
  on public.user_checklists (user_id, sort_order, created_at);

-- ===========================================================================
-- SECTION 4 — AUTO-JOURNAL SYNC
--
-- Broker-sourced trades land in a staging queue (sync_trades) and reach
-- `trades` only through a human action (promote / link / dismiss RPCs).
-- Dedup is structural: UNIQUE (ingest_account_id, external_id) makes any
-- webhook re-delivery or double CSV import a no-op by construction.
--
-- The ingest identity is the secret on sync_ingest_accounts, held by the
-- webhook caller (MQL5 EA, cTrader OAuth bridge). user_id is ALWAYS derived
-- from that secret server-side; a payload may never carry it.
--
-- See docs/auto-journal-sync.md for the design (matching policy, OPEN->CLOSED
-- flow, stale recovery, payload contract).
-- ===========================================================================

-- Result 'CLOSED': the broker closed the position outside TP/SL/BE (manual
-- close, margin stop-out, session end). The broker does not always say why;
-- the journal should not have to guess between TP and SL.
alter table public.trades drop constraint if exists trades_result_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trades'::regclass and conname = 'trades_result_check'
  ) then
    alter table public.trades
      add constraint trades_result_check
      check (result in ('TP','SL','BE','CLOSED','OPEN'));
  end if;
end $$;

-- One connected broker account (a feed), not a journal account.
-- account_id is the user's default routing choice at validation time; it is
-- optional because routing is confirmed per batch by the human.
create table if not exists public.sync_ingest_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  account_id       uuid references public.trading_accounts(id) on delete set null,
  platform         text not null
                     check (platform in ('mt5_ea','mt4_ea','csv_mt5','csv_generic','ctrader','manual_api')),
  label            text not null,
  secret           text not null unique,
  -- Match window against manually-entered trades, in seconds. Clocks drift:
  -- the EA runs on the trader's PC or VPS, entry_time comes from the broker.
  match_window_s   int not null default 90
                     check (match_window_s between 5 and 3600),
  is_active        boolean not null default true,
  -- Heartbeat bookkeeping for the "Journal auto" connectors card.
  last_sync_at     timestamptz,
  last_sync_status text check (last_sync_status in ('ok','error','empty')),
  last_error       text,
  created_at       timestamptz not null default now(),
  unique (user_id, label)
);

create index if not exists sync_ingest_accounts_user_idx
  on public.sync_ingest_accounts (user_id);

-- Broker-reported account state, from the v1.14 heartbeat.
--
-- The journal derives a balance by summing P&L; the broker KNOWS it. The gap
-- between the two is information -- uncaptured fees, a trade the bridge
-- missed, a deposit or withdrawal never recorded. Without it a missing trade
-- is silent, and the statistics quietly describe an incomplete history.
--
-- Nullable on purpose: an older EA, or a connector that has never beaten,
-- reports nothing. "Unknown" and "matches" must never be conflated, so the
-- reconciliation card stays hidden rather than claiming agreement.
alter table public.sync_ingest_accounts
  add column if not exists broker_balance   numeric,
  add column if not exists broker_equity    numeric,
  add column if not exists broker_currency  text,
  add column if not exists broker_state_at  timestamptz;

-- A journal account may be fed by more than one connector (an MT5 demo and a
-- cTrader demo can both belong to "50k Paper Trading"), so the association is
-- its own table, not a column on either side. Feeds the "synchronised" badge
-- on the Accounts screen and the per-connector default routing target.
create table if not exists public.sync_account_links (
  sync_ingest_account_id uuid not null references public.sync_ingest_accounts(id) on delete cascade,
  trading_account_id     uuid not null references public.trading_accounts(id) on delete cascade,
  created_at             timestamptz not null default now(),
  primary key (sync_ingest_account_id, trading_account_id)
);

create index if not exists sync_account_links_account_idx
  on public.sync_account_links (trading_account_id);

-- The ingest account's default routing target must be one of its explicit
-- links (or NULL). Keeping this invariant in a trigger means every writer —
-- app, service script, future import — gets the same guard for free.
create or replace function public.sync_ingest_default_guard()
returns trigger
language plpgsql
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.sync_account_links
    where sync_ingest_account_id = new.id and trading_account_id = new.account_id
  ) then
    raise exception 'P0001: default account must be linked first';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_ingest_default_guard_trg on public.sync_ingest_accounts;
create trigger sync_ingest_default_guard_trg
  before insert or update of account_id on public.sync_ingest_accounts
  for each row execute function public.sync_ingest_default_guard();

-- Seed: connectors created before links existed keep their default target.
insert into public.sync_account_links (sync_ingest_account_id, trading_account_id)
select s.id, s.account_id
from public.sync_ingest_accounts s
where s.account_id is not null
on conflict do nothing;

-- Verbatim inbound payloads, for replay after a parser bug and as the source
-- of truth in a broker-vs-journal dispute. 30-day retention: purged nightly
-- by pg_cron (schedule created at the end of this section).
-- Heartbeats deliberately do NOT land here (1440 rows/day/account otherwise);
-- they only touch last_sync_* on the ingest account.
create table if not exists public.sync_raw_events (
  id                uuid primary key default gen_random_uuid(),
  ingest_account_id uuid not null references public.sync_ingest_accounts(id) on delete cascade,
  payload           jsonb not null,
  source_ip         text,
  received_at       timestamptz not null default now()
);

create index if not exists sync_raw_events_ingest_idx
  on public.sync_raw_events (ingest_account_id, received_at desc);

-- The validation queue. One row per broker-side position; OPEN -> CLOSED
-- transitions UPDATE the same row (same external_id = position id).
create table if not exists public.sync_trades (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  ingest_account_id uuid not null references public.sync_ingest_accounts(id) on delete cascade,
  -- Broker-side identity of the trade: MT5/cTrader position id, MT4 order
  -- ticket. The dedup key — see the UNIQUE below.
  external_id       text not null,
  payload           jsonb not null,
  is_open           boolean not null,
  open_time         timestamptz,
  close_time        timestamptz,
  -- pending -> promoted | linked | dismissed (human, terminal)
  -- pending -> stale (system, RECOVERABLE: a later payload returns it to pending)
  status            text not null default 'pending'
                     check (status in ('pending','promoted','linked','dismissed','stale')),
  resolution        text check (resolution in ('created','linked','dismissed')),
  resolved_trade_id uuid references public.trades(id) on delete set null,
  resolved_at       timestamptz,
  resolved_by       text check (resolved_by in ('user','system')),
  dismiss_reason    text,
  created_at        timestamptz not null default now(),
  -- The structural dedupe. A re-delivered webhook UPSERTs this same row.
  unique (ingest_account_id, external_id)
);

-- The queue screen reads pending rows only.
create index if not exists sync_trades_queue_idx
  on public.sync_trades (user_id, created_at desc)
  where status = 'pending';

-- Provenance of promoted trades. on delete set null: purging the staging row
-- must never cascade into the journal itself.
alter table public.trades
  add column if not exists sync_source_id uuid references public.sync_trades(id) on delete set null;

-- Which human fields the bridge INVENTED at promotion.
--
-- promote_sync_trades must satisfy NOT NULL and CHECK constraints for fields
-- the broker cannot possibly know: mental_state has a CHECK so it cannot be
-- left null, timeframe falls back to 'M15'. Seeding them keeps promotion from
-- failing, but the result is indistinguishable from a trade the trader
-- actually qualified -- so "my focused trades" silently counted imports that
-- were never assessed, and the timeframe breakdown inherited an invented M15.
--
-- Recording the seeded names at write time is the only honest fix: guessing
-- afterwards cannot tell a real 'focused' from a placeholder one.
alter table public.trades
  add column if not exists seeded_fields text[] not null default '{}';

-- RLS: same owner-scoped shape as every other table. The Edge Function uses
-- the service role, which bypasses RLS but derives user_id from the secret —
-- see the function's first lookup.
do $$
declare
  tbl text;
begin
  -- Owner-scoped like every other table (they carry user_id directly).
  foreach tbl in array array['sync_ingest_accounts','sync_trades']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I_owner on public.%I', tbl, tbl);
    execute format(
      'create policy %I_owner on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      tbl, tbl
    );
  end loop;

  -- sync_raw_events has no user_id column by design: ownership is DERIVED
  -- through the ingest account, so a raw payload can never be re-attached to
  -- a different account by rewriting it. Same effect, single source of truth.
  alter table public.sync_raw_events enable row level security;
  execute 'drop policy if exists sync_raw_events_owner on public.sync_raw_events';
  execute $policy$
    create policy sync_raw_events_owner on public.sync_raw_events
      for all
      to authenticated
      using (exists (
        select 1 from public.sync_ingest_accounts a
        where a.id = sync_raw_events.ingest_account_id
          and a.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.sync_ingest_accounts a
        where a.id = sync_raw_events.ingest_account_id
          and a.user_id = auth.uid()
      ))
  $policy$;
end $$;

-- ---------------------------------------------------------------------------
-- sync helpers
-- ---------------------------------------------------------------------------

-- Broker symbol -> canonical pair. EURUSD.m / EURUSDm / eurusd-pro all fold to
-- EURUSD so broker feeds can be matched against manual entries and so the
-- journal stores one consistent symbol per instrument.
create or replace function public.normalize_pair(p_symbol text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(p_symbol, '')), '(m|pro|\.m|\.(raw|c)|\.a)$', ''))
$$;

-- Promote a batch of staging rows to real journal trades. One transaction,
-- server-revalidated: ownership, pending status, and required fields are all
-- re-checked here, whoever calls it. Numbers come from the broker payload;
-- the app passes only `overrides` for journal fields the human chose
-- (timeframe, setup_structures, session...), never for measured values.
--
-- p_batch: [{ staging_id, overrides? }, ...]
create or replace function public.promote_sync_trades(p_batch jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sync_trades%rowtype;
  v_ingest public.sync_ingest_accounts%rowtype;
  v_payload jsonb;
  v_over jsonb;
  v_account_id uuid;
  v_count int := 0;
  v_trade_id uuid;
  v_exit jsonb;
  v_seeded text[];
begin
  if v_uid is null or p_batch is null or jsonb_typeof(p_batch) <> 'array' then
    raise exception 'P0001: invalid batch';
  end if;

  -- Lock every staging row up front so two promotions can't interleave.
  create temp table _promote_batch on commit drop as
    select (e->>'staging_id')::uuid as staging_id, e->'overrides' as overrides
    from jsonb_array_elements(p_batch) e;

  for v_row in
    select t.* from public.sync_trades t
    join _promote_batch b on b.staging_id = t.id
    where t.user_id = v_uid and t.status = 'pending'
    for update
  loop
    select * into v_ingest from public.sync_ingest_accounts
    where id = v_row.ingest_account_id;

    select coalesce(b.overrides, '{}'::jsonb) into v_over
    from _promote_batch b where b.staging_id = v_row.id;

    -- Routing: explicit override wins, else the ingest account's default.
    v_account_id := coalesce(
      nullif(v_over->>'account_id', '')::uuid,
      v_ingest.account_id
    );
    if v_account_id is null then
      raise exception 'P0001: no target account for staging %', v_row.id;
    end if;

    -- Ownership of the target account is re-checked (it may have been
    -- deleted, or belong to someone else if the default was stale).
    if not exists (
      select 1 from public.trading_accounts
      where id = v_account_id and user_id = v_uid
    ) then
      raise exception 'P0001: bad target account for staging %', v_row.id;
    end if;

    v_payload := v_row.payload;

    -- Record what we are about to invent, before inventing it.
    v_seeded := array[]::text[];
    if nullif(v_over->>'mental_state','') is null then
      v_seeded := v_seeded || 'mental_state';
    end if;
    if nullif(v_over->>'timeframe','') is null
       and nullif(v_payload->>'timeframe','') is null then
      v_seeded := v_seeded || 'timeframe';
    end if;
    -- Context the bridge never carries at all.
    v_seeded := v_seeded || 'setup';
    v_seeded := v_seeded || 'notes';

    insert into public.trades (
      user_id, account_id, pair, direction, entry_price, exit_price,
      stop_loss, take_profit, size, entry_time, exit_time, pnl, r_multiple,
      result, commission, swap, mae_price, mfe_price, timeframe, session,
      mental_state, sync_source_id, seeded_fields
    ) values (
      v_uid,
      v_account_id,
      coalesce(nullif(v_over->>'pair',''), public.normalize_pair(v_payload->>'symbol')),
      coalesce(v_payload->>'direction', 'BUY'),
      (v_payload->>'entry_price')::numeric,
      (v_payload->>'exit_price')::numeric,
      coalesce((v_payload->>'stop_loss')::numeric, 0),
      coalesce((v_payload->>'take_profit')::numeric, 0),
      coalesce((v_payload->>'size')::numeric, 0),
      (v_payload->>'entry_time')::timestamptz,
      (v_payload->>'close_time')::timestamptz,
      (v_payload->>'pnl')::numeric,
      case
        -- R only depends on |move| vs |risk| and the sign of the outcome:
        -- the direction factor is deliberately absent (|entry-exit| is
        -- direction-agnostic). Guarded against stop == entry.
        when coalesce(v_payload->>'stop_loss', '0')::numeric > 0
             and abs((v_payload->>'entry_price')::numeric
                     - (v_payload->>'stop_loss')::numeric) > 0
          then abs((v_payload->>'entry_price')::numeric - (v_payload->>'exit_price')::numeric)
               / abs((v_payload->>'entry_price')::numeric - (v_payload->>'stop_loss')::numeric)
               * case when coalesce((v_payload->>'pnl')::numeric, 0) >= 0 then 1 else -1 end
        else null
      end,
      -- OPEN stays OPEN; the broker's close reason maps to TP/SL/BE/CLOSED.
      case
        when v_row.is_open then 'OPEN'
        else coalesce(v_payload->>'close_reason', 'CLOSED')
      end,
      coalesce((v_payload->>'commission')::numeric, 0),
      coalesce((v_payload->>'swap')::numeric, 0),
      (v_payload->>'mae_price')::numeric,
      (v_payload->>'mfe_price')::numeric,
      coalesce(nullif(v_over->>'timeframe',''), nullif(v_payload->>'timeframe',''), 'M15'),
      -- Session inferred from the entry hour, same UTC windows as the app's
      -- sessionDetect (Asia 23-07, London 7-12, NY 12-21): analytics bucket a
      -- null session as 'Over Session', which turns the breakdown into noise.
      coalesce(
        nullif(v_over->>'session',''),
        case
          when extract(hour from (v_payload->>'entry_time')::timestamptz) >= 23
            or extract(hour from (v_payload->>'entry_time')::timestamptz) < 7  then 'Asia'
          when extract(hour from (v_payload->>'entry_time')::timestamptz) < 12 then 'London'
          when extract(hour from (v_payload->>'entry_time')::timestamptz) < 21 then 'New York'
          else 'Over Session'
        end
      ),
      -- Journal-required human fields the bridge cannot know. Seeded with the
      -- neutral value so promotion never fails on NOT NULL; the trader edits
      -- them in the trade form (mental_state has a CHECK, 'focused' is valid).
      coalesce(nullif(v_over->>'mental_state',''), 'focused'),
      v_row.id,
      v_seeded
    )
    returning id into v_trade_id;

    -- Partial exits, if the bridge sent them.
    if jsonb_typeof(v_payload->'exits') = 'array' then
      for v_exit in select * from jsonb_array_elements(v_payload->'exits') loop
        insert into public.trade_exits (user_id, trade_id, size, price, exit_time, pnl)
        values (
          v_uid,
          v_trade_id,
          (v_exit->>'size')::numeric,
          (v_exit->>'price')::numeric,
          (v_exit->>'exit_time')::timestamptz,
          (v_exit->>'pnl')::numeric
        );
      end loop;
    end if;

    update public.sync_trades
       set status = case when v_row.is_open then 'pending' else 'promoted' end,
           -- An open position was promoted: its row stays pending so the
           -- close event can complete the journal trade (see apply_broker_close).
           resolution = 'created',
           resolved_trade_id = v_trade_id,
           resolved_at = now(),
           resolved_by = 'user'
     where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Promoting an OPEN position leaves the staging row pending on purpose: the
-- close event must still complete the journal trade. This applies it.
create or replace function public.apply_broker_close(p_staging_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.sync_trades%rowtype;
  v_exit jsonb;
begin
  if auth.uid() is null then
    raise exception 'P0001: unauthenticated';
  end if;

  select * into v_row from public.sync_trades
  where id = p_staging_id and user_id = auth.uid() for update;

  if not found or v_row.is_open or v_row.resolution <> 'created'
     or v_row.resolved_trade_id is null then
    return;
  end if;

  update public.trades set
    exit_price  = (v_row.payload->>'exit_price')::numeric,
    exit_time   = (v_row.payload->>'close_time')::timestamptz,
    pnl         = (v_row.payload->>'pnl')::numeric,
    result      = coalesce(v_row.payload->>'close_reason', 'CLOSED'),
    commission  = coalesce((v_row.payload->>'commission')::numeric, 0),
    swap        = coalesce((v_row.payload->>'swap')::numeric, 0),
    mae_price   = (v_row.payload->>'mae_price')::numeric,
    mfe_price   = (v_row.payload->>'mfe_price')::numeric,
    -- The trade was promoted while OPEN: promote_sync_trades could not
    -- compute R without an exit. Now the close payload supplies one, so the
    -- same guarded |move|/|risk| ratio lands here — a completed trade with a
    -- stop must not keep a null R in the analytics.
    r_multiple  = case
      when coalesce((v_row.payload->>'stop_loss')::numeric, 0) > 0
           and coalesce((v_row.payload->>'exit_price')::numeric, 0) <> 0
           and abs((v_row.payload->>'entry_price')::numeric
                   - (v_row.payload->>'stop_loss')::numeric) > 0
        then abs((v_row.payload->>'entry_price')::numeric
                 - (v_row.payload->>'exit_price')::numeric)
             / abs((v_row.payload->>'entry_price')::numeric
                   - (v_row.payload->>'stop_loss')::numeric)
             * case when coalesce((v_row.payload->>'pnl')::numeric, 0) >= 0 then 1 else -1 end
      else null
    end
  where id = v_row.resolved_trade_id;

  -- Re-apply exits verbatim: the close payload carries the full set.
  delete from public.trade_exits where trade_id = v_row.resolved_trade_id;
  if jsonb_typeof(v_row.payload->'exits') = 'array' then
    for v_exit in select * from jsonb_array_elements(v_row.payload->'exits') loop
      insert into public.trade_exits (user_id, trade_id, size, price, exit_time, pnl)
      values (
        v_row.user_id,
        v_row.resolved_trade_id,
        (v_exit->>'size')::numeric,
        (v_exit->>'price')::numeric,
        (v_exit->>'exit_time')::timestamptz,
        (v_exit->>'pnl')::numeric
      );
    end loop;
  end if;

  update public.sync_trades
     set status = 'promoted', resolved_at = now()
   where id = v_row.id;
end;
$$;

-- Link a staging row to an existing manual trade. Merge policy: journal
-- fields win, broker values only fill NULLs. A meaningful P&L gap is recorded
-- on the staging row for the queue card to surface, never silently merged.
create or replace function public.link_sync_trade(
  p_staging_id uuid,
  p_trade_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.sync_trades%rowtype;
  v_trade public.trades%rowtype;
  v_payload jsonb;
  v_gap numeric;
begin
  if auth.uid() is null then
    raise exception 'P0001: unauthenticated';
  end if;

  select * into v_row from public.sync_trades
  where id = p_staging_id and user_id = auth.uid() and status = 'pending'
  for update;
  if not found then
    raise exception 'P0001: staging row not pending';
  end if;

  select * into v_trade from public.trades
  where id = p_trade_id and user_id = auth.uid();
  if not found then
    raise exception 'P0001: trade not found';
  end if;

  v_payload := v_row.payload;

  update public.trades set
    exit_price  = coalesce(exit_price,  (v_payload->>'exit_price')::numeric),
    exit_time   = coalesce(exit_time,   (v_payload->>'close_time')::timestamptz),
    pnl         = coalesce(pnl,         (v_payload->>'pnl')::numeric),
    result      = case
                    when result in ('OPEN') and not v_row.is_open
                      then coalesce(v_payload->>'close_reason', 'CLOSED')
                    else result
                  end,
    commission  = case when commission = 0 then coalesce((v_payload->>'commission')::numeric, 0) else commission end,
    swap        = case when swap = 0       then coalesce((v_payload->>'swap')::numeric, 0)       else swap end,
    mae_price   = coalesce(mae_price,   (v_payload->>'mae_price')::numeric),
    mfe_price   = coalesce(mfe_price,   (v_payload->>'mfe_price')::numeric),
    sync_source_id = v_row.id
  where id = p_trade_id;

  if jsonb_typeof(v_payload->'exits') = 'array'
     and not exists (select 1 from public.trade_exits where trade_id = p_trade_id) then
    insert into public.trade_exits (user_id, trade_id, size, price, exit_time, pnl)
    select
      v_row.user_id, p_trade_id,
      (e->>'size')::numeric, (e->>'price')::numeric,
      (e->>'exit_time')::timestamptz, (e->>'pnl')::numeric
    from jsonb_array_elements(v_payload->'exits') e;
  end if;

  v_gap := case
    when v_trade.pnl is not null and (v_payload->>'pnl')::numeric is not null
      then abs(v_trade.pnl - (v_payload->>'pnl')::numeric)
    else null
  end;

  update public.sync_trades
     set payload = jsonb_set(v_row.payload, '{pnl_gap}', to_jsonb(v_gap), true),
         status = 'linked',
         resolution = 'linked',
         resolved_trade_id = p_trade_id,
         resolved_at = now(),
         resolved_by = 'user'
   where id = v_row.id;
end;
$$;

create or replace function public.dismiss_sync_trade(
  p_staging_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'P0001: unauthenticated';
  end if;
  update public.sync_trades
     set status = 'dismissed',
         resolution = 'dismissed',
         dismiss_reason = left(coalesce(p_reason, 'not_mine'), 40),
         resolved_at = now(),
         resolved_by = 'user'
   where id = p_staging_id and user_id = auth.uid() and status = 'pending';
end;
$$;

-- Bulk dismiss: same contract as dismiss_sync_trade, one statement for the
-- whole pending queue of one connector (or everything when null).
create or replace function public.dismiss_sync_trades(
  p_staging_ids uuid[],
  p_reason text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'P0001: unauthenticated';
  end if;
  update public.sync_trades
     set status = 'dismissed',
         resolution = 'dismissed',
         dismiss_reason = left(coalesce(p_reason, 'not_mine'), 40),
         resolved_at = now(),
         resolved_by = 'user'
   where id = any(p_staging_ids)
     and user_id = auth.uid()
     and status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Matching candidates for a staging row: same routed account, same normalized
-- pair, same direction, entry time within the connector's window, size within
-- 2%. A proposal engine, never an auto-merge.
create or replace function public.match_candidates(p_staging_id uuid)
returns table (trade_id uuid, entry_time timestamptz, pnl numeric, time_delta_s int)
language sql
security definer
set search_path = public
as $$
  with s as (
    select t.*, i.account_id as routed_account, i.match_window_s
    from public.sync_trades t
    join public.sync_ingest_accounts i on i.id = t.ingest_account_id
    where t.id = p_staging_id and t.user_id = auth.uid()
  )
  select tr.id, tr.entry_time, tr.pnl,
         abs(extract(epoch from (tr.entry_time - s.open_time)))::int
  from public.trades tr
  join s on true
  where tr.user_id = auth.uid()
    and tr.account_id = s.routed_account
    and public.normalize_pair(tr.pair) = public.normalize_pair(s.payload->>'symbol')
    and tr.direction = coalesce(s.payload->>'direction', tr.direction)
    and abs(extract(epoch from (tr.entry_time - s.open_time))) <= s.match_window_s
    and (abs(tr.size - (s.payload->>'size')::numeric) / greatest(abs(tr.size), 0.0001)) <= 0.02
  order by abs(extract(epoch from (tr.entry_time - s.open_time)))
  limit 5;
$$;

-- Wire a journal account to a connector: the account joins the connector's
-- routing options (its name/capital then render on the connector card, and it
-- shows the "synchronised" state on the Accounts screen); passing it as the
-- default also makes promotion one tap. Unsetting (p_trading_account_id null)
-- removes every link of the connector and clears its default.
create or replace function public.set_sync_routing(
  p_sync_ingest_account_id uuid,
  p_trading_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'P0001: unauthenticated';
  end if;

  if not exists (
    select 1 from public.sync_ingest_accounts
    where id = p_sync_ingest_account_id and user_id = v_uid
  ) then
    raise exception 'P0001: unknown connector';
  end if;

  if p_trading_account_id is null then
    update public.sync_ingest_accounts
    set account_id = null
    where id = p_sync_ingest_account_id;
    delete from public.sync_account_links
    where sync_ingest_account_id = p_sync_ingest_account_id;
    return;
  end if;

  -- Ownership of the journal account is re-checked here: inside a security
  -- definer body RLS does not implicitly filter, so ownership is explicit.
  if not exists (
    select 1 from public.trading_accounts
    where id = p_trading_account_id and user_id = v_uid
  ) then
    raise exception 'P0001: unknown trading account';
  end if;

  insert into public.sync_account_links (sync_ingest_account_id, trading_account_id)
  values (p_sync_ingest_account_id, p_trading_account_id)
  on conflict do nothing;

  update public.sync_ingest_accounts
  set account_id = p_trading_account_id
  where id = p_sync_ingest_account_id;
end;
$$;

-- 30-day retention for raw payloads. Scheduled nightly via pg_cron below;
-- also safe to call by hand.
create or replace function public.purge_old_sync_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sync_raw_events where received_at < now() - interval '30 days';
$$;

-- ---------------------------------------------------------------------------
-- sync.grants
-- ---------------------------------------------------------------------------
grant execute on function public.promote_sync_trades(jsonb)      to authenticated;
grant execute on function public.apply_broker_close(uuid)        to authenticated;
grant execute on function public.link_sync_trade(uuid, uuid)     to authenticated;
grant execute on function public.dismiss_sync_trade(uuid, text)  to authenticated;
grant execute on function public.dismiss_sync_trades(uuid[], text) to authenticated;
grant execute on function public.match_candidates(uuid)          to authenticated;
grant execute on function public.set_sync_routing(uuid, uuid)    to authenticated;

-- Connector creation runs server-side so the secret is born from
-- gen_random_bytes(32), never from client randomness, and never transits a
-- client-side generator. Returns the row including the plaintext secret ONCE;
-- nothing ever exposes it again (rotate = delete + recreate).
create or replace function public.create_sync_ingest_account(
  p_platform  text,
  p_label     text,
  p_account_id uuid default null
)
returns public.sync_ingest_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc public.sync_ingest_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'P0001: unauthenticated';
  end if;

  insert into public.sync_ingest_accounts (user_id, platform, label, secret, account_id)
  values (
    auth.uid(),
    p_platform,
    left(p_label, 60),
    -- base64url without padding: URL-safe, fits a Bearer header cleanly.
    replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''),
    p_account_id
  )
  returning * into v_acc;

  return v_acc;
end;
$$;

grant execute on function public.create_sync_ingest_account(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- sync.pg_cron — nightly retention
--
-- The ingest function no longer sweeps on the hot path; the raw-event archive
-- is purged once a night instead. Idempotent: re-running the schema never
-- duplicates the schedule. cron.schedule() is in the cron schema, which only
-- exists once pg_cron is enabled — hence the two guarded blocks. Requires
-- Dashboard → Database → Extensions to enable pg_cron once per project.
-- ---------------------------------------------------------------------------
do $sync$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'purge-sync-raw') then
      perform cron.schedule('purge-sync-raw', '30 3 * * *',
        $job$select public.purge_old_sync_events()$job$);
    end if;
  end if;
end
$sync$;

-- ============================================================================
-- SECTION 2 — PROP-FIRM RULE ENGINE (server side)
--
-- Enforcement used to run in the React Native client on every mutation:
--   1. it could be bypassed (patched client, direct API call), contradicting
--      the product rule that the Lock Guard is never circumventable;
--   2. it refetched trades + accounts on every write;
--   3. the reason was a hardcoded French string, breaking i18n.
--
-- As a trigger, the lock is applied inside the same transaction as the trade,
-- whoever is writing.
-- ============================================================================

-- Effective daily loss limit: explicit limit, else 1% of the initial balance
-- (matching the previous client-side fallback).
create or replace function public.effective_daily_loss_limit(acc public.trading_accounts)
returns numeric
language sql
immutable
as $$
  select case
    when acc.max_daily_loss_limit is not null and acc.max_daily_loss_limit > 0
      then acc.max_daily_loss_limit
    when acc.initial_balance is not null
      then acc.initial_balance * 0.01
    else 1000
  end;
$$;

-- The trading day a timestamp belongs to, in the account's own timezone.
--
-- This used to be (entry_time at time zone 'UTC')::date while the client keys
-- the lock on the DEVICE-local day. For any trader east or west of UTC the two
-- disagree near midnight: at UTC+3 a trade at 01:00 local is 22:00 UTC the day
-- before, so the trigger wrote the lock under a date the app never queried and
-- the "sacred" lock silently did nothing.
create or replace function public.account_trading_day(
  p_ts timestamptz,
  p_timezone text
)
returns date
language sql
immutable
as $$
  select (p_ts at time zone coalesce(nullif(p_timezone, ''), 'UTC'))::date;
$$;

-- Evaluate one account for one trading day and lock it when ANY rule is
-- breached: the daily loss limit, or one of the personal discipline rules.
-- The name is kept for backwards compatibility with existing deployments.
create or replace function public.enforce_daily_loss_limit(
  p_user_id uuid,
  p_account_id uuid,
  p_day date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.trading_accounts%rowtype;
  v_limit numeric;
  v_today_pnl numeric;
  v_sl_count int;
  v_trade_count int;
  v_streak int;
  v_pnl numeric;
  v_code text := null;
  v_params jsonb;
begin
  select * into v_account
  from public.trading_accounts
  where id = p_account_id and user_id = p_user_id;

  if not found then
    return;
  end if;

  v_limit := public.effective_daily_loss_limit(v_account);

  select coalesce(sum(pnl), 0),
         count(*) filter (where pnl < 0),
         count(*)
    into v_today_pnl, v_sl_count, v_trade_count
  from public.trades
  where user_id = p_user_id
    and account_id = p_account_id
    and public.account_trading_day(entry_time, v_account.timezone) = p_day;

  -- Personal rules are evaluated first: hitting the trade cap or a losing
  -- streak should stop the session even when the money lost is still small.
  -- That is the whole point -- the damage from tilt is behavioural before it
  -- is financial.
  --
  -- Consecutive losses, counted backwards from the most recent closed trade
  -- of the day. A win anywhere in the run resets it.
  v_streak := 0;
  for v_pnl in
    select pnl
    from public.trades
    where user_id = p_user_id
      and account_id = p_account_id
      and pnl is not null
      and public.account_trading_day(entry_time, v_account.timezone) = p_day
    order by entry_time desc, created_at desc
  loop
    if v_pnl < 0 then
      v_streak := v_streak + 1;
    else
      exit;
    end if;
  end loop;

  if v_account.max_trades_per_day is not null
     and v_trade_count >= v_account.max_trades_per_day then
    v_code := 'MAX_TRADES_PER_DAY';
    v_params := jsonb_build_object(
      'account', v_account.name,
      'count', v_trade_count,
      'limit', v_account.max_trades_per_day
    );
  elsif v_account.max_consecutive_losses is not null
        and v_streak >= v_account.max_consecutive_losses then
    v_code := 'MAX_CONSECUTIVE_LOSSES';
    v_params := jsonb_build_object(
      'account', v_account.name,
      'count', v_streak,
      'limit', v_account.max_consecutive_losses
    );
  elsif v_today_pnl < 0 and abs(v_today_pnl) >= v_limit then
    v_code := 'DAILY_LOSS_LIMIT';
    v_params := jsonb_build_object(
      'account', v_account.name,
      'loss', abs(v_today_pnl),
      'limit', v_limit
    );
  end if;

  if v_code is not null then
    insert into public.daily_session_locks (
      user_id, date, sl_count, is_locked, locked_at, lock_code, lock_params, lock_reason
    )
    values (
      p_user_id,
      p_day,
      v_sl_count,
      true,
      now(),
      v_code,
      v_params,
      format('%s on %s.', v_code, v_account.name)
    )
    on conflict (user_id, date) do update
      set is_locked   = true,
          locked_at   = coalesce(public.daily_session_locks.locked_at, now()),
          sl_count    = excluded.sl_count,
          lock_code   = excluded.lock_code,
          lock_params = excluded.lock_params,
          lock_reason = excluded.lock_reason;
  end if;
end;
$$;

-- Re-evaluate on every write to trades.
create or replace function public.trades_enforce_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trades%rowtype;
  v_tz text;
begin
  v_row := coalesce(new, old);

  select timezone into v_tz
  from public.trading_accounts
  where id = v_row.account_id;

  perform public.enforce_daily_loss_limit(
    v_row.user_id,
    v_row.account_id,
    public.account_trading_day(v_row.entry_time, v_tz)
  );
  return null;
end;
$$;

drop trigger if exists trg_trades_enforce_lock on public.trades;
create trigger trg_trades_enforce_lock
  after insert or update or delete on public.trades
  for each row execute function public.trades_enforce_lock();

-- Recording an ALREADY-TAKEN trade is bookkeeping, not risk: the promotion of
-- staged broker history must flow through even while the daily lock is active
-- (the trader importing this morning's losses is reviewing, not trading).
-- Manual entries stay blocked — this exemption only exists where provenance
-- is verifiable (sync_source_id set by promote_sync_trades).
create or replace function public.fn_prevent_trade_during_lock()
returns trigger
language plpgsql
as $$
begin
  if new.sync_source_id is null and exists (
    select 1 from daily_session_locks
    where user_id = new.user_id
      and is_locked = true
      and date = current_date
      and (unlock_at is null or now() < unlock_at)
  ) then
    raise exception 'LOCKED: daily session lock is active for today.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_trade_during_lock on public.trades;
create trigger trg_prevent_trade_during_lock
  before insert on public.trades
  for each row execute function public.fn_prevent_trade_during_lock();

-- Read-only snapshot of prop-firm rule state, so the app stops recomputing
-- drawdown / consistency locally on every render.
create or replace function public.prop_firm_status(p_account_id uuid)
returns table (
  daily_limit        numeric,
  daily_used         numeric,
  daily_remaining    numeric,
  is_locked          boolean,
  net_pnl            numeric,
  best_day_pnl       numeric,
  consistency_pct    numeric,
  consistency_breach boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.trading_accounts%rowtype;
  v_today date;
begin
  select * into v_account
  from public.trading_accounts
  where id = p_account_id and user_id = auth.uid();

  if not found then
    return;
  end if;

  v_today := public.account_trading_day(now(), v_account.timezone);

  daily_limit := public.effective_daily_loss_limit(v_account);

  select coalesce(abs(least(sum(pnl), 0)), 0) into daily_used
  from public.trades
  where account_id = p_account_id
    and user_id = auth.uid()
    and public.account_trading_day(entry_time, v_account.timezone) = v_today;

  daily_remaining := greatest(0, daily_limit - daily_used);

  select coalesce(bool_or(l.is_locked), false) into is_locked
  from public.daily_session_locks l
  where l.user_id = auth.uid() and l.date = v_today;

  select coalesce(sum(pnl), 0) into net_pnl
  from public.trades
  where account_id = p_account_id and user_id = auth.uid();

  select coalesce(max(day_pnl), 0) into best_day_pnl
  from (
    select sum(pnl) as day_pnl
    from public.trades
    where account_id = p_account_id
      and user_id = auth.uid()
      and pnl is not null
    group by public.account_trading_day(entry_time, v_account.timezone)
  ) d;

  consistency_pct := case
    when net_pnl > 0 then round((best_day_pnl / net_pnl) * 100, 2)
    else 0
  end;

  consistency_breach :=
    consistency_pct > coalesce(v_account.consistency_rule_percent, 15);

  return next;
end;
$$;

grant execute on function public.prop_firm_status(uuid) to authenticated;

-- ============================================================================
-- SECTION 3 — ROW LEVEL SECURITY
-- Every table is strictly owner-scoped.
-- ============================================================================

alter table public.trading_accounts    enable row level security;
alter table public.trades              enable row level security;
alter table public.daily_session_locks enable row level security;
alter table public.trade_exits         enable row level security;
alter table public.playbook_setups     enable row level security;
alter table public.daily_debriefs      enable row level security;
alter table public.user_checklists     enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'trading_accounts','trades','trade_exits','daily_session_locks',
    'playbook_setups','daily_debriefs','user_checklists'
  ]
  loop
    execute format('drop policy if exists %I_owner on public.%I', tbl, tbl);
    execute format(
      'create policy %I_owner on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      tbl, tbl
    );
  end loop;
end $$;
