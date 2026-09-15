-- ============================================================================
-- Seven Journal — complete database schema.
--
-- The repo only had two ALTER-TABLE migrations, so the base tables existed
-- nowhere in version control and the database could not be recreated from a
-- clean Supabase project. This file is the authoritative definition; the files
-- in migrations/ are incremental changes applied on top.
--
-- Apply order: schema.sql, then migrations/*.sql in filename order.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- trading_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.trading_accounts (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  type                    text not null default 'personal'
                            check (type in ('challenge','funded','personal','demo')),
  balance                 numeric not null default 0,
  initial_balance         numeric not null default 0,
  currency                text not null default 'USD',
  is_active               boolean not null default true,
  max_daily_loss_limit    numeric,
  max_drawdown_limit      numeric,
  drawdown_type           text check (drawdown_type in ('static','trailing')),
  profit_target           numeric,
  consistency_rule_percent numeric,
  instrument_type         text check (instrument_type in ('CFD','Futures')),
  challenge_end_date      date,
  created_at              timestamptz not null default now()
);

create index if not exists trading_accounts_user_idx
  on public.trading_accounts (user_id);

-- ---------------------------------------------------------------------------
-- trades
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
  lock_code   text,
  lock_params jsonb,
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- playbook_setups — was AsyncStorage-only, so setups never synced across
-- devices and vanished on reinstall.
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

-- ---------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null,
  position   int not null default 0,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.checklist_items is
  'Pre-session checklist. Verify column names against useChecklist.ts before applying.';

create index if not exists checklist_items_user_idx
  on public.checklist_items (user_id, position);

-- ============================================================================
-- Row Level Security — every table is strictly owner-scoped.
-- ============================================================================
alter table public.trading_accounts    enable row level security;
alter table public.trades              enable row level security;
alter table public.daily_session_locks enable row level security;
alter table public.playbook_setups     enable row level security;
alter table public.daily_debriefs      enable row level security;
alter table public.checklist_items     enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'trading_accounts','trades','daily_session_locks',
    'playbook_setups','daily_debriefs','checklist_items'
  ]
  loop
    execute format('drop policy if exists %I_owner on public.%I', tbl, tbl);
    execute format(
      'create policy %I_owner on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      tbl, tbl
    );
  end loop;
end $$;
