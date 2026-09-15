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
  add column if not exists challenge_end_date       date;

-- Backfill before tightening, or the NOT NULL below fails on existing rows.
update public.trading_accounts
   set instrument_type = 'CFD'
 where instrument_type is null
    or instrument_type not in ('CFD','Futures','Crypto');

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
  created_at                timestamptz not null default now()
);

-- The app always filters by account and sorts by entry_time desc.
create index if not exists trades_user_account_time_idx
  on public.trades (user_id, account_id, entry_time desc);
create index if not exists trades_user_time_idx
  on public.trades (user_id, entry_time desc);

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

-- Evaluate one account for one trading day and lock it if the realised loss
-- reached the limit.
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
begin
  select * into v_account
  from public.trading_accounts
  where id = p_account_id and user_id = p_user_id;

  if not found then
    return;
  end if;

  v_limit := public.effective_daily_loss_limit(v_account);

  select coalesce(sum(pnl), 0),
         count(*) filter (where pnl < 0)
    into v_today_pnl, v_sl_count
  from public.trades
  where user_id = p_user_id
    and account_id = p_account_id
    and public.account_trading_day(entry_time, v_account.timezone) = p_day;

  if v_today_pnl < 0 and abs(v_today_pnl) >= v_limit then
    insert into public.daily_session_locks (
      user_id, date, sl_count, is_locked, locked_at, lock_code, lock_params, lock_reason
    )
    values (
      p_user_id,
      p_day,
      v_sl_count,
      true,
      now(),
      'DAILY_LOSS_LIMIT',
      jsonb_build_object(
        'account', v_account.name,
        'loss', abs(v_today_pnl),
        'limit', v_limit
      ),
      format('Daily loss limit reached on %s (%s / max %s).',
             v_account.name, abs(v_today_pnl), v_limit)
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
alter table public.playbook_setups     enable row level security;
alter table public.daily_debriefs      enable row level security;
alter table public.user_checklists     enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'trading_accounts','trades','daily_session_locks',
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
