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
  -- Credit Card accounts only. `opening` above doubles as the opening
  -- OUTSTANDING for a Credit Card (not a credit limit). Nullable: absent for
  -- every non-Credit-Card account, and for any Credit Card row created
  -- before this column existed — the frontend treats a null limit as "no
  -- limit set yet" rather than a hard 0 cap.
  credit_limit numeric(14, 2),
  -- Credit Card billing cycle (Phase 7). Day-of-month settings (1-31), same
  -- convention as bills.due_day — nullable, absent for non-Credit-Card
  -- accounts and for any card that hasn't configured them yet.
  statement_date int check (statement_date is null or statement_date between 1 and 31),
  payment_due_date int check (payment_due_date is null or payment_due_date between 1 and 31),
  -- Loan accounts only (Phase 9). `opening` above doubles as the ORIGINAL
  -- PRINCIPAL for a Loan (same reuse pattern as Credit Card's opening
  -- outstanding) — Outstanding Principal is never stored, only derived (see
  -- loanOutstandingPrincipal() in App.jsx). Nullable: absent for every
  -- non-Loan account.
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

-- ============================================================================
-- Phase 2 — Credit Card EMI Foundation (emi_plans, emi_installments, and the
-- create_emi_plan()/pay_emi_installment() RPCs). Appended so a fresh install
-- of this file alone is sufficient; see supabase/migrations/0003_credit_card_emi.sql
-- for applying this to an already-provisioned project.
-- ============================================================================

-- ============================================================================
-- Phase 2 — Credit Card EMI Foundation.
-- Adds emi_plans + emi_installments, plus the create_emi_plan() and
-- pay_emi_installment() RPCs that operate on them atomically (same pattern
-- as pay_bill()/pay_invoice() in schema.sql). Run once against an existing
-- project (SQL editor, or `supabase db push`). Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- emi_plans
-- Linked to the ORIGINAL purchase transaction (transaction_id) — that
-- transaction is never modified by this feature; converting it to EMI only
-- ever attaches a plan to it. `unique (transaction_id, user_id)` is what
-- enforces "a transaction can only be converted to EMI once" at the database
-- level (mirrored by an application-level check in create_emi_plan() too, so
-- the user sees a friendly error instead of a raw constraint violation in the
-- common case).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- emi_installments
-- payment_transaction_id points at the Transfer transaction created when an
-- installment is actually paid (see pay_emi_installment() below) — that
-- Transfer is what reduces the card's outstanding, exactly like any other
-- Credit Card payment. ON DELETE CASCADE from emi_plans means deleting a plan
-- can never leave an orphaned installment row; ON DELETE SET NULL from
-- transactions means deleting a payment transaction un-links it from its
-- installment rather than deleting installment history.
-- ----------------------------------------------------------------------------
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
  -- Explicit marker: true only for installments settled as part of a
  -- preclose_emi_plan() batch (which share ONE payment_transaction_id across
  -- multiple installments) — lets the frontend refuse "Undo" on these rows,
  -- since undoing one would incorrectly reverse the whole shared settlement.
  -- Ordinary pay_emi_installment() payments never set this.
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

-- ============================================================================
-- updated_at auto-touch trigger — extend the existing trigger to the two new
-- tables (same function as every other table, defined earlier in schema.sql).
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['emi_plans', 'emi_installments']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- Row Level Security — same ownership pattern as every other user-owned
-- table (select/insert/update/delete restricted to auth.uid() = user_id).
-- ============================================================================
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

-- ============================================================================
-- Realtime — add the two new tables to the existing publication.
-- ============================================================================
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

-- ============================================================================
-- create_emi_plan — atomic EMI conversion.
-- Validates the transaction is an Expense owned by the caller, that the
-- given account matches the transaction's account AND is a Credit Card, and
-- that the transaction hasn't already been converted — then inserts the plan
-- and generates its installment schedule in the same transaction. The
-- ORIGINAL transaction row is never touched (no update statement against
-- public.transactions anywhere in this function), so its amount/date/
-- category/account stay exactly as they were — satisfying "do not modify the
-- original transaction" and "credit card outstanding must not change on
-- conversion" simultaneously, since outstanding is derived from transactions
-- as-is.
--
-- EMI math (amount/interest/total) is computed client-side and passed in
-- rather than recomputed here, so the schedule always matches exactly what
-- the user saw in the conversion modal. The last installment absorbs any
-- rounding remainder so the schedule always sums to exactly p_total_payable.
-- ============================================================================
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

-- ============================================================================
-- pay_emi_installment — atomic EMI installment payment.
-- Records the payment as a Transfer FROM p_source_account_id TO the EMI
-- plan's Credit Card account — the exact same mechanism as any other
-- Credit Card payment (see App.jsx's accountOutstanding()), so paying an
-- installment reduces the card's outstanding automatically, with no
-- separate "EMI payment" balance logic required. Marks the installment Paid,
-- and flips the plan to 'Completed' once every installment is paid.
--
-- Phase 6 hardening: also enforces the Phase 3 Bank/Cash insufficient-funds
-- rule and the Phase 4 "payment can't exceed outstanding" rule SERVER-SIDE
-- (mirroring accountBalance()/accountOutstanding() in App.jsx exactly),
-- and requires the EMI plan to be 'Active' — so this RPC no longer blindly
-- trusts the frontend's own checks for correctness/security.
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

-- ============================================================================
-- Phase 7 — Credit Card Statement & Billing Cycle (credit_card_statements +
-- generate_statement()). Appended so a fresh install of this file alone is
-- sufficient; see supabase/migrations/0005_credit_card_billing_cycle.sql for
-- applying this to an already-provisioned project. accounts.statement_date /
-- payment_due_date are already part of the accounts table definition above.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- credit_card_statements
-- One row per (account, billing cycle). `cycle_key` is 'YYYY-MM' identifying
-- which cycle the statement covers (matches the frontend's cycleKey() in
-- utils/creditCardBilling.js) — `unique (account_id, cycle_key)` is what
-- makes "generate a statement for a cycle that already has one" a clean,
-- friendly rejection instead of a silent duplicate.
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- generate_statement — freezes the Credit Card's CURRENT Outstanding into a
-- statement row for its current billing cycle. Does not touch accounts,
-- transactions, or Outstanding in any way — this is a billing/accounting
-- record only, never a transaction (matches Phase 7's "do not automatically
-- create duplicate transactions just because a statement is generated").
--
-- Outstanding is computed with the exact same formula as
-- accountOutstanding() in App.jsx / pay_emi_installment's Phase 6 hardening,
-- so this is the third place that formula now lives (JS, pay_emi_installment,
-- and here) — all three are required to independently verify the same fact
-- at their own layer, same reasoning as Phase 6.
-- ============================================================================
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

-- ============================================================================
-- preclose_emi_plan — settles every remaining (not-yet-Paid) installment on
-- an Active EMI plan in a single Transfer transaction, same mechanism as
-- pay_emi_installment() (Source Bank/Cash -> Credit Card), then marks the
-- plan 'Preclosed' — a distinct terminal status from 'Completed' (reached by
-- paying every installment individually) and from 'Cancelled' (an abandoned
-- EMI), so a pre-closed plan stays clearly distinguishable in history.
--
-- Settled installments are flagged settled_via_preclosure = true, since they
-- share ONE payment_transaction_id across potentially many rows — the
-- frontend uses that flag to refuse "Undo" on them (undoing one would
-- incorrectly reverse the whole shared settlement and corrupt the others).
-- Ordinary pay_emi_installment() payments never set it, so their Undo keeps
-- working exactly as before.
--
-- Applies the exact same Phase 3 (Bank/Cash insufficient-funds) and Phase 4
-- (payment can't exceed Credit Card outstanding) server-side checks as
-- pay_emi_installment's Phase 6 hardening, computed identically.
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

-- ============================================================================
-- Phase 9 — Loan Account + Loan Schedule + Normal Loan EMI (loan_installments +
-- disburse_loan() + pay_loan_installment()). Appended so a fresh install of
-- this file alone is sufficient; see
-- supabase/migrations/0008_loan_accounts.sql for applying this to an
-- already-provisioned project. accounts.loan_* columns are already part of
-- the accounts table definition above.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- loan_installments
-- One row per amortization-schedule entry for a Loan account. Deliberately a
-- SEPARATE table from emi_installments (Credit Card EMI, Phase 2) — Loan and
-- Credit Card EMI are different liabilities with different accounting
-- (principal/interest split here vs a single blended amount there), and
-- coupling them into one table/RPC would conflate two systems the brief
-- explicitly requires stay separate.
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- disburse_loan — atomic loan disbursement + schedule generation.
--
-- Records disbursement as a Transfer FROM the loan account TO the receiving
-- Bank/Cash account (loan.opening = original principal moves out of the
-- loan "account" conceptually and into the bank) — this is what correctly
-- increases the bank's balance via the EXISTING, unmodified accountBalance()
-- Transfer branch, with NO new transaction type and NO Income created. The
-- loan account's own generic accountBalance()/accountOutstanding() values are
-- never read/displayed anywhere in the UI for a Loan — Outstanding Principal
-- is derived separately (see accounts.js / App.jsx loanOutstandingPrincipal),
-- so this Transfer's effect on the loan "account" itself is inert.
--
-- The amortization schedule itself is computed client-side (utils/
-- loanAmortization.js, same "trust client math, validate the total"
-- precedent as create_emi_plan for Credit Card EMI) and passed in as jsonb;
-- this function only validates it sums to the account's principal before
-- committing, then bulk-inserts it.
-- ============================================================================
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

-- ============================================================================
-- pay_loan_installment — atomic normal loan EMI payment.
--
-- Splits the EMI into its two accounting effects, both via ordinary
-- transactions (never a direct balance mutation):
--   - interest_component (if > 0) -> an Expense on the source account
--     (category 'Loan Interest') — real spending, shows up in Dashboard/
--     budget/category totals exactly like any other Expense.
--   - principal_component -> a Transfer from the source account to the loan
--     account — reduces the source's balance and (via the loan's derived
--     Outstanding Principal formula) reduces what's owed, without ever
--     touching Credit Card outstanding/limit logic.
-- Together they debit the source by exactly emi_amount, matching Forge's
-- "derive everything from transactions" architecture with no new concepts.
--
-- Applies the same Phase 3-style Bank/Cash insufficient-funds check as
-- pay_emi_installment()/preclose_emi_plan() (Phase 6 precedent), computed
-- identically, and completes the loan (loan_status = 'Completed') once no
-- Upcoming installments remain.
-- ============================================================================
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

  -- Phase 3: Bank/Cash insufficient-funds check — identical formula to
  -- accountBalance() in App.jsx / pay_emi_installment's Phase 6 hardening.
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

-- ============================================================================
-- Phase 10 — Loan Prepayment / Foreclosure (preclose_loan()). Appended so a
-- fresh install of this file alone is sufficient; see
-- supabase/migrations/0009_loan_preclosure.sql for applying this to an
-- already-provisioned project. The Preclosed status values are already part
-- of the accounts.loan_status / loan_installments.status constraints above.
-- ============================================================================

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

  -- Outstanding Principal — identical formula to loanOutstandingPrincipal()
  -- in App.jsx: opening (original principal) minus every principal-component
  -- Transfer already recorded against this loan.
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

  -- Phase 3: Bank/Cash insufficient-funds check — identical formula to
  -- accountBalance() in App.jsx / pay_loan_installment's own hardening.
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

  -- Only remaining Upcoming rows are touched — Paid installments (and their
  -- own principal/interest transactions) are left exactly as they were.
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
