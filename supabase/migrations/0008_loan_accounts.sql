-- ============================================================================
-- Phase 9 — Loan Account + Loan Schedule + Normal Loan EMI.
--
-- A Loan is a SEPARATE liability account type, distinct from Credit Card EMI
-- (Phases 1-8, untouched by this migration). It reuses the `accounts` table
-- (same pattern as Credit Card's credit_limit/statement_date/payment_due_date
-- columns) plus a new `loan_installments` table for its amortization
-- schedule, and `opening` doubles as the loan's ORIGINAL PRINCIPAL — same
-- "reuse `opening` for the type-specific opening figure" convention Credit
-- Card already established for opening outstanding.
--
-- Outstanding Principal is intentionally NOT a stored column: it's derived
-- the same way accountOutstanding() derives Credit Card outstanding —
-- `opening` (original principal) minus every principal-component Transfer
-- transaction recorded against this loan account. One source of truth, no
-- second balance system.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.accounts
  add column if not exists loan_interest_rate numeric(6, 3) check (loan_interest_rate is null or loan_interest_rate >= 0),
  add column if not exists loan_tenure_months int check (loan_tenure_months is null or loan_tenure_months > 0),
  add column if not exists loan_emi_amount numeric(14, 2) check (loan_emi_amount is null or loan_emi_amount > 0),
  add column if not exists loan_start_date date,
  add column if not exists loan_status text check (loan_status is null or loan_status in ('Active', 'Completed'));

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
  status text not null default 'Upcoming' check (status in ('Upcoming', 'Paid')),
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
