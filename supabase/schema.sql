-- ============================================================================
-- FORGE — Supabase schema
-- Run this once against a fresh Supabase project (SQL editor, or `supabase db push`).
-- Idempotent: safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / drop-then-create
-- for policies/constraints).
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- accounts
-- `unique (id, user_id)` looks redundant next to the primary key, but it's
-- what lets every other user-owned table below reference accounts with a
-- COMPOSITE foreign key (some_id, user_id) -> accounts(id, user_id) instead of
-- just (some_id) -> accounts(id). A plain single-column FK only proves the
-- referenced account exists *somewhere* — not that it belongs to the same
-- user as the referencing row. The composite form makes "user B's
-- transaction points at user A's account" impossible to insert at all,
-- regardless of what the frontend sends or whether RLS is somehow
-- misconfigured. Same pattern is repeated on bills/invoices/transactions
-- below for the same reason.
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  provider text,
  opening numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists accounts_user_id_idx on public.accounts (user_id);

-- ----------------------------------------------------------------------------
-- bills
-- account_id / paid_transaction_id are both ownership-checked via composite
-- FKs (account_id, user_id) and (paid_transaction_id, user_id) respectively —
-- the latter is added via ALTER TABLE further down once transactions exists
-- (bills <-> transactions is a two-way reference).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- invoices
-- transaction_id composite FK added below once transactions exists.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- transactions
-- account_id / transfer_account_id / bill_id / invoice_id are all composite
-- FKs against (id, user_id) on their respective tables — same cross-user
-- protection as above, applied to every relationship this table holds.
-- account_id / transfer_account_id use ON DELETE RESTRICT (an account with
-- transactions against it can't be deleted — matches the existing
-- client-side guard in AccountsPage, now also enforced in the database).
-- ----------------------------------------------------------------------------
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

-- Now that transactions (and its (id, user_id) uniqueness) exists, wire up
-- the two forward references, both ownership-checked composite FKs.
alter table public.bills
  drop constraint if exists bills_paid_transaction_id_fkey,
  add constraint bills_paid_transaction_id_fkey
    foreign key (paid_transaction_id, user_id) references public.transactions (id, user_id) on delete set null;

alter table public.invoices
  drop constraint if exists invoices_transaction_id_fkey,
  add constraint invoices_transaction_id_fkey
    foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete set null;

-- ----------------------------------------------------------------------------
-- budgets
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- goals
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- updated_at auto-touch trigger
-- ============================================================================
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

-- ============================================================================
-- Row Level Security
-- ============================================================================
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

-- ============================================================================
-- Realtime
-- ============================================================================
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

-- ============================================================================
-- Auto-create a profile row on signup
-- ============================================================================
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

-- ============================================================================
-- increment_goal — atomic contribution.
-- SECURITY INVOKER (the default), so the UPDATE runs as the calling user and
-- is subject to the normal goals_update_own RLS policy — avoids a stale-read
-- race where two devices contributing near-simultaneously would otherwise
-- both read the old `current` value and overwrite each other.
-- ============================================================================
create or replace function public.increment_goal(p_goal_id uuid, p_amount numeric)
returns public.goals as $$
  update public.goals
  set current = current + p_amount
  where id = p_goal_id
  returning *;
$$ language sql;

-- ============================================================================
-- compute_active_billing_cycle — server-side mirror of the frontend's
-- getActiveBillingCycle() (src/utils/billCycle.js). Kept byte-for-byte
-- equivalent to that logic on purpose: same "clamp due_day to the last day of
-- the month" rule, same "roll into next month's cycle once within 5 days of
-- it" rule, same "YYYY-MM" cycle key. This is what lets pay_bill() below
-- determine/validate the active cycle itself rather than trusting a
-- client-supplied value.
-- ============================================================================
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

-- ============================================================================
-- pay_bill — atomic bill payment.
-- A single RPC call is one Postgres transaction: if any RAISE EXCEPTION fires
-- partway through, every statement before it in this function is rolled back
-- automatically (the transaction insert AND the bill update never partially
-- apply). SECURITY INVOKER (default — no SECURITY DEFINER) so every
-- statement still runs under RLS as the calling user; auth.uid() is read
-- server-side and never trusts a client-supplied user id. `select ... for
-- update` locks the bill row for the duration of the call, so two concurrent
-- pay requests for the same bill/cycle serialize instead of racing — the
-- second one hits the "already paid" check and fails cleanly.
-- ============================================================================
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

-- ============================================================================
-- pay_invoice — atomic invoice payment. Same transaction/locking/ownership
-- reasoning as pay_bill above.
-- ============================================================================
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
