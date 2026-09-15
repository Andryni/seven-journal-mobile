-- ============================================================================
-- Prop-firm rule engine, server side.
--
-- Previously `checkAndApplyDailyLock` ran in the React Native client on every
-- trade mutation. Three problems:
--   1. It could be bypassed (patched client, direct API call) — yet the
--      product principle says "Lock Guard sacré, never circumventable".
--   2. It refetched trades + accounts on every single mutation.
--   3. The lock reason was a hardcoded French string, breaking i18n.
--
-- This moves enforcement into Postgres as a trigger, so the lock is applied
-- inside the same transaction as the trade regardless of who is writing.
-- The reason is stored as a structured code + JSON params; the client renders
-- the localized sentence.
-- ============================================================================

-- Structured reason so the app can translate it.
alter table public.daily_session_locks
  add column if not exists lock_code text,
  add column if not exists lock_params jsonb;

comment on column public.daily_session_locks.lock_code is
  'Machine-readable reason, e.g. DAILY_LOSS_LIMIT. Client maps it to an i18n key.';
comment on column public.daily_session_locks.lock_params is
  'Interpolation values for the localized message (account, loss, limit).';

-- ---------------------------------------------------------------------------
-- Effective daily loss limit for an account: explicit limit, else 1% of the
-- initial balance (matching the previous client-side fallback).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Evaluate one account for one local trading day and lock it if the realised
-- loss reached the limit.
-- ---------------------------------------------------------------------------
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
    and (entry_time at time zone 'UTC')::date = p_day;

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
      set is_locked  = true,
          locked_at  = coalesce(public.daily_session_locks.locked_at, now()),
          sl_count   = excluded.sl_count,
          lock_code  = excluded.lock_code,
          lock_params = excluded.lock_params,
          lock_reason = excluded.lock_reason;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: re-evaluate on every write to trades.
-- ---------------------------------------------------------------------------
create or replace function public.trades_enforce_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trades%rowtype;
begin
  v_row := coalesce(new, old);
  perform public.enforce_daily_loss_limit(
    v_row.user_id,
    v_row.account_id,
    (v_row.entry_time at time zone 'UTC')::date
  );
  return null;
end;
$$;

drop trigger if exists trg_trades_enforce_lock on public.trades;
create trigger trg_trades_enforce_lock
  after insert or update or delete on public.trades
  for each row execute function public.trades_enforce_lock();

-- ---------------------------------------------------------------------------
-- Read-only snapshot of prop-firm rule state, so the app stops recomputing
-- drawdown / consistency locally on every render.
-- ---------------------------------------------------------------------------
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
  v_today date := (now() at time zone 'UTC')::date;
begin
  select * into v_account
  from public.trading_accounts
  where id = p_account_id and user_id = auth.uid();

  if not found then
    return;
  end if;

  daily_limit := public.effective_daily_loss_limit(v_account);

  select coalesce(abs(least(sum(pnl), 0)), 0) into daily_used
  from public.trades
  where account_id = p_account_id
    and user_id = auth.uid()
    and (entry_time at time zone 'UTC')::date = v_today;

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
    group by (entry_time at time zone 'UTC')::date
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
