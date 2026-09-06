create table if not exists public.emi_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null,
  account_id uuid not null,
  principal numeric(14, 2) not null check (principal > 0),
  interest_rate numeric(6, 3) not null default 0 check (interest_rate >= 0),
  tenure_months int not null check (tenure_months > 0),
  emi_amount numeric(14, 2) not null check (emi_amount > 0),
  total_interest numeric(14, 2) not null default 0 check (total_interest >= 0),
  total_payable numeric(14, 2) not null check (total_payable > 0),
  start_date date not null,
  status text not null default 'Active' check (status in ('Active', 'Completed', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (transaction_id, user_id),
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete cascade,
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict
);
create index if not exists emi_plans_user_id_idx on public.emi_plans (user_id);
create index if not exists emi_plans_transaction_id_idx on public.emi_plans (transaction_id);
create index if not exists emi_plans_account_id_idx on public.emi_plans (account_id);

create table if not exists public.emi_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  emi_plan_id uuid not null,
  installment_number int not null check (installment_number > 0),
  due_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'Upcoming' check (status in ('Upcoming', 'Paid')),
  paid_date date,
  payment_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (emi_plan_id, installment_number),
  foreign key (emi_plan_id, user_id) references public.emi_plans (id, user_id) on delete cascade,
  foreign key (payment_transaction_id, user_id) references public.transactions (id, user_id) on delete set null
);
create index if not exists emi_installments_user_id_idx on public.emi_installments (user_id);
create index if not exists emi_installments_plan_id_idx on public.emi_installments (emi_plan_id);
create index if not exists emi_installments_due_date_idx on public.emi_installments (due_date);

do $$
declare t text;
begin
  foreach t in array array['emi_plans', 'emi_installments']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table public.emi_plans enable row level security;
alter table public.emi_installments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['emi_plans', 'emi_installments']
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select using (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('create policy %I_insert_own on public.%I for insert with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('create policy %I_update_own on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format('create policy %I_delete_own on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'emi_plans'
  ) then
    alter publication supabase_realtime add table public.emi_plans, public.emi_installments;
  end if;
exception when undefined_object then
  create publication supabase_realtime for table public.emi_plans, public.emi_installments;
end $$;

create or replace function public.create_emi_plan(
  p_transaction_id uuid,
  p_account_id uuid,
  p_principal numeric,
  p_interest_rate numeric,
  p_tenure_months int,
  p_emi_amount numeric,
  p_total_interest numeric,
  p_total_payable numeric,
  p_start_date date
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_txn public.transactions%rowtype;
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

  if p_principal is null or p_principal <= 0 then
    raise exception 'Principal must be greater than 0';
  end if;
  if p_interest_rate is null or p_interest_rate < 0 then
    raise exception 'Interest rate cannot be negative';
  end if;
  if p_tenure_months is null or p_tenure_months <= 0 then
    raise exception 'Tenure must be a positive number of months';
  end if;
  if p_emi_amount is null or p_emi_amount <= 0 then
    raise exception 'EMI amount must be greater than 0';
  end if;
  if p_total_payable is null or p_total_payable <= 0 then
    raise exception 'Total payable must be greater than 0';
  end if;
  if p_start_date is null then
    raise exception 'Start date is required';
  end if;

  select * into v_txn from public.transactions where id = p_transaction_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Transaction not found or not owned by the current user';
  end if;
  if v_txn.type <> 'Expense' then
    raise exception 'Only Expense transactions can be converted to EMI';
  end if;
  if v_txn.account_id <> p_account_id then
    raise exception 'Account does not match the transaction''s account';
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Account not found or not owned by the current user';
  end if;
  if v_account.type <> 'Credit Card' then
    raise exception 'Only Credit Card transactions can be converted to EMI';
  end if;

  if exists (select 1 from public.emi_plans where transaction_id = p_transaction_id and user_id = v_user_id) then
    raise exception 'This transaction has already been converted to EMI';
  end if;

  insert into public.emi_plans (
    user_id, transaction_id, account_id, principal, interest_rate, tenure_months,
    emi_amount, total_interest, total_payable, start_date, status
  ) values (
    v_user_id, p_transaction_id, p_account_id, p_principal, p_interest_rate, p_tenure_months,
    p_emi_amount, p_total_interest, p_total_payable, p_start_date, 'Active'
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
    values (v_user_id, v_plan.id, i, (p_start_date + make_interval(months => i))::date, v_amt, 'Upcoming');
  end loop;

  select jsonb_agg(row_to_json(inst) order by inst.installment_number)
    into v_installments
    from public.emi_installments inst
    where inst.emi_plan_id = v_plan.id;

  return jsonb_build_object('plan', row_to_json(v_plan), 'installments', coalesce(v_installments, '[]'::jsonb));
end;
$$;

revoke all on function public.create_emi_plan(uuid, uuid, numeric, numeric, int, numeric, numeric, numeric, date) from public;
grant execute on function public.create_emi_plan(uuid, uuid, numeric, numeric, int, numeric, numeric, numeric, date) to authenticated;

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
  v_txn public.transactions%rowtype;
  v_remaining_unpaid int;
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

  select * into v_source from public.accounts where id = p_source_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Source account not found or not owned by the current user';
  end if;
  if p_source_account_id = v_plan.account_id then
    raise exception 'Choose a different account to pay the installment from';
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
