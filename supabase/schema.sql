create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  provider text,
  opening numeric(14, 2) not null default 0,

  credit_limit numeric(14, 2),

  statement_date int check (statement_date is null or statement_date between 1 and 31),
  payment_due_date int check (payment_due_date is null or payment_due_date between 1 and 31),

  loan_interest_rate numeric(6, 3) check (loan_interest_rate is null or loan_interest_rate >= 0),
  loan_tenure_months int check (loan_tenure_months is null or loan_tenure_months > 0),
  loan_emi_amount numeric(14, 2) check (loan_emi_amount is null or loan_emi_amount > 0),
  loan_start_date date,
  loan_status text check (loan_status is null or loan_status in ('Active', 'Completed', 'Preclosed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists accounts_user_id_idx on public.accounts (user_id);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  due_day int not null check (due_day between 1 and 31),
  recurring boolean not null default true,
  provider text,
  account_id uuid,
  paid_cycle text,
  paid_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null
);
create index if not exists bills_user_id_idx on public.bills (user_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_number text not null,
  client text not null,
  invoice_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'Unpaid' check (status in ('Unpaid', 'Paid')),
  payment_date date,
  payment_account_id uuid,
  transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (payment_account_id, user_id) references public.accounts (id, user_id) on delete set null
);
create index if not exists invoices_user_id_idx on public.invoices (user_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null check (type in ('Income', 'Expense', 'Transfer')),
  category text not null,
  description text,
  account_id uuid not null,
  transfer_account_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  bill_id uuid,
  invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint transfer_requires_destination check (
    (type = 'Transfer' and transfer_account_id is not null) or (type <> 'Transfer')
  ),
  constraint transfer_accounts_differ check (
    transfer_account_id is null or transfer_account_id <> account_id
  ),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (transfer_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (bill_id, user_id) references public.bills (id, user_id) on delete set null,
  foreign key (invoice_id, user_id) references public.invoices (id, user_id) on delete set null
);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_bill_id_idx on public.transactions (bill_id);
create index if not exists transactions_invoice_id_idx on public.transactions (invoice_id);

alter table public.bills
  drop constraint if exists bills_paid_transaction_id_fkey,
  add constraint bills_paid_transaction_id_fkey
    foreign key (paid_transaction_id, user_id) references public.transactions (id, user_id) on delete set null;

alter table public.invoices
  drop constraint if exists invoices_transaction_id_fkey,
  add constraint invoices_transaction_id_fkey
    foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete set null;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);
create index if not exists budgets_user_id_idx on public.budgets (user_id);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target numeric(14, 2) not null check (target > 0),
  current numeric(14, 2) not null default 0,
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on public.goals (user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['accounts','bills','invoices','transactions','budgets','goals','profiles']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.bills enable row level security;
alter table public.invoices enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','bills','invoices','budgets','goals']
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
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'accounts'
  ) then
    alter publication supabase_realtime add table
      public.accounts, public.transactions, public.bills, public.invoices, public.budgets, public.goals;
  end if;
exception when undefined_object then
  create publication supabase_realtime for table
    public.accounts, public.transactions, public.bills, public.invoices, public.budgets, public.goals;
end $$;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create or replace function public.increment_goal(p_goal_id uuid, p_amount numeric)
returns public.goals as $$
  update public.goals
  set current = current + p_amount
  where id = p_goal_id
  returning *;
$$ language sql;

create or replace function public.compute_active_billing_cycle(p_due_day int, p_today date)
returns text
language plpgsql
immutable
as $$
declare
  v_this_month_due date;
  v_next_month_due date;
  v_next_month_first date;
  v_diff_this int;
  v_diff_next int;
begin
  v_this_month_due := least(
    (date_trunc('month', p_today) + make_interval(days => p_due_day - 1))::date,
    (date_trunc('month', p_today) + interval '1 month' - interval '1 day')::date
  );
  v_diff_this := v_this_month_due - p_today;

  if v_diff_this >= 0 then
    return to_char(v_this_month_due, 'YYYY-MM');
  end if;

  v_next_month_first := (date_trunc('month', p_today) + interval '1 month')::date;
  v_next_month_due := least(
    (v_next_month_first + make_interval(days => p_due_day - 1))::date,
    (v_next_month_first + interval '1 month' - interval '1 day')::date
  );
  v_diff_next := v_next_month_due - p_today;

  if v_diff_next <= 5 then
    return to_char(v_next_month_due, 'YYYY-MM');
  end if;

  return to_char(v_this_month_due, 'YYYY-MM');
end;
$$;

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

  insert into public.transactions (user_id, date, type, category, description, account_id, amount, bill_id)
  values (v_user_id, p_date, 'Expense', v_bill.category, v_bill.name, p_account_id, v_bill.amount, v_bill.id)
  returning * into v_txn;

  update public.bills
  set paid_cycle = v_cycle, paid_transaction_id = v_txn.id
  where id = v_bill.id
  returning * into v_bill;

  bill_row := v_bill;
  transaction_row := v_txn;
  return next;
end;
$$;

revoke all on function public.pay_bill(uuid, uuid, date) from public;
grant execute on function public.pay_bill(uuid, uuid, date) to authenticated;

create or replace function public.pay_invoice(p_invoice_id uuid, p_account_id uuid, p_date date default current_date)
returns table (invoice_row public.invoices, transaction_row public.transactions)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_account public.accounts%rowtype;
  v_txn public.transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Invoice not found or not owned by the current user';
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Account not found or not owned by the current user';
  end if;

  if v_invoice.status = 'Paid' or v_invoice.transaction_id is not null then
    raise exception 'This invoice is already paid';
  end if;

  insert into public.transactions (user_id, date, type, category, description, account_id, amount, invoice_id)
  values (v_user_id, p_date, 'Income', 'Freelance', 'Invoice ' || v_invoice.invoice_number || ' - ' || v_invoice.client, p_account_id, v_invoice.amount, v_invoice.id)
  returning * into v_txn;

  update public.invoices
  set status = 'Paid', payment_date = p_date, payment_account_id = p_account_id, transaction_id = v_txn.id
  where id = v_invoice.id
  returning * into v_invoice;

  invoice_row := v_invoice;
  transaction_row := v_txn;
  return next;
end;
$$;

revoke all on function public.pay_invoice(uuid, uuid, date) from public;
grant execute on function public.pay_invoice(uuid, uuid, date) to authenticated;

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
  status text not null default 'Active' check (status in ('Active', 'Completed', 'Cancelled', 'Preclosed')),
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

  settled_via_preclosure boolean not null default false,
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

create table if not exists public.credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  cycle_key text not null,
  statement_date date not null,
  due_date date,
  statement_balance numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (account_id, cycle_key),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);
create index if not exists credit_card_statements_user_id_idx on public.credit_card_statements (user_id);
create index if not exists credit_card_statements_account_id_idx on public.credit_card_statements (account_id);

alter table public.credit_card_statements enable row level security;

drop policy if exists credit_card_statements_select_own on public.credit_card_statements;
create policy credit_card_statements_select_own on public.credit_card_statements for select using (auth.uid() = user_id);
drop policy if exists credit_card_statements_insert_own on public.credit_card_statements;
create policy credit_card_statements_insert_own on public.credit_card_statements for insert with check (auth.uid() = user_id);
drop policy if exists credit_card_statements_update_own on public.credit_card_statements;
create policy credit_card_statements_update_own on public.credit_card_statements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists credit_card_statements_delete_own on public.credit_card_statements;
create policy credit_card_statements_delete_own on public.credit_card_statements for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'credit_card_statements'
  ) then
    alter publication supabase_realtime add table public.credit_card_statements;
  end if;
exception when undefined_object then
  create publication supabase_realtime for table public.credit_card_statements;
end $$;

create or replace function public.generate_statement(
  p_account_id uuid,
  p_cycle_key text,
  p_statement_date date,
  p_due_date date default null
)
returns public.credit_card_statements
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_outstanding numeric;
  v_statement public.credit_card_statements%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Account not found or not owned by the current user';
  end if;
  if v_account.type <> 'Credit Card' then
    raise exception 'Only Credit Card accounts have statements';
  end if;

  if exists (select 1 from public.credit_card_statements where account_id = p_account_id and cycle_key = p_cycle_key) then
    raise exception 'A statement for this billing cycle already exists';
  end if;

  select coalesce(v_account.opening, 0)
    + coalesce(sum(t.amount) filter (where t.type = 'Expense' and t.account_id = p_account_id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Income' and t.account_id = p_account_id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = p_account_id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.account_id = p_account_id), 0)
    into v_outstanding
    from public.transactions t
    where t.user_id = v_user_id and (t.account_id = p_account_id or t.transfer_account_id = p_account_id);

  insert into public.credit_card_statements (user_id, account_id, cycle_key, statement_date, due_date, statement_balance)
  values (v_user_id, p_account_id, p_cycle_key, p_statement_date, p_due_date, v_outstanding)
  returning * into v_statement;

  return v_statement;
end;
$$;

revoke all on function public.generate_statement(uuid, text, date, date) from public;
grant execute on function public.generate_statement(uuid, text, date, date) to authenticated;

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

create table if not exists public.loan_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  installment_number int not null check (installment_number > 0),
  due_date date not null,
  emi_amount numeric(14, 2) not null check (emi_amount > 0),
  principal_component numeric(14, 2) not null check (principal_component > 0),
  interest_component numeric(14, 2) not null default 0 check (interest_component >= 0),
  status text not null default 'Upcoming' check (status in ('Upcoming', 'Paid', 'Preclosed')),
  paid_date date,
  principal_transaction_id uuid,
  interest_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (account_id, installment_number),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (principal_transaction_id, user_id) references public.transactions (id, user_id) on delete set null,
  foreign key (interest_transaction_id, user_id) references public.transactions (id, user_id) on delete set null
);
create index if not exists loan_installments_user_id_idx on public.loan_installments (user_id);
create index if not exists loan_installments_account_id_idx on public.loan_installments (account_id);
create index if not exists loan_installments_due_date_idx on public.loan_installments (due_date);

do $$
begin
  execute 'drop trigger if exists set_updated_at on public.loan_installments';
  execute 'create trigger set_updated_at before update on public.loan_installments for each row execute function public.set_updated_at()';
end $$;

alter table public.loan_installments enable row level security;

drop policy if exists loan_installments_select_own on public.loan_installments;
create policy loan_installments_select_own on public.loan_installments for select using (auth.uid() = user_id);
drop policy if exists loan_installments_insert_own on public.loan_installments;
create policy loan_installments_insert_own on public.loan_installments for insert with check (auth.uid() = user_id);
drop policy if exists loan_installments_update_own on public.loan_installments;
create policy loan_installments_update_own on public.loan_installments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists loan_installments_delete_own on public.loan_installments;
create policy loan_installments_delete_own on public.loan_installments for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'loan_installments'
  ) then
    alter publication supabase_realtime add table public.loan_installments;
  end if;
exception when undefined_object then
  create publication supabase_realtime for table public.loan_installments;
end $$;

create or replace function public.disburse_loan(
  p_account_id uuid,
  p_destination_account_id uuid,
  p_date date,
  p_installments jsonb,
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan public.accounts%rowtype;
  v_dest public.accounts%rowtype;
  v_txn public.transactions%rowtype;
  v_principal numeric;
  v_installments_total numeric;
  v_count int;
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
    raise exception 'Only Loan accounts can be disbursed';
  end if;

  if exists (select 1 from public.loan_installments where account_id = p_account_id and user_id = v_user_id) then
    raise exception 'This loan has already been disbursed';
  end if;

  select * into v_dest from public.accounts where id = p_destination_account_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Destination account not found or not owned by the current user';
  end if;
  if v_dest.type in ('Loan', 'Credit Card') then
    raise exception 'Choose a Bank or Cash account to receive the loan';
  end if;

  v_principal := coalesce(v_loan.opening, 0);
  if v_principal <= 0 then
    raise exception 'Loan principal must be greater than 0';
  end if;

  select count(*), coalesce(sum((elem->>'principal_component')::numeric), 0)
    into v_count, v_installments_total
    from jsonb_array_elements(p_installments) as elem;

  if v_count = 0 then
    raise exception 'A loan schedule needs at least one installment';
  end if;
  if abs(v_installments_total - v_principal) > 1 then
    raise exception 'Installment schedule does not add up to the loan principal';
  end if;

  insert into public.transactions (user_id, date, type, category, description, account_id, transfer_account_id, amount)
  values (v_user_id, p_date, 'Transfer', 'Loan Disbursement', coalesce(p_description, 'Loan disbursement'), p_account_id, p_destination_account_id, v_principal)
  returning * into v_txn;

  insert into public.loan_installments (user_id, account_id, installment_number, due_date, emi_amount, principal_component, interest_component)
  select
    v_user_id,
    p_account_id,
    (elem->>'installment_number')::int,
    (elem->>'due_date')::date,
    (elem->>'emi_amount')::numeric,
    (elem->>'principal_component')::numeric,
    coalesce((elem->>'interest_component')::numeric, 0)
  from jsonb_array_elements(p_installments) as elem;

  update public.accounts set loan_status = 'Active' where id = v_loan.id;

  select coalesce(jsonb_agg(row_to_json(i) order by i.installment_number), '[]'::jsonb)
    into v_installments
    from public.loan_installments i
    where i.account_id = p_account_id;

  return jsonb_build_object('transaction', row_to_json(v_txn), 'installments', v_installments);
end;
$$;

revoke all on function public.disburse_loan(uuid, uuid, date, jsonb, text) from public;
grant execute on function public.disburse_loan(uuid, uuid, date, jsonb, text) to authenticated;

create or replace function public.pay_loan_installment(
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
  v_inst public.loan_installments%rowtype;
  v_loan public.accounts%rowtype;
  v_source public.accounts%rowtype;
  v_interest_txn public.transactions%rowtype;
  v_principal_txn public.transactions%rowtype;
  v_source_balance numeric;
  v_remaining_upcoming int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_inst from public.loan_installments where id = p_installment_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Installment not found or not owned by the current user';
  end if;
  if v_inst.status = 'Paid' then
    raise exception 'This installment is already paid';
  end if;

  select * into v_loan from public.accounts where id = v_inst.account_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Loan account not found or not owned by the current user';
  end if;
  if v_loan.type <> 'Loan' then
    raise exception 'This installment does not belong to a Loan account';
  end if;
  if coalesce(v_loan.loan_status, 'Active') <> 'Active' then
    raise exception 'This loan is not active and cannot be paid';
  end if;

  select * into v_source from public.accounts where id = p_source_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Source account not found or not owned by the current user';
  end if;
  if p_source_account_id = v_loan.id then
    raise exception 'Choose a different account to pay the installment from';
  end if;
  if v_source.type in ('Credit Card', 'Loan') then
    raise exception 'Loan EMIs can only be paid from a Bank or Cash account';
  end if;

  select coalesce(v_source.opening, 0)
    + coalesce(sum(t.amount) filter (where t.type = 'Income' and t.account_id = p_source_account_id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Expense' and t.account_id = p_source_account_id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.account_id = p_source_account_id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'Transfer' and t.transfer_account_id = p_source_account_id), 0)
    into v_source_balance
    from public.transactions t
    where t.user_id = v_user_id and (t.account_id = p_source_account_id or t.transfer_account_id = p_source_account_id);

  if v_inst.emi_amount > v_source_balance then
    raise exception 'Insufficient balance in %. Available balance: %.', v_source.name, v_source_balance;
  end if;

  if v_inst.interest_component > 0 then
    insert into public.transactions (user_id, date, type, category, description, account_id, amount)
    values (v_user_id, p_date, 'Expense', 'Loan Interest', coalesce(p_description, 'Loan EMI interest'), p_source_account_id, v_inst.interest_component)
    returning * into v_interest_txn;
  end if;

  insert into public.transactions (user_id, date, type, category, description, account_id, transfer_account_id, amount)
  values (v_user_id, p_date, 'Transfer', 'Loan Principal', coalesce(p_description, 'Loan EMI principal'), p_source_account_id, v_loan.id, v_inst.principal_component)
  returning * into v_principal_txn;

  update public.loan_installments
  set status = 'Paid', paid_date = p_date, principal_transaction_id = v_principal_txn.id, interest_transaction_id = v_interest_txn.id
  where id = v_inst.id
  returning * into v_inst;

  select count(*) into v_remaining_upcoming from public.loan_installments where account_id = v_loan.id and status <> 'Paid';
  if v_remaining_upcoming = 0 then
    update public.accounts set loan_status = 'Completed' where id = v_loan.id;
  end if;

  return jsonb_build_object(
    'installment', row_to_json(v_inst),
    'principalTransaction', row_to_json(v_principal_txn),
    'interestTransaction', case when v_interest_txn.id is null then null else row_to_json(v_interest_txn) end,
    'loanStatus', (select loan_status from public.accounts where id = v_loan.id)
  );
end;
$$;

revoke all on function public.pay_loan_installment(uuid, uuid, date, text) from public;
grant execute on function public.pay_loan_installment(uuid, uuid, date, text) to authenticated;

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

alter table public.invoices
  add column if not exists kind text not null default 'manual',
  add column if not exists due_date date,
  add column if not exists payment_terms text,
  add column if not exists currency text not null default 'INR',
  add column if not exists seller jsonb,
  add column if not exists bill_to jsonb,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists discount numeric not null default 0,
  add column if not exists tax_rate numeric not null default 0,
  add column if not exists notes text,
  add column if not exists payment_info jsonb,
  add column if not exists pdf_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists needs_regeneration boolean not null default false;

alter table public.invoices
  drop constraint if exists invoices_kind_check;
alter table public.invoices
  add constraint invoices_kind_check check (kind in ('manual', 'generated'));

insert into storage.buckets (id, name, public)
values ('invoice-files', 'invoice-files', false)
on conflict (id) do nothing;

drop policy if exists "invoice-files own read" on storage.objects;
create policy "invoice-files own read" on storage.objects
  for select using (
    bucket_id = 'invoice-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "invoice-files own write" on storage.objects;
create policy "invoice-files own write" on storage.objects
  for insert with check (
    bucket_id = 'invoice-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "invoice-files own update" on storage.objects;
create policy "invoice-files own update" on storage.objects
  for update using (
    bucket_id = 'invoice-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "invoice-files own delete" on storage.objects;
create policy "invoice-files own delete" on storage.objects
  for delete using (
    bucket_id = 'invoice-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  contact text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  email text,
  phone text,
  tax text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists clients_user_id_idx on public.clients (user_id);

alter table public.clients enable row level security;

drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients for select using (auth.uid() = user_id);
drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients for insert with check (auth.uid() = user_id);
drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists clients_delete_own on public.clients;
create policy clients_delete_own on public.clients for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.clients to authenticated;
