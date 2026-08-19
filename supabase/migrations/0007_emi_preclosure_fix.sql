-- ============================================================================
-- Phase 8 fix — resolves two audit failures in EMI pre-closure:
--
-- 1. preclose_emi_plan() previously reused 'Cancelled' as its terminal
--    status, indistinguishable from a genuinely abandoned EMI. Adds a new
--    'Preclosed' status instead — "remaining obligation intentionally
--    settled early", distinct from 'Cancelled' ("abandoned") and
--    'Completed' ("paid off via normal installments").
--
-- 2. preclose_emi_plan() assigned the SAME payment_transaction_id to every
--    remaining installment it settled in one shot. The existing "Undo" flow
--    (unpayEmiInstallment, services/emiInstallments.js) assumes one
--    installment maps to one payment transaction, so undoing any single
--    pre-closure-settled installment would delete the shared settlement
--    transaction and corrupt every sibling installment that pointed at it.
--    Adds an explicit `settled_via_preclosure` flag so the frontend can
--    identify and refuse to Undo those installments, without touching
--    ordinary single-installment payments (pay_emi_installment) at all —
--    those remain fully undoable exactly as before.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1) New terminal status. Inline CHECK constraints on a single column get
-- Postgres's default name `<table>_<column>_check` (same convention this
-- project already relies on for FK names in schema.sql's bills/invoices
-- back-reference block) — dropped and re-added with the new allowed value.
alter table public.emi_plans
  drop constraint if exists emi_plans_status_check,
  add constraint emi_plans_status_check check (status in ('Active', 'Completed', 'Cancelled', 'Preclosed'));

-- 2) Explicit "was this installment settled by a pre-closure batch, not an
-- individual payment" marker. Defaults false, so every existing installment
-- (all settled individually up to this point) is correctly unaffected.
alter table public.emi_installments
  add column if not exists settled_via_preclosure boolean not null default false;

-- ============================================================================
-- preclose_emi_plan — redefined. Same validation/atomicity/ownership model
-- as before (Phase 3/4 checks, ownership via auth.uid(), security invoker,
-- single implicit transaction, row-locked on emi_plans for concurrency
-- safety) — only the terminal status and the new installment flag change.
-- ============================================================================
create or replace function public.preclose_emi_plan(
  p_plan_id uuid,
  p_source_account_id uuid,
  p_date date default current_date,
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.emi_plans%rowtype;
  v_source public.accounts%rowtype;
  v_card public.accounts%rowtype;
  v_txn public.transactions%rowtype;
  v_remaining_amount numeric;
  v_source_balance numeric;
  v_card_outstanding numeric;
  v_installments jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_plan from public.emi_plans where id = p_plan_id and user_id = v_user_id for update;
  if not found then
    raise exception 'EMI plan not found or not owned by the current user';
  end if;
  if v_plan.status <> 'Active' then
    raise exception 'This EMI plan is not active and cannot be pre-closed';
  end if;

  select coalesce(sum(amount), 0) into v_remaining_amount
    from public.emi_installments
    where emi_plan_id = v_plan.id and user_id = v_user_id and status <> 'Paid';

  if v_remaining_amount <= 0 then
    raise exception 'This EMI plan has no remaining installments to close';
  end if;

  select * into v_source from public.accounts where id = p_source_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Source account not found or not owned by the current user';
  end if;
  if p_source_account_id = v_plan.account_id then
    raise exception 'Choose a different account to pay the settlement from';
  end if;

  select * into v_card from public.accounts where id = v_plan.account_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Credit Card account not found or not owned by the current user';
  end if;

  -- Phase 3: Bank/Cash insufficient-funds check — identical formula to
  -- pay_emi_installment()'s hardening / accountBalance() in App.jsx.
  if v_source.type <> 'Credit Card' then
    select coalesce(v_source.opening, 0)
      + coalesce(sum(t.amount) filter (where t.type = 'Income' and t.account_id = p_source_account_id), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'Expense' and t.account_id = p_source_account_id), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.account_id = p_source_account_id), 0)
      + coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = p_source_account_id), 0)
      into v_source_balance
      from public.transactions t
      where t.user_id = v_user_id and (t.account_id = p_source_account_id or t.transfer_account_id = p_source_account_id);

    if v_remaining_amount > v_source_balance then
      raise exception 'Insufficient balance in %. Available balance: %.', v_source.name, v_source_balance;
    end if;
  end if;

  -- Phase 4: Credit Card outstanding check — identical formula to
  -- pay_emi_installment()'s hardening / accountOutstanding() in App.jsx.
  select coalesce(v_card.opening, 0)
    + coalesce(sum(t.amount) filter (where t.type = 'Expense' and t.account_id = v_plan.account_id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Income' and t.account_id = v_plan.account_id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = v_plan.account_id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.account_id = v_plan.account_id), 0)
    into v_card_outstanding
    from public.transactions t
    where t.user_id = v_user_id and (t.account_id = v_plan.account_id or t.transfer_account_id = v_plan.account_id);

  if v_card_outstanding <= 0 then
    raise exception 'No outstanding balance on this credit card.';
  end if;
  if v_remaining_amount > v_card_outstanding then
    raise exception 'Payment exceeds credit card outstanding. Current outstanding: %.', v_card_outstanding;
  end if;

  insert into public.transactions (user_id, date, type, category, description, account_id, transfer_account_id, amount)
  values (v_user_id, p_date, 'Transfer', 'EMI', coalesce(p_description, 'EMI pre-closure'), p_source_account_id, v_plan.account_id, v_remaining_amount)
  returning * into v_txn;

  -- Only rows that weren't already Paid are touched — a previously-paid
  -- installment's status/paid_date/payment_transaction_id is left exactly as
  -- it was, so paid history never gets rewritten or double-counted.
  -- settled_via_preclosure = true is the explicit marker the frontend uses
  -- to refuse "Undo" on these rows (they share one transaction; undoing any
  -- one of them would incorrectly reverse the whole settlement and corrupt
  -- the others) — ordinary pay_emi_installment() payments never set this
  -- flag, so their Undo continues to work exactly as before.
  update public.emi_installments
  set status = 'Paid', paid_date = p_date, payment_transaction_id = v_txn.id, settled_via_preclosure = true
  where emi_plan_id = v_plan.id and user_id = v_user_id and status <> 'Paid';

  update public.emi_plans set status = 'Preclosed' where id = v_plan.id returning * into v_plan;

  select coalesce(jsonb_agg(row_to_json(i) order by i.installment_number), '[]'::jsonb)
    into v_installments
    from public.emi_installments i
    where i.emi_plan_id = v_plan.id;

  return jsonb_build_object('transaction', row_to_json(v_txn), 'plan', row_to_json(v_plan), 'installments', v_installments);
end;
$$;

revoke all on function public.preclose_emi_plan(uuid, uuid, date, text) from public;
grant execute on function public.preclose_emi_plan(uuid, uuid, date, text) to authenticated;
