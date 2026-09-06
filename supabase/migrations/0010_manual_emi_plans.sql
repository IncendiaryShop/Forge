alter table public.emi_plans alter column transaction_id drop not null;

alter table public.emi_plans add column if not exists name text;
alter table public.emi_plans add column if not exists source text not null default 'converted';

alter table public.emi_plans
  drop constraint if exists emi_plans_source_check,
  add constraint emi_plans_source_check check (source in ('manual', 'converted'));

alter table public.emi_plans
  drop constraint if exists emi_plans_source_transaction_consistency,
  add constraint emi_plans_source_transaction_consistency check (
    (source = 'converted' and transaction_id is not null) or
    (source = 'manual' and transaction_id is null)
  );

alter table public.emi_plans
  drop constraint if exists emi_plans_manual_requires_name,
  add constraint emi_plans_manual_requires_name check (
    source <> 'manual' or (name is not null and btrim(name) <> '')
  );

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
