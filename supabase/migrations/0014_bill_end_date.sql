alter table public.bills
  add column if not exists last_bill_date date,
  add column if not exists completed boolean not null default false;

create or replace function public.pay_bill(p_bill_id uuid, p_account_id uuid, p_date date default current_date)
returns table (bill_row public.bills, transaction_row public.transactions)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills%rowtype;
  v_account public.accounts%rowtype;
  v_cycle text;
  v_is_final boolean;
  v_txn public.transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_bill from public.bills where id = p_bill_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Bill not found or not owned by the current user';
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Account not found or not owned by the current user';
  end if;

  v_cycle := public.compute_active_billing_cycle(v_bill.due_day, p_date);

  if v_bill.paid_cycle = v_cycle then
    raise exception 'This bill is already paid for the current cycle';
  end if;

  v_is_final := v_bill.last_bill_date is not null
    and v_cycle >= to_char(v_bill.last_bill_date, 'YYYY-MM');

  insert into public.transactions (user_id, date, type, category, description, account_id, amount, bill_id)
  values (v_user_id, p_date, 'Expense', v_bill.category, v_bill.name, p_account_id, v_bill.amount, v_bill.id)
  returning * into v_txn;

  update public.bills
  set paid_cycle = v_cycle, paid_transaction_id = v_txn.id, completed = v_is_final
  where id = v_bill.id
  returning * into v_bill;

  bill_row := v_bill;
  transaction_row := v_txn;
  return next;
end;
$$;
