-- ============================================================================
-- Phase 8 — EMI Management / Pre-Closure.
-- Adds preclose_emi_plan(): settles every remaining (not-yet-Paid)
-- installment on an Active EMI plan in a single Transfer transaction, same
-- mechanism/semantics as pay_emi_installment() (Source Bank/Cash -> Credit
-- Card), then marks the plan 'Cancelled' — a distinct terminal status from
-- the plan's existing 'Completed' (reached by paying every installment
-- individually), so a pre-closed plan stays distinguishable from a
-- naturally-completed one in history. No schema change: 'Cancelled' was
-- already part of emi_plans' status check constraint from Phase 2 and was
-- simply never used until now.
--
-- Applies the exact same Phase 3 (Bank/Cash insufficient-funds) and Phase 4
-- (payment can't exceed Credit Card outstanding) server-side checks as
-- pay_emi_installment's Phase 6 hardening, computed identically — this is
-- the security/integrity boundary; the frontend's own checks
-- (EmiSchedule.jsx) are only for immediate user feedback, exactly as with
-- individual installment payments.
--
-- Idempotent: safe to re-run.
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
  update public.emi_installments
  set status = 'Paid', paid_date = p_date, payment_transaction_id = v_txn.id
  where emi_plan_id = v_plan.id and user_id = v_user_id and status <> 'Paid';

  update public.emi_plans set status = 'Cancelled' where id = v_plan.id returning * into v_plan;

  select coalesce(jsonb_agg(row_to_json(i) order by i.installment_number), '[]'::jsonb)
    into v_installments
    from public.emi_installments i
    where i.emi_plan_id = v_plan.id;

  return jsonb_build_object('transaction', row_to_json(v_txn), 'plan', row_to_json(v_plan), 'installments', v_installments);
end;
$$;

revoke all on function public.preclose_emi_plan(uuid, uuid, date, text) from public;
grant execute on function public.preclose_emi_plan(uuid, uuid, date, text) to authenticated;
