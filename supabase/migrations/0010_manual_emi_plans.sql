-- ============================================================================
-- Phase 11 — Manual EMI Plans (register an already-existing Credit Card EMI
-- without a source purchase transaction).
--
-- Every existing EMI plan is created via create_emi_plan(), which converts a
-- real Expense transaction into a plan — emi_plans.transaction_id is a
-- required FK to that transaction, and the plan's displayed "name" in the UI
-- is simply the original transaction's description/category (see
-- EmiSchedule.jsx / BillsPage.jsx). That path is completely untouched by
-- this migration.
--
-- This adds a second, separate creation path for an EMI the user already
-- has on their card — set up before they started using Forge, or from a
-- purchase Forge never recorded as a transaction. There is deliberately NO
-- purchase transaction for these, so:
--   - transaction_id is made nullable (it's still required, and still FK'd,
--     for every ordinary converted plan)
--   - a `source` column ('converted' | 'manual') distinguishes the two, and
--     a check constraint keeps them consistent with transaction_id
--   - a `name` column is added so a manual plan (which has no originating
--     transaction to borrow a label from) can be given its own, e.g.
--     "HDFC EMI 1" — required only when source = 'manual'
--
-- Manually registering an EMI never inserts into public.transactions, so
-- Credit Card outstanding (accountOutstanding() in App.jsx, derived purely
-- from transactions) is completely unaffected — the entire point of this
-- feature is that the EMI is already reflected in the card's outstanding,
-- and registering it here must not double-count it.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1) transaction_id is no longer required at the column level — still
-- required (and FK'd, and unique per user) for 'converted' plans via the
-- check constraint below, just no longer a blanket NOT NULL.
alter table public.emi_plans alter column transaction_id drop not null;

-- 2) New columns. `source` defaults every existing row to 'converted' (the
-- only kind that existed before this migration) — no backfill needed.
alter table public.emi_plans add column if not exists name text;
alter table public.emi_plans add column if not exists source text not null default 'converted';

alter table public.emi_plans
  drop constraint if exists emi_plans_source_check,
  add constraint emi_plans_source_check check (source in ('manual', 'converted'));

-- A converted plan must keep its transaction link; a manual plan must never
-- have one (there's nothing to link to) — makes "manual plan with a
-- transaction_id" or "converted plan without one" impossible to insert,
-- regardless of what the frontend sends.
alter table public.emi_plans
  drop constraint if exists emi_plans_source_transaction_consistency,
  add constraint emi_plans_source_transaction_consistency check (
    (source = 'converted' and transaction_id is not null) or
    (source = 'manual' and transaction_id is null)
  );

-- A manual plan has no transaction to borrow a display label from, so it
-- must supply its own non-blank name. Converted plans are unaffected
-- (name stays optional/unused for them — the UI still prefers the original
-- transaction's description/category).
alter table public.emi_plans
  drop constraint if exists emi_plans_manual_requires_name,
  add constraint emi_plans_manual_requires_name check (
    source <> 'manual' or (name is not null and btrim(name) <> '')
  );

-- ============================================================================
-- create_manual_emi_plan — atomic manual EMI registration.
--
-- Same atomicity/validation shape as create_emi_plan() (Phase 2) — inserts
-- the plan and generates its full remaining installment schedule in one
-- database transaction — but with no source transaction: only the account
-- (must be owned by the caller and a Credit Card) is validated, since
-- there's no purchase transaction to check the account against.
--
-- Unlike create_emi_plan (where the schedule's first installment falls one
-- month after the given start_date, because that date is the conversion/
-- purchase date), p_first_due_date here IS the first installment's own due
-- date — exactly what the "First Due Date" field on the form means. It's
-- stored in emi_plans.start_date, same column create_emi_plan uses, just
-- interpreted as "installment 1's due date" instead of "purchase date" for
-- this source — that column is never displayed directly in the UI, only
-- used to derive the schedule, so the two interpretations never collide.
--
-- EMI math (totalInterest/totalPayable) is computed client-side from the
-- user-entered Outstanding Principal / Monthly EMI / Remaining Tenure (see
-- utils/emi.js's computeManualEmiTotals) and passed straight through, same
-- as create_emi_plan does for the conversion flow. The last installment
-- absorbs any rounding remainder so the schedule always sums to exactly
-- p_total_payable.
-- ============================================================================
create or replace function public.create_manual_emi_plan(
  p_account_id uuid,
  p_name text,
  p_principal numeric,
  p_interest_rate numeric,
  p_tenure_months int,
  p_emi_amount numeric,
  p_total_interest numeric,
  p_total_payable numeric,
  p_first_due_date date
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_plan public.emi_plans%rowtype;
  v_installments jsonb;
  v_remaining numeric;
  v_amt numeric;
  i int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'EMI name is required';
  end if;
  if p_principal is null or p_principal <= 0 then
    raise exception 'Outstanding principal must be greater than 0';
  end if;
  if p_interest_rate is null or p_interest_rate < 0 then
    raise exception 'Interest rate cannot be negative';
  end if;
  if p_tenure_months is null or p_tenure_months <= 0 then
    raise exception 'Remaining tenure must be a positive number of months';
  end if;
  if p_emi_amount is null or p_emi_amount <= 0 then
    raise exception 'Monthly EMI must be greater than 0';
  end if;
  if p_total_payable is null or p_total_payable <= 0 then
    raise exception 'Total payable must be greater than 0';
  end if;
  if p_first_due_date is null then
    raise exception 'First due date is required';
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Account not found or not owned by the current user';
  end if;
  if v_account.type <> 'Credit Card' then
    raise exception 'Only Credit Card accounts can have an EMI plan';
  end if;

  insert into public.emi_plans (
    user_id, transaction_id, account_id, name, source, principal, interest_rate, tenure_months,
    emi_amount, total_interest, total_payable, start_date, status
  ) values (
    v_user_id, null, p_account_id, p_name, 'manual', p_principal, p_interest_rate, p_tenure_months,
    p_emi_amount, coalesce(p_total_interest, 0), p_total_payable, p_first_due_date, 'Active'
  ) returning * into v_plan;

  v_remaining := p_total_payable;
  for i in 1..p_tenure_months loop
    if i = p_tenure_months then
      v_amt := v_remaining;
    else
      v_amt := p_emi_amount;
      v_remaining := v_remaining - p_emi_amount;
    end if;

    -- i - 1: the FIRST installment (i = 1) falls exactly on p_first_due_date,
    -- not one month after it (that's the difference from create_emi_plan's
    -- own `make_interval(months => i)`, explained above).
    insert into public.emi_installments (user_id, emi_plan_id, installment_number, due_date, amount, status)
    values (v_user_id, v_plan.id, i, (p_first_due_date + make_interval(months => i - 1))::date, v_amt, 'Upcoming');
  end loop;

  select jsonb_agg(row_to_json(inst) order by inst.installment_number)
    into v_installments
    from public.emi_installments inst
    where inst.emi_plan_id = v_plan.id;

  return jsonb_build_object('plan', row_to_json(v_plan), 'installments', coalesce(v_installments, '[]'::jsonb));
end;
$$;

revoke all on function public.create_manual_emi_plan(uuid, text, numeric, numeric, int, numeric, numeric, numeric, date) from public;
grant execute on function public.create_manual_emi_plan(uuid, text, numeric, numeric, int, numeric, numeric, numeric, date) to authenticated;
