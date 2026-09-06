alter table public.accounts
  drop constraint if exists accounts_loan_status_check,
  add constraint accounts_loan_status_check check (loan_status is null or loan_status in ('Active', 'Completed', 'Preclosed'));

alter table public.loan_installments
  drop constraint if exists loan_installments_status_check,
  add constraint loan_installments_status_check check (status in ('Upcoming', 'Paid', 'Preclosed'));

create or replace function public.preclose_loan(
  p_account_id uuid,
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
  v_loan public.accounts%rowtype;
  v_source public.accounts%rowtype;
  v_txn public.transactions%rowtype;
  v_outstanding numeric;
  v_source_balance numeric;
  v_installments jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_loan from public.accounts where id = p_account_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Loan account not found or not owned by the current user';
  end if;
  if v_loan.type <> 'Loan' then
    raise exception 'Only Loan accounts can be pre-closed';
  end if;
  if coalesce(v_loan.loan_status, 'Active') <> 'Active' then
    raise exception 'This loan is not active and cannot be pre-closed';
  end if;

  select coalesce(v_loan.opening, 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = p_account_id), 0)
    into v_outstanding
    from public.transactions t
    where t.user_id = v_user_id and t.transfer_account_id = p_account_id;

  if v_outstanding <= 0 then
    raise exception 'This loan has no outstanding principal to settle';
  end if;

  select * into v_source from public.accounts where id = p_source_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Source account not found or not owned by the current user';
  end if;
  if p_source_account_id = v_loan.id then
    raise exception 'Choose a different account to pay the settlement from';
  end if;
  if v_source.type in ('Credit Card', 'Loan') then
    raise exception 'A loan can only be pre-closed from a Bank or Cash account';
  end if;

  if v_source.type <> 'Credit Card' then
    select coalesce(v_source.opening, 0)
      + coalesce(sum(t.amount) filter (where t.type = 'Income' and t.account_id = p_source_account_id), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'Expense' and t.account_id = p_source_account_id), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.account_id = p_source_account_id), 0)
      + coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = p_source_account_id), 0)
      into v_source_balance
      from public.transactions t
      where t.user_id = v_user_id and (t.account_id = p_source_account_id or t.transfer_account_id = p_source_account_id);

    if v_outstanding > v_source_balance then
      raise exception 'Insufficient balance in %. Available balance: %.', v_source.name, v_source_balance;
    end if;
  end if;

  insert into public.transactions (user_id, date, type, category, description, account_id, transfer_account_id, amount)
  values (v_user_id, p_date, 'Transfer', 'Loan Preclosure', coalesce(p_description, 'Loan pre-closure'), p_source_account_id, p_account_id, v_outstanding)
  returning * into v_txn;

  update public.loan_installments
  set status = 'Preclosed', paid_date = p_date, principal_transaction_id = v_txn.id
  where account_id = p_account_id and user_id = v_user_id and status = 'Upcoming';

  update public.accounts set loan_status = 'Preclosed' where id = v_loan.id;

  select coalesce(jsonb_agg(row_to_json(i) order by i.installment_number), '[]'::jsonb)
    into v_installments
    from public.loan_installments i
    where i.account_id = p_account_id;

  return jsonb_build_object('transaction', row_to_json(v_txn), 'installments', v_installments, 'loanStatus', 'Preclosed');
end;
$$;

revoke all on function public.preclose_loan(uuid, uuid, date, text) from public;
grant execute on function public.preclose_loan(uuid, uuid, date, text) to authenticated;
