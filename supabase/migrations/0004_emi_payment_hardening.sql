-- ============================================================================
-- Phase 6 — EMI Payment Hardening.
-- pay_emi_installment() previously validated ownership/already-paid/self-
-- payment only, and relied entirely on the frontend (insufficientFundsError /
-- creditCardPaymentError in App.jsx) to enforce the Phase 3 Bank/Cash
-- insufficient-funds rule and the Phase 4 "payment can't exceed outstanding"
-- rule. This redefinition adds both checks INSIDE the function, computed the
-- same way as their JS counterparts (accountBalance() / accountOutstanding()
-- in App.jsx), so a call that bypasses the frontend (or a future frontend
-- bug) can no longer create a payment that overdraws a Bank/Cash account or
-- overpays a card. Everything still runs inside the function's single
-- implicit transaction, so a rejected check leaves no partial writes.
--
-- Also added: the EMI plan itself must be 'Active' — the existing status
-- check constraint on emi_plans already allows 'Cancelled', but until now
-- nothing stopped an installment under a non-Active plan from being paid.
--
-- No schema change: only the function body is redefined. Idempotent: safe to
-- re-run.
-- ============================================================================

create or replace function public.pay_emi_installment(
  p_installment_id uuid,
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
  v_inst public.emi_installments%rowtype;
  v_plan public.emi_plans%rowtype;
  v_source public.accounts%rowtype;
  v_card public.accounts%rowtype;
  v_txn public.transactions%rowtype;
  v_remaining_unpaid int;
  v_source_balance numeric;
  v_card_outstanding numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_inst from public.emi_installments where id = p_installment_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Installment not found or not owned by the current user';
  end if;
  if v_inst.status = 'Paid' then
    raise exception 'This installment is already paid';
  end if;

  select * into v_plan from public.emi_plans where id = v_inst.emi_plan_id and user_id = v_user_id for update;
  if not found then
    raise exception 'EMI plan not found';
  end if;
  if v_plan.status <> 'Active' then
    raise exception 'This EMI plan is not active';
  end if;

  select * into v_source from public.accounts where id = p_source_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Source account not found or not owned by the current user';
  end if;
  if p_source_account_id = v_plan.account_id then
    raise exception 'Choose a different account to pay the installment from';
  end if;

  select * into v_card from public.accounts where id = v_plan.account_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Credit Card account not found or not owned by the current user';
  end if;

  -- Phase 3: Bank/Cash insufficient-funds check — mirrors accountBalance()
  -- in App.jsx exactly (Income +, Expense -, Transfer-out -, Transfer-in +),
  -- applied only when the source isn't itself a Credit Card (Credit Cards
  -- never use this rule — they use their own outstanding/limit logic).
  if v_source.type <> 'Credit Card' then
    select coalesce(v_source.opening, 0)
      + coalesce(sum(t.amount) filter (where t.type = 'Income' and t.account_id = p_source_account_id), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'Expense' and t.account_id = p_source_account_id), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.account_id = p_source_account_id), 0)
      + coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = p_source_account_id), 0)
      into v_source_balance
      from public.transactions t
      where t.user_id = v_user_id and (t.account_id = p_source_account_id or t.transfer_account_id = p_source_account_id);

    if v_inst.amount > v_source_balance then
      raise exception 'Insufficient balance in %. Available balance: %.', v_source.name, v_source_balance;
    end if;
  end if;

  -- Phase 4: Credit Card outstanding check — mirrors accountOutstanding() in
  -- App.jsx exactly. A payment can never exceed what's actually owed.
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
  if v_inst.amount > v_card_outstanding then
    raise exception 'Payment exceeds credit card outstanding. Current outstanding: %.', v_card_outstanding;
  end if;

  insert into public.transactions (user_id, date, type, category, description, account_id, transfer_account_id, amount)
  values (v_user_id, p_date, 'Transfer', 'EMI', coalesce(p_description, 'EMI payment'), p_source_account_id, v_plan.account_id, v_inst.amount)
  returning * into v_txn;

  update public.emi_installments
  set status = 'Paid', paid_date = p_date, payment_transaction_id = v_txn.id
  where id = v_inst.id
  returning * into v_inst;

  select count(*) into v_remaining_unpaid from public.emi_installments where emi_plan_id = v_plan.id and status <> 'Paid';
  if v_remaining_unpaid = 0 then
    update public.emi_plans set status = 'Completed' where id = v_plan.id returning * into v_plan;
  end if;

  return jsonb_build_object('installment', row_to_json(v_inst), 'transaction', row_to_json(v_txn), 'plan', row_to_json(v_plan));
end;
$$;

revoke all on function public.pay_emi_installment(uuid, uuid, date, text) from public;
grant execute on function public.pay_emi_installment(uuid, uuid, date, text) to authenticated;
