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
