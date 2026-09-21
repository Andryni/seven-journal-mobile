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
--
-- RUN IT QUIET
--   The script takes exclusive locks (drop policy, alter table) while the app
--   and the EA's heartbeat keep reading and writing the same tables. Run with
--   the app closed and the terminal paused, or the two can deadlock (40P01)
--   mid-file. The lock_timeout below makes that failure fast and legible
--   instead of silent: a statement that cannot get its lock in 8s aborts with
--   "lock timeout" — re-run after closing the app. Nothing breaks on a partial
--   run: every statement is idempotent, so re-running simply finishes the job.
-- ============================================================================

set lock_timeout = '8s';

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
-- trade_fill_history
-- Consumer: src/features/trades/fillHistory.ts + useFillHistory.ts
--
-- Change history for values the APP writes on the trader's behalf: the
-- one-tap "complete from broker" button (per-row fill and batch), and the
-- chat's confirmed actions (set_r_multiple, set_costs, tags, mental state).
-- Answers "qui a rempli quoi, quand": every auto-written figure can be traced
-- to its origin — device derivation from the trade's own prices, broker
-- record, or a coach proposal the trader explicitly confirmed.
--
-- One row per (trade, kind) write; costs and R are separate decisions with
-- separate timestamps. Insert-only by design: history is appended, never
-- rewritten — a correction is a new row, which is also what makes a failed
-- partial batch harmless to replay.
--
-- Deliberately NOT a general write audit: edits made by hand in the trade
-- form are the trader's own and carry no provenance problem. Only the two
-- writer surfaces that act FOR the trader are tracked.
-- ---------------------------------------------------------------------------
create table if not exists public.trade_fill_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  trade_id   uuid not null references public.trades(id) on delete cascade,
  -- Which surface wrote the value. Every 'chat' row was still confirmed by
  -- the trader in the UI — the coach cannot write — so 'chat' names the
  -- ORIGIN of the proposal, not an unsupervised writer. 'auto' marks the
  -- background completion that runs after each bridge sync: same device
  -- derivation as the button, no press because the trader already opted in
  -- by connecting the bridge. 'user' marks a REVERSAL: an undo from the
  -- history pressed by the trader.
  source     text not null check (source in ('app_button','chat','auto','user')),
  -- What kind of value was written.
  kind       text not null check (kind in ('costs','r_multiple','tag','mental_state')),
  -- Numeric magnitude for costs (commission + swap, positive) and
  -- r_multiple (the derived R). 0 for the textual kinds.
  value      numeric not null default 0,
  -- The written value itself when it is text (tag, mental state).
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists trade_fill_history_trade_idx
  on public.trade_fill_history (trade_id, created_at desc);
create index if not exists trade_fill_history_user_idx
  on public.trade_fill_history (user_id, created_at desc);

-- The first release of this table shipped the CHECK without 'auto'; databases
-- created from it carry the narrow constraint and would reject the background
-- writer. Drop-and-recreate is idempotent and keeps one name.
alter table public.trade_fill_history
  drop constraint if exists trade_fill_history_source_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trade_fill_history'::regclass
      and conname = 'trade_fill_history_source_check'
  ) then
    alter table public.trade_fill_history
      add constraint trade_fill_history_source_check
      check (source in ('app_button','chat','auto','user'));
  end if;
end $$;

do $$
begin
  execute 'alter table public.trade_fill_history enable row level security';
  execute 'drop policy if exists trade_fill_history_owner on public.trade_fill_history';
  execute $policy$
    create policy trade_fill_history_owner on public.trade_fill_history
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
  $policy$;
end $$;

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
-- Consumer: src/features/guard/useChecklist.ts (the pre-flight).
-- Reads .order('sort_order').order('created_at'), updates { is_done }.
--
-- This table existed for a long time with NO reader: the comment here pointed
-- at a hook that was never written, and the dashboard showed no checklist. It
-- now backs the pre-flight (SECTION 10).
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
  add column if not exists broker_state_at  timestamptz,
  -- Version the attached EA reports in its heartbeat (EA v1.16+). NULL is a
  -- STATEMENT, not a gap: an older build has no field to fill, so a connector
  -- that beats and reports no version is one the app must not promise a
  -- completion request to. See src/features/sync/eaVersion.ts for the policy.
  add column if not exists ea_version       text,
  -- WHO is connected, as the terminal knows itself (EA v1.18+): the broker
  -- account number and the server name. The app's label is chosen by the
  -- trader and can drift from reality — the login cannot. Shown on the
  -- connector row so "which terminal is this, exactly" stops being a guess.
  add column if not exists broker_login     text,
  add column if not exists broker_server    text;

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

-- Macro context at entry: the high-impact release this trade sat next to.
--
-- The app already FETCHES the economic calendar (supabase/functions/calendar)
-- and shows it as a band on the dashboard, but nothing recorded it at the
-- moment of a trade -- so "do I lose money trading into CPI?" was a question
-- the journal could not answer, even though every fact needed to answer it
-- passed through the app twice.
--
-- `news_offset_min` is SIGNED on purpose: -3 is three minutes BEFORE the
-- release, +12 twelve minutes after. The two are not the same behaviour, and a
-- magnitude alone would erase the distinction the trader actually trades on.
-- NULL means "not recorded" (no calendar in cache at save time, or an older
-- app) and never "no news was published" -- the same rule the cost and
-- excursion columns follow.
alter table public.trades
  add column if not exists news_event      text,
  add column if not exists news_currency   text,
  add column if not exists news_offset_min int;

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
-- An already-RESOLVED row is skipped, not promoted again: an open position is
-- promoted while still open, which leaves its row `pending` on purpose (the
-- close event has to complete the trade). Reasoning on `status` alone would
-- re-create a second journal trade for the same position on a second tap.
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
    where t.user_id = v_uid and t.status = 'pending' and t.resolution is null
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
    --
    -- array_append, not `v_seeded || 'name'`: with a bare unknown literal,
    -- Postgres resolves `text[] || unknown` as ARRAY CONCATENATION and casts
    -- the literal to text[], so promotion failed wholesale with
    -- `malformed array literal: "mental_state"`. The element type has to be
    -- stated for the operator to be an append.
    v_seeded := array[]::text[];
    if nullif(v_over->>'mental_state','') is null then
      v_seeded := array_append(v_seeded, 'mental_state');
    end if;
    if nullif(v_over->>'timeframe','') is null
       and nullif(v_payload->>'timeframe','') is null then
      v_seeded := array_append(v_seeded, 'timeframe');
    end if;
    -- Context the bridge never carries at all.
    v_seeded := array_append(v_seeded, 'setup');
    v_seeded := array_append(v_seeded, 'notes');

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
    -- Levels the entry event never carried, gap-filled exactly like
    -- apply_broker_refresh: a position promoted while OPEN was journaled from
    -- an event without stop/target, and without this the close left the trade
    -- with an R computed from a stop it does not display. Only EMPTY values
    -- are written: a level the trader set is never overwritten.
    --
    -- mae_price/mfe_price are gap-only too. A normal scan sends no excursion
    -- (the M1 walk is only done on request), so assigning them verbatim wiped
    -- whatever a back-fill had already recovered — a close event must not be
    -- able to destroy the data it took a request to obtain.
    stop_loss   = case
      when coalesce((v_row.payload->>'stop_loss')::numeric, 0) > 0
           and (stop_loss is null or stop_loss = 0)
        then (v_row.payload->>'stop_loss')::numeric else stop_loss end,
    take_profit = case
      when coalesce((v_row.payload->>'take_profit')::numeric, 0) > 0
           and (take_profit is null or take_profit = 0)
        then (v_row.payload->>'take_profit')::numeric else take_profit end,
    mae_price   = coalesce(mae_price, (v_row.payload->>'mae_price')::numeric),
    mfe_price   = coalesce(mfe_price, (v_row.payload->>'mfe_price')::numeric),
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

  -- resolution is null: a row that already produced a journal trade (or was
  -- linked/dismissed) is a decision already made, and re-linking it would
  -- leave the trade the promote path created behind.
  select * into v_row from public.sync_trades
  where id = p_staging_id and user_id = auth.uid()
    and status = 'pending' and resolution is null
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
  -- resolution is null: dismissing a row whose journal trade already exists
  -- would strand that trade. sync-ingest skips dismissed rows, so the broker's
  -- close event could never complete it.
  update public.sync_trades
     set status = 'dismissed',
         resolution = 'dismissed',
         dismiss_reason = left(coalesce(p_reason, 'not_mine'), 40),
         resolved_at = now(),
         resolved_by = 'user'
   where id = p_staging_id and user_id = auth.uid()
     and status = 'pending' and resolution is null;
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
     and status = 'pending'
     and resolution is null;
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

-- Connector creation runs server-side so the secret is born from server
-- entropy, never from client randomness, and never transits a client-side
-- generator. Returns the row including the plaintext secret ONCE; nothing
-- ever exposes it again (rotate = replace, same one-time display).
--
-- The secret comes from TWO gen_random_uuid() concatenated: 64 hex chars,
-- 256 bits, URL-safe. Deliberately NOT pgcrypto's gen_random_bytes: the
-- extension lives in the `extensions` schema on Supabase, which a SECURITY
-- DEFINER pinned to search_path = public cannot see — rotation failed at
-- runtime with "function gen_random_bytes(integer) does not exist" even
-- though CREATE had succeeded (plpgsql binds function bodies late).
-- gen_random_uuid is built into PostgreSQL 13+: no extension, no placement
-- surprise.
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
    -- Hex-only: URL-safe, fits a Bearer header cleanly.
    replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', ''),
    p_account_id
  )
  returning * into v_acc;

  return v_acc;
end;
$$;

grant execute on function public.create_sync_ingest_account(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- sync.connector management — rename, rotate, pause
--
-- The only repair path used to be "delete the connector and create it again",
-- which is the wrong answer to both things a trader actually needs:
--   * a label that no longer describes the feed ("MT5 #2" on the account they
--     now route to their funded challenge);
--   * a secret that leaked (pasted in a screenshot, shared with a VPS owner,
--     committed in a script). Rotating it is one UPDATE here — the row, its
--     routing and its queue stay exactly where they are.
-- Deleting instead would cascade into sync_trades and sync_raw_events and
-- orphan the promoted trades' provenance, for a credential change.
--
-- Only the ROTATION ever hands a credential back, and only the new one, once
-- (creation and rotation are the plaintext's only two appearances). Renaming
-- and pausing return nothing. Pausing is the third repair: a feed can be
-- silenced without losing its history.
-- ---------------------------------------------------------------------------

-- Rename a connector. Uniqueness is re-checked HERE, case-insensitively, so
-- the app gets a sentence instead of a 23505 from the (case-sensitive) table
-- constraint; the constraint stays as the backstop for every other writer.
-- Returns void on purpose: returning the row would send the stored secret
-- back to the client, and the whole contract is that the plaintext exists in
-- exactly two moments — creation and rotation.
create or replace function public.rename_sync_ingest_account(
  p_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'P0001: unauthenticated';
  end if;

  -- Whitespace is collapsed before truncation so "  MT5   #1 " and "MT5 #1"
  -- cannot both exist as separate names.
  v_label := left(regexp_replace(btrim(coalesce(p_label, '')), '\s+', ' ', 'g'), 60);
  if v_label = '' then
    raise exception 'P0001: empty connector label';
  end if;

  if exists (
    select 1 from public.sync_ingest_accounts
    where user_id = auth.uid()
      and id <> p_id
      and lower(label) = lower(v_label)
  ) then
    raise exception 'P0001: connector label already used';
  end if;

  update public.sync_ingest_accounts
     set label = v_label
   where id = p_id and user_id = auth.uid();

  if not found then
    raise exception 'P0001: unknown connector';
  end if;
end;
$$;

grant execute on function public.rename_sync_ingest_account(uuid, text) to authenticated;
revoke execute on function public.rename_sync_ingest_account(uuid, text) from anon;

-- Rotate a connector's secret: same row, same id, same routing, same queue,
-- new credential. Returns the row including the plaintext secret ONCE —
-- exactly like create_sync_ingest_account, and for the same reason: the app
-- has to show it, and nothing exposes it afterwards.
--
-- The sync bookkeeping is reset because it described the OLD credential's
-- health: leaving "Connecté, il y a 2 min" on a connector whose secret just
-- changed would be the app claiming news it cannot have. Broker state and the
-- resolved staging rows stay: they are history, not credentials.
create or replace function public.rotate_sync_ingest_secret(p_id uuid)
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

  -- Two UUIDs = 64 hex chars = 256 bits, from the OS entropy pool. NOT
  -- pgcrypto's gen_random_bytes: see create_sync_ingest_account — the
  -- extension is invisible to search_path = public, which is exactly the
  -- "function does not exist" the trader saw mid-rotation.
  update public.sync_ingest_accounts
     set secret           = replace(gen_random_uuid()::text, '-', '')
                            || replace(gen_random_uuid()::text, '-', ''),
         last_sync_at     = null,
         last_sync_status = null,
         last_error       = null
   where id = p_id and user_id = auth.uid()
  returning * into v_acc;

  if not found then
    raise exception 'P0001: unknown connector';
  end if;

  return v_acc;
end;
$$;

grant execute on function public.rotate_sync_ingest_secret(uuid) to authenticated;
revoke execute on function public.rotate_sync_ingest_secret(uuid) from anon;

-- Pause / resume a feed. The ingest function already refuses a disabled
-- connector (403 connector_disabled), so a single flag is the whole feature:
-- nothing is deleted, nothing is unlinked, and resuming restores the same
-- queue and the same routing.
-- Also void, for the same reason as the rename.
create or replace function public.set_sync_ingest_active(
  p_id uuid,
  p_is_active boolean
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

  update public.sync_ingest_accounts
     set is_active = coalesce(p_is_active, true)
   where id = p_id and user_id = auth.uid();

  if not found then
    raise exception 'P0001: unknown connector';
  end if;
end;
$$;

grant execute on function public.set_sync_ingest_active(uuid, boolean) to authenticated;
revoke execute on function public.set_sync_ingest_active(uuid, boolean) from anon;

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
  -- Guard BOTH the schema and the table: a project can have pg_cron ENABLED
  -- (the cron schema exists) without cron.job yet (the extension's objects
  -- land in the schema only after its CREATE EXTENSION completes / on next
  -- connect). Probing cron.job there raises `relation does not exist`, which
  -- kills any multi-statement execution of this file (SQL Editor runs it in
  -- ONE transaction) — everything after this block silently never applied.
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (
       select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'cron' and c.relname = 'job'
     ) then
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

-- ============================================================================
-- SECTION 5 — BROKER BACK-FILL REQUESTS (the chat -> EA round trip)
--
-- The bridge is write-only, so the app cannot "pull" a missing stop, target
-- or excursion from the terminal. It does not have to: the EA can rebuild any
-- position from its own history, including the MAE/MFE the close event never
-- carried (computed from M1 highs/lows over the position's lifetime). The
-- missing piece was a queue the EA can poll.
--
-- Flow: the coach proposes request_broker_fill on bridge-sourced trades ->
-- request_broker_fill() queues one row per staging id -> the EA's periodic
-- poll ("type":"poll_requests") receives the external ids and re-sends those
-- positions enriched with stop_loss/take_profit/mae_price/mfe_price ->
-- sync-ingest refreshes the already-promoted journal trades through
-- apply_broker_refresh(). The refresh is strictly gap-filling: a value the
-- trader has set is never overwritten, and no journal row is ever created by
-- this path (promotion remains the only door).
-- ============================================================================

create table if not exists public.sync_requests (
  id uuid primary key default gen_random_uuid(),
  ingest_account_id uuid not null references public.sync_ingest_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_ids text[] not null,
  -- Reserved for narrowing the rebuild; v1 always asks for everything the
  -- bridge can recover, so the EA does not need to branch per field.
  fields text[] not null default array['stop_loss','take_profit','mae','mfe'],
  status text not null default 'pending' check (status in ('pending','served')),
  created_at timestamptz not null default now(),
  served_at timestamptz
);

create index if not exists sync_requests_pending_idx
  on public.sync_requests (ingest_account_id, created_at)
  where status = 'pending';

alter table public.sync_requests enable row level security;
drop policy if exists sync_requests_owner on public.sync_requests;
create policy sync_requests_owner on public.sync_requests
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Queue one back-fill request per pending bridge position. Bridge-sourced
-- only (a manual trade has no staging row, so the terminal cannot help) and
-- deduplicated while a request is still unserved: tapping the confirmation
-- twice must not double the EA's work.
create or replace function public.request_broker_fill(p_trade_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int := 0;
  r record;
begin
  if v_uid is null or p_trade_ids is null or cardinality(p_trade_ids) = 0 then
    raise exception 'P0001: invalid request';
  end if;

  for r in
    select s.id as staging_id, s.ingest_account_id, s.external_id
    from public.trades t
    join public.sync_trades s on s.id = t.sync_source_id
    where t.id = any(p_trade_ids)
      and t.user_id = v_uid
      and s.user_id = v_uid
      and not exists (
        select 1 from public.sync_requests q
        where q.ingest_account_id = s.ingest_account_id
          and q.status = 'pending'
          and s.external_id = any(q.external_ids)
      )
  loop
    insert into public.sync_requests (ingest_account_id, user_id, external_ids)
    values (r.ingest_account_id, v_uid, array[r.external_id]);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.request_broker_fill(uuid[]) to authenticated;
revoke execute on function public.request_broker_fill(uuid[]) from anon;

-- Refresh ONE journal trade from the broker's rebuilt event. Called by the
-- sync-ingest function under the service role (auth.uid() is null there),
-- which is why ownership is re-checked against BOTH the claimed user and the
-- connector: a caller that knows ids but not the secret gets nothing, and
-- one connector cannot touch another's trades. Every assignment only fills
-- an EMPTY value -- this path must never be able to overwrite the trader.
create or replace function public.apply_broker_refresh(
  p_user_id uuid,
  p_ingest_id uuid,
  p_trade_id uuid,
  p_stop_loss numeric default null,
  p_take_profit numeric default null,
  p_mae numeric default null,
  p_mfe numeric default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tgt uuid;
begin
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'P0001: forbidden';
  end if;

  select t.id into v_tgt
  from public.trades t
  join public.sync_trades s on s.id = t.sync_source_id
  where t.id = p_trade_id
    and t.user_id = p_user_id
    and s.ingest_account_id = p_ingest_id;
  if not found then
    return 0;
  end if;

  update public.trades set
    stop_loss = case
      when p_stop_loss is not null and p_stop_loss > 0
           and (stop_loss is null or stop_loss = 0)
        then p_stop_loss else stop_loss end,
    take_profit = case
      when p_take_profit is not null and p_take_profit > 0
           and (take_profit is null or take_profit = 0)
        then p_take_profit else take_profit end,
    mae_price = coalesce(mae_price, p_mae),
    mfe_price = coalesce(mfe_price, p_mfe)
  where id = v_tgt;

  return 1;
end;
$$;

revoke execute on function public.apply_broker_refresh(uuid, uuid, uuid, numeric, numeric, numeric, numeric) from anon, authenticated;

-- ============================================================================
-- SECTION 8 — PUSH SERVEUR (alertes qui atteignent le trader hors de l'app)
-- ============================================================================
-- Why this exists
--
-- Every notification the app fires today is LOCAL (src/features/
-- notifications): a journaling reminder, a risk warning triggered from the
-- gauge, a Sunday review prompt. All three need the app open -- which is
-- exactly the situation the two most expensive failures never happen in:
--
--   * a terminal that STOPPED reporting. The auto-journal goes quiet, the
--     history fills with holes, and the trader finds out days later, when the
--     trades are no longer reconstructible;
--   * a lock that JUST fired (loss limit, personal rule). That is the minute
--     the trader must be told, because the next trade is the one that hurts.
--
-- The server already knows both -- sync_ingest_accounts.last_sync_at and
-- daily_session_locks -- and has the numbers for a third (today's realised
-- loss against effective_daily_loss_limit). What was missing was the channel
-- and the memory.
--
-- The memory is push_alerts plus a CLAIM: the sweep runs on a schedule, and
-- claim_push_alert() only answers true once the cooldown has elapsed, so a
-- sweep every fifteen minutes tells the trader ONCE -- not ninety-six times.
-- Two sweeps racing cannot double-send: the claim is a single atomic write.
-- ============================================================================

-- Device tokens. One row per DEVICE, not per user: the token identifies the
-- handset, so a second login on the same phone rebinds this row instead of
-- creating a copy that would multiply every alert by two.
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('ios','android')),
  -- Language of the device at registration time. A push is composed by the
  -- DATABASE, long before the app can translate anything, so the preference
  -- has to live here or every alert would arrive in French.
  locale      text not null default 'fr' check (locale in ('fr','en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Set when Expo answers DeviceNotRegistered. The row stays: the app may hand
  -- the same token back after a reinstall, and that must revive this row
  -- rather than insert a second one.
  disabled_at timestamptz
);

create index if not exists push_tokens_user_live_idx
  on public.push_tokens (user_id) where disabled_at is null;

-- The alert ledger. One row per (user, kind, subject); the subject is what
-- the alert is ABOUT (a connector id, or the trading day for a lock), so one
-- silent connector never mutes another.
create table if not exists public.push_alerts (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  kind     text not null check (kind in ('connector_silent','lock','risk')),
  subject  text not null,
  sent_at  timestamptz not null default now(),
  detail   jsonb,
  unique (user_id, kind, subject)
);

create index if not exists push_alerts_user_time_idx
  on public.push_alerts (user_id, sent_at desc);

alter table public.push_tokens enable row level security;
alter table public.push_alerts enable row level security;

drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Read-only for the owner. The ledger is written by the sweep under the
-- service role; a client writing it could silence its own alerts, which is
-- the one thing this table exists to prevent.
drop policy if exists push_alerts_owner on public.push_alerts;
create policy push_alerts_owner on public.push_alerts
  for select to authenticated
  using (auth.uid() = user_id);

-- Registration. Security definer because of the rebind: when a phone changes
-- hands (or the same phone signs into another account) the row must follow the
-- SESSION, and the unique constraint on the token is what makes that possible.
create or replace function public.register_push_token(
  p_token    text,
  p_platform text,
  p_locale   text default 'fr'
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
    raise exception 'P0001: not authenticated';
  end if;
  if p_token is null or length(p_token) < 10 or length(p_token) > 255 then
    raise exception 'P0001: invalid token';
  end if;
  if p_platform not in ('ios','android') then
    raise exception 'P0001: invalid platform';
  end if;

  insert into public.push_tokens (user_id, token, platform, locale)
  values (v_uid, p_token, p_platform, case when p_locale = 'en' then 'en' else 'fr' end)
  on conflict (token) do update
    set user_id     = v_uid,
        platform    = excluded.platform,
        locale      = excluded.locale,
        updated_at  = now(),
        disabled_at = null;
end;
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;
revoke execute on function public.register_push_token(text, text, text) from anon;

-- Called on sign-out. The device stops receiving the previous account's
-- alerts immediately, without depending on the app being online again.
create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  delete from public.push_tokens where token = p_token and user_id = v_uid;
end;
$$;

grant execute on function public.unregister_push_token(text) to authenticated;
revoke execute on function public.unregister_push_token(text) from anon;

-- The claim. Returns true only if this call is the one allowed to send: the
-- insert conflicts on an existing alert and the update is gated by the
-- cooldown, so the row is returned exactly once per cooldown window.
create or replace function public.claim_push_alert(
  p_user     uuid,
  p_kind     text,
  p_subject  text,
  p_detail   jsonb,
  p_cooldown interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.push_alerts (user_id, kind, subject, detail)
  values (p_user, p_kind, p_subject, p_detail)
  on conflict (user_id, kind, subject) do update
    set sent_at = now(),
        detail  = excluded.detail
    where public.push_alerts.sent_at < now() - p_cooldown
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- Service-role only: it writes alert rows and reads every account.
revoke execute on function public.claim_push_alert(uuid, text, text, jsonb, interval)
  from anon, authenticated;

-- ============================================================================
-- The sweep
--
-- One row per alert that is DUE. Claiming happens here, inside the same
-- transaction as the read that decided the alert was due, so the decision and
-- the memory cannot drift apart. The caller (supabase/functions/push) only
-- has to deliver what it is given.
--
-- Text is composed here, in the recipient's locale: an OS push is rendered
-- without the app running, so it cannot be translated later.
-- ============================================================================
create or replace function public.push_sweep(
  p_silent_minutes int      default 45,
  p_risk_pct       numeric  default 70,
  p_cooldown       interval default interval '6 hours'
)
returns table (user_id uuid, kind text, subject text, title text, body text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_locale text;
begin
  -- ---- 1. A terminal that went quiet, or never showed up. ----------------
  -- `created_at < now() - 1h` spares the connector a fresh install is still
  -- configuring: alerting on a secret the trader is still pasting would train
  -- them to ignore the alert.
  for r in
    select a.user_id, a.id, a.label, a.last_sync_at,
           (select t.locale from public.push_tokens t
             where t.user_id = a.user_id and t.disabled_at is null
             order by t.updated_at desc limit 1) as locale
    from public.sync_ingest_accounts a
    where a.is_active
      and a.created_at < now() - interval '1 hour'
      and (a.last_sync_at is null
           or a.last_sync_at < now() - make_interval(mins => p_silent_minutes))
  loop
    v_locale := coalesce(r.locale, 'fr');

    if public.claim_push_alert(
         r.user_id, 'connector_silent', r.id::text,
         jsonb_build_object('label', r.label, 'last_sync_at', r.last_sync_at),
         p_cooldown
       ) then
      return query select
        r.user_id,
        'connector_silent',
        r.id::text,
        case when r.last_sync_at is null
             then case when v_locale = 'en' then 'Connector never seen' else 'Connecteur jamais vu' end
             else case when v_locale = 'en' then 'Terminal silent' else 'Terminal muet' end
        end,
        case when r.last_sync_at is null
             then case when v_locale = 'en'
                       then format('%s has never contacted the server. Check the URL and the secret in the terminal.', r.label)
                       else format('%s n''a jamais contacté le serveur. Vérifiez l''URL et le secret dans le terminal.', r.label)
                  end
             else case when v_locale = 'en'
                       then format('%s has sent nothing since %s UTC. Is the auto-journal still running?', r.label, to_char(r.last_sync_at at time zone 'UTC', 'DD/MM HH24:MI'))
                       else format('%s n''a rien envoyé depuis %s UTC. Le journal auto tourne-t-il encore ?', r.label, to_char(r.last_sync_at at time zone 'UTC', 'DD/MM HH24:MI'))
                  end
        end;
    end if;
  end loop;

  -- ---- 2. A lock that just fired. ----------------------------------------
  -- Keyed on locked_at rather than the row's date: the date is the trader's
  -- LOCAL trading day, and the sweep has no idea which timezone wrote it.
  -- The exact rule is deliberately NOT in the notification -- the app renders
  -- it from lock_code, localized; here the only job is to pull the trader in.
  for r in
    select l.user_id, l.date, l.id,
           (select t.locale from public.push_tokens t
             where t.user_id = l.user_id and t.disabled_at is null
             order by t.updated_at desc limit 1) as locale
    from public.daily_session_locks l
    where l.is_locked
      and l.locked_at > now() - interval '1 day'
  loop
    v_locale := coalesce(r.locale, 'fr');

    if public.claim_push_alert(
         r.user_id, 'lock', r.date::text,
         jsonb_build_object('date', r.date),
         p_cooldown
       ) then
      return query select
        r.user_id,
        'lock',
        r.date::text,
        case when v_locale = 'en' then 'Session locked' else 'Session verrouillée' end,
        case when v_locale = 'en'
             then 'Your trading day is locked. Open the app to see which rule fired.'
             else 'Votre journée de trading est verrouillée. Ouvrez l''app pour voir la règle déclenchée.'
        end;
    end if;
  end loop;

  -- ---- 3. Daily loss allowance nearly spent. -----------------------------
  -- The same shape the gauge uses: realised loss TODAY, in the account's own
  -- trading day, against its effective limit. Alerts below the threshold are
  -- left to the in-app gauge -- a notification for every 10% step would be
  -- noise, and noise is how a real alert gets ignored.
  for r in
    with acc_limits as (
      select a.*, public.effective_daily_loss_limit(a) as lim
      from public.trading_accounts a
    )
    select al.user_id, al.id, al.name, al.lim,
           al.currency,
           -sum(t.pnl) as loss,
           (select t.locale from public.push_tokens t
             where t.user_id = al.user_id and t.disabled_at is null
             order by t.updated_at desc limit 1) as locale
    from acc_limits al
    join public.trades t
      on t.account_id = al.id
     and t.user_id = al.user_id
     and t.pnl is not null
     and public.account_trading_day(coalesce(t.exit_time, t.entry_time), al.timezone)
         = public.account_trading_day(now(), al.timezone)
    where al.lim > 0
    group by al.user_id, al.id, al.name, al.lim, al.currency
    having sum(t.pnl) < 0
       and -sum(t.pnl) >= al.lim * (p_risk_pct / 100.0)
  loop
    v_locale := coalesce(r.locale, 'fr');

    if public.claim_push_alert(
         r.user_id, 'risk', r.id::text,
         jsonb_build_object('loss', r.loss, 'limit', r.lim, 'account', r.name),
         p_cooldown
       ) then
      return query select
        r.user_id,
        'risk',
        r.id::text,
        case when v_locale = 'en' then 'Daily risk' else 'Risque quotidien' end,
        case when v_locale = 'en'
             then format('%s: %s%% of the daily loss limit used. There is little room left.', r.name, round(100 * r.loss / r.lim))
             else format('%s : %s%% de la limite de perte quotidienne utilisée. Il reste peu de marge.', r.name, round(100 * r.loss / r.lim))
        end;
    end if;
  end loop;
end;
$$;

-- Service-role only (see the function's own note): the Edge Function calls it
-- with the service role, and nothing else in the app may. A trader triggering
-- their own sweep could only spam themselves, but the ledger is not a client
-- concern either way.
revoke execute on function public.push_sweep(int, numeric, interval) from anon, authenticated;

-- ============================================================================
-- SECTION 9 — TRADE REPLAY (les bougies du terminal)
-- ============================================================================
-- Why this exists
--
-- The journal can show a summary of a trade with the best screenshot the
-- trader remembered to take. It cannot show what the price DID — and the price
-- is the only thing that answers "was my stop too tight?", "did I exit into
-- the first pullback?", "did I enter three candles before the move?".
--
-- The window to ask is short and known: the terminal holds M1 history locally
-- (the EA already walks it for MAE/MFE, via CopyRates), and it is the same
-- machine that reported the trade. So the app asks for the candles around ONE
-- position, once, and caches them — the terminal is not a market data vendor,
-- it answers a question and goes back to sleep.
--
-- Same round trip as the back-fill (SECTION 5), deliberately: pending requests
-- ride along in the heartbeat RESPONSE and are marked served when handed over,
-- so no polling loop was added anywhere. What is new is only the KIND of
-- request, and a type of payload coming back.
-- ============================================================================

alter table public.sync_requests
  add column if not exists kind text not null default 'backfill'
    check (kind in ('backfill','candles')),
  add column if not exists timeframe text not null default 'M1'
    check (timeframe in ('M1','M5','M15'));

-- The bars themselves. Keyed on the staging row (ingest_account_id,
-- external_id) because that is what the terminal knows: it answers about a
-- POSITION, and only the server can say which journal trade that became.
-- `trade_id` is filled in at write time for exactly that reason — the app
-- reads candles by trade, never by broker position id.
create table if not exists public.trade_candles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  ingest_account_id uuid not null references public.sync_ingest_accounts(id) on delete cascade,
  trade_id          uuid references public.trades(id) on delete cascade,
  external_id       text not null,
  timeframe         text not null default 'M1',
  -- [{ t, o, h, l, c }, ...] exactly as the terminal produced it. Kept as
  -- jsonb, not rows: the app renders one chart and never queries a bar.
  bars              jsonb not null,
  -- True when the terminal had to cap the window. Surfaced, never hidden: a
  -- partial chart that claims to be complete is worse than no chart.
  truncated         boolean not null default false,
  fetched_at        timestamptz not null default now(),
  unique (ingest_account_id, external_id, timeframe)
);

create index if not exists trade_candles_trade_idx
  on public.trade_candles (trade_id);

alter table public.trade_candles enable row level security;
drop policy if exists trade_candles_owner on public.trade_candles;
create policy trade_candles_owner on public.trade_candles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Ask the terminal for the candles of these journal trades. Same shape as
-- request_broker_fill: bridge-sourced trades only (a hand-typed trade has no
-- terminal to ask), one request per position, deduplicated while a request is
-- still pending — asking twice must not make the EA do the work twice.
create or replace function public.request_candles(p_trade_ids uuid[], p_timeframe text default 'M1')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tf  text := case when p_timeframe in ('M1','M5','M15') then p_timeframe else 'M1' end;
  v_count int := 0;
  r record;
begin
  if v_uid is null or p_trade_ids is null or cardinality(p_trade_ids) = 0 then
    raise exception 'P0001: invalid request';
  end if;

  for r in
    select s.ingest_account_id, s.external_id
    from public.trades t
    join public.sync_trades s on s.id = t.sync_source_id
    where t.id = any(p_trade_ids)
      and t.user_id = v_uid
      and s.user_id = v_uid
      and not exists (
        select 1 from public.sync_requests q
        where q.ingest_account_id = s.ingest_account_id
          and q.status = 'pending'
          and q.kind = 'candles'
          and s.external_id = any(q.external_ids)
      )
  loop
    insert into public.sync_requests (ingest_account_id, user_id, external_ids, fields, kind, timeframe)
    values (r.ingest_account_id, v_uid, array[r.external_id], array['candles'], 'candles', v_tf);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.request_candles(uuid[], text) to authenticated;
revoke execute on function public.request_candles(uuid[], text) from anon;

-- Store what came back. Service role only (called by sync-ingest): the payload
-- is a broker artifact, not something a client may fabricate into its own
-- history. `trade_id` is resolved from the staging row so the app can read
-- candles by trade; when the position was never promoted the row is still
-- stored, keyed on the staging identity, and simply never read.
create or replace function public.store_trade_candles(
  p_user_id    uuid,
  p_ingest_id  uuid,
  p_external_id text,
  p_timeframe  text,
  p_bars       jsonb,
  p_truncated  boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade uuid;
  v_tf    text := case when p_timeframe in ('M1','M5','M15') then p_timeframe else 'M1' end;
  v_id    uuid;
begin
  if p_user_id is null or p_ingest_id is null or p_external_id is null then
    return null;
  end if;
  if p_bars is null or jsonb_typeof(p_bars) <> 'array' or jsonb_array_length(p_bars) = 0 then
    return null;
  end if;

  select t.id into v_trade
  from public.trades t
  join public.sync_trades s on s.id = t.sync_source_id
  where t.user_id = p_user_id
    and s.ingest_account_id = p_ingest_id
    and s.external_id = p_external_id
  limit 1;

  insert into public.trade_candles
    (user_id, ingest_account_id, trade_id, external_id, timeframe, bars, truncated, fetched_at)
  values
    (p_user_id, p_ingest_id, v_trade, p_external_id, v_tf, p_bars, coalesce(p_truncated, false), now())
  on conflict (ingest_account_id, external_id, timeframe) do update
    set bars       = excluded.bars,
        truncated  = excluded.truncated,
        trade_id   = coalesce(excluded.trade_id, public.trade_candles.trade_id),
        fetched_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.store_trade_candles(uuid, uuid, text, text, jsonb, boolean)
  from anon, authenticated;

-- ============================================================================
-- SECTION 10 — PRE-VOL (la checklist avant le premier trade du jour)
-- ============================================================================
-- Why this exists
--
-- The Lock Guard fires when the damage is done: it counts losses, trades taken
-- and rules broken, all of which are already facts. A checklist is the only
-- discipline device that acts BEFORE the trade — and it is the one every desk
-- in the world uses, for the same reason: "je le savais" is not a rule.
--
-- user_checklists holds the trader's OWN items (the same table, finally read).
-- This section adds the second half: what happened on a given day. Kept
-- separate from the items on purpose — editing a checklist six months later
-- must not rewrite what the trader actually agreed to before that session.
-- ============================================================================

create table if not exists public.checklist_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- The trader's LOCAL day, like daily_session_locks.date: "done today" is a
  -- statement about their session, not about UTC. The client sends its own
  -- date for exactly that reason.
  date         date not null,
  completed_at timestamptz not null default now(),
  -- The items as they were ticked, kept as a snapshot.
  items        jsonb not null default '[]'::jsonb,
  unique (user_id, date)
);

create index if not exists checklist_completions_user_idx
  on public.checklist_completions (user_id, date desc);

alter table public.checklist_completions enable row level security;
drop policy if exists checklist_completions_owner on public.checklist_completions;
create policy checklist_completions_owner on public.checklist_completions
  for select to authenticated
  using (auth.uid() = user_id);

-- Created through a function, not a client INSERT: the (user_id, date) row is
-- an upsert and the RLS policy above is read-only, so a re-tick on the same
-- day must go through something that can write the owner's row safely.
create or replace function public.complete_preflight(p_date date, p_items jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'P0001: not authenticated';
  end if;
  if p_date is null then
    raise exception 'P0001: invalid date';
  end if;

  insert into public.checklist_completions (user_id, date, items)
  values (v_uid, p_date, coalesce(p_items, '[]'::jsonb))
  on conflict (user_id, date) do update
    set completed_at = now(),
        items        = excluded.items;
end;
$$;

grant execute on function public.complete_preflight(date, jsonb) to authenticated;
revoke execute on function public.complete_preflight(date, jsonb) from anon;

-- ---------------------------------------------------------------------------
-- Scheduling the sweep
--
-- pg_cron + pg_net turn the sweep into a job; both ship with Supabase. The
-- block is deliberately FAIL-SOFT: a database without the extensions, or one
-- where app.push_url / app.push_secret have not been set, schedules nothing
-- and says so. The function can always be called by hand or by any external
-- scheduler, so nothing here is load-bearing.
--
--   ALTER DATABASE postgres SET app.push_url    = 'https://<ref>.supabase.co/functions/v1/push';
--   ALTER DATABASE postgres SET app.push_secret = '<the same value as PUSH_CRON_SECRET>';
--
-- Re-run this schema afterwards; the ALTERs only take effect on a new session.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'push sweep not scheduled: pg_cron and pg_net are required';
    return;
  end if;

  if current_setting('app.push_url', true) is null then
    raise notice 'push sweep not scheduled: app.push_url is not set (see the note above)';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'seven_push_sweep') then
    perform cron.unschedule('seven_push_sweep');
  end if;

  perform cron.schedule('seven_push_sweep', '*/15 * * * *', $job$
    select net.http_post(
      url     := current_setting('app.push_url', true),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'x-cron-secret', current_setting('app.push_secret', true)
                 ),
      body    := '{}'::jsonb
    );
  $job$);

  raise notice 'push sweep scheduled every 15 minutes';
exception when others then
  -- Never fail the schema over a schedule: the tables and functions above are
  -- what the app needs, and the sweep can be driven from anywhere.
  raise notice 'push sweep not scheduled: %', sqlerrm;
end $$;
