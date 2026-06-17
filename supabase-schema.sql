create extension if not exists pgcrypto;

create table if not exists public.public_reports (
  id uuid primary key default gen_random_uuid(),
  equipment_id text,
  customer_id text,
  customer_name text not null default '',
  location_id text,
  location_name text not null default '',
  equipment_name text not null default '',
  note text not null default '',
  contact text not null default '',
  photo_data_url text not null default '',
  photo_name text not null default '',
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.public_reports enable row level security;

drop policy if exists "Anyone can submit public QR reports" on public.public_reports;
create policy "Anyone can submit public QR reports"
on public.public_reports
for insert
to anon
with check (true);

drop policy if exists "Anyone can read public QR reports for prototype sync" on public.public_reports;
create policy "Anyone can read public QR reports for prototype sync"
on public.public_reports
for select
to anon
using (true);
