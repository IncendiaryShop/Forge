-- ============================================================================
-- Phase 10 — Loan Prepayment / Foreclosure.
--
-- Adds a 'Preclosed' terminal status for Loan accounts (accounts.loan_status)
-- and loan_installments (status) — distinct from 'Completed' (schedule paid
-- off installment-by-installment) and never 'Cancelled' (that value doesn't
-- even exist in this constraint; Loan never used it). Adds preclose_loan(),
-- an atomic RPC that settles the loan's full Outstanding Principal in one
-- Transfer from a Bank/Cash account to the loan account, then marks every
-- remaining Upcoming installment 'Preclosed' (paid installments are left
-- completely untouched).
--
-- Settlement amount is ALWAYS exactly the current Outstanding Principal
-- (opening minus every principal-component Transfer already recorded) —
-- computed server-side with the same formula loanOutstandingPrincipal() uses
-- in App.jsx, never a client-supplied number, and no foreclosure fee or
-- future-interest charge is invented (Phase 9's data model has no such
-- concept to draw from).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1) New terminal status for Loan accounts. Inline CHECK constraints on a
-- single column get Postgres's default name `<table>_<column>_check` (same
-- convention this project already relied on for emi_plans_status_check in
-- migration 0007) — dropped and re-added with the new allowed value.
alter table public.accounts
  drop constraint if exists accounts_loan_status_check,
  add constraint accounts_loan_status_check check (loan_status is null or loan_status in ('Active', 'Completed', 'Preclosed'));

-- 2) New terminal status for loan_installments — a remaining installment
-- settled by preclose_loan() becomes 'Preclosed', never 'Paid' (it was never
-- individually paid) and never deleted (schedule stays available for
-- historical reference).
alter table public.loan_installments
  drop constraint if exists loan_installments_status_check,
  add constraint loan_installments_status_check check (status in ('Upcoming', 'Paid', 'Preclosed'));

-- ============================================================================
-- preclose_loan — atomic loan pre-closure/foreclosure.
--
-- Settles the loan's ENTIRE current Outstanding Principal in a single
-- Transfer from p_source_account_id to the loan account (same mechanism as
-- pay_loan_installment's principal leg — a Transfer, never an Expense or
-- Income), then marks every remaining Upcoming installment 'Preclosed' and
-- the loan account 'Preclosed'. Historical Paid installments and their
-- transactions are never touched.
--
-- Applies the same Phase 3-style Bank/Cash insufficient-funds check as
-- pay_loan_installment/pay_emi_installment/preclose_emi_plan (Phase 6/8
-- precedent), computed identically. Row-locks the loan account before its
-- Active-status check, so a second concurrent/duplicate call blocks until
-- the first commits, then correctly sees 'Preclosed' and rejects — no
-- duplicate settlement transaction is possible.
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
