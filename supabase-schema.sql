create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  name text not null default '',
  role text not null default 'Customer',
  customer_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Anyone can read profiles for prototype auth" on public.profiles;
create policy "Anyone can read profiles for prototype auth"
on public.profiles
for select
to anon
using (true);

drop policy if exists "Anyone can create profiles for prototype auth" on public.profiles;
create policy "Anyone can create profiles for prototype auth"
on public.profiles
for insert
to anon
with check (true);

drop policy if exists "Anyone can update profiles for prototype auth" on public.profiles;
create policy "Anyone can update profiles for prototype auth"
on public.profiles
for update
to anon
using (true)
with check (true);

drop policy if exists "Anyone can delete profiles for prototype auth" on public.profiles;
create policy "Anyone can delete profiles for prototype auth"
on public.profiles
for delete
to anon
using (true);

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Anyone can read shared app data for prototype sync" on public.app_state;
create policy "Anyone can read shared app data for prototype sync"
on public.app_state
for select
to anon
using (true);

drop policy if exists "Anyone can create shared app data for prototype sync" on public.app_state;
create policy "Anyone can create shared app data for prototype sync"
on public.app_state
for insert
to anon
with check (true);

drop policy if exists "Anyone can update shared app data for prototype sync" on public.app_state;
create policy "Anyone can update shared app data for prototype sync"
on public.app_state
for update
to anon
using (true)
with check (true);

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
