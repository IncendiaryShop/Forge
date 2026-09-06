alter table public.accounts
  add column if not exists statement_date int check (statement_date is null or statement_date between 1 and 31),
  add column if not exists payment_due_date int check (payment_due_date is null or payment_due_date between 1 and 31);

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
