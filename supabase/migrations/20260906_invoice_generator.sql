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

