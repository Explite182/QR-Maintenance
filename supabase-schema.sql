create extension if not exists pgcrypto;

create table if not exists public.customers (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pm_templates (
  id text primary key,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  template_id text references public.pm_templates(id) on delete set null,
  name text not null,
  frequency_days integer not null default 30,
  next_pm_date date,
  manufacturer text not null default '',
  model text not null default '',
  serial text not null default '',
  install_date date,
  type text not null default '',
  criticality text not null default '',
  document_url text not null default '',
  vendor text not null default '',
  vendor_contact text not null default '',
  warranty_date date,
  parts text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id text primary key,
  issue_number integer,
  asset_id text references public.assets(id) on delete set null,
  customer_id text references public.customers(id) on delete cascade,
  location_id text references public.locations(id) on delete cascade,
  title text not null,
  priority text not null default 'Medium',
  status text not null default 'Open',
  source text not null default '',
  area_name text not null default '',
  assigned_user_id text not null default '',
  assigned_user_name text not null default '',
  notes text not null default '',
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.work_orders add column if not exists assigned_user_id text not null default '';
alter table public.work_orders add column if not exists assigned_user_name text not null default '';
alter table public.work_orders add column if not exists issue_number integer;

create table if not exists public.pm_history (
  id text primary key,
  asset_id text not null references public.assets(id) on delete cascade,
  technician text not null default '',
  result text not null default '',
  reading text not null default '',
  notes text not null default '',
  completed_checks jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);

create table if not exists public.asset_files (
  id text primary key,
  asset_id text not null references public.assets(id) on delete cascade,
  file_type text not null,
  name text not null default '',
  url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.locations enable row level security;
alter table public.pm_templates enable row level security;
alter table public.assets enable row level security;
alter table public.work_orders enable row level security;
alter table public.pm_history enable row level security;
alter table public.asset_files enable row level security;

drop policy if exists "Prototype read customers" on public.customers;
create policy "Prototype read customers" on public.customers for select to anon using (true);
drop policy if exists "Prototype write customers" on public.customers;
create policy "Prototype write customers" on public.customers for all to anon using (true) with check (true);

drop policy if exists "Prototype read locations" on public.locations;
create policy "Prototype read locations" on public.locations for select to anon using (true);
drop policy if exists "Prototype write locations" on public.locations;
create policy "Prototype write locations" on public.locations for all to anon using (true) with check (true);

drop policy if exists "Prototype read pm templates" on public.pm_templates;
create policy "Prototype read pm templates" on public.pm_templates for select to anon using (true);
drop policy if exists "Prototype write pm templates" on public.pm_templates;
create policy "Prototype write pm templates" on public.pm_templates for all to anon using (true) with check (true);

drop policy if exists "Prototype read assets" on public.assets;
create policy "Prototype read assets" on public.assets for select to anon using (true);
drop policy if exists "Prototype write assets" on public.assets;
create policy "Prototype write assets" on public.assets for all to anon using (true) with check (true);

drop policy if exists "Prototype read work orders" on public.work_orders;
create policy "Prototype read work orders" on public.work_orders for select to anon using (true);
drop policy if exists "Prototype write work orders" on public.work_orders;
create policy "Prototype write work orders" on public.work_orders for all to anon using (true) with check (true);

drop policy if exists "Prototype read pm history" on public.pm_history;
create policy "Prototype read pm history" on public.pm_history for select to anon using (true);
drop policy if exists "Prototype write pm history" on public.pm_history;
create policy "Prototype write pm history" on public.pm_history for all to anon using (true) with check (true);

drop policy if exists "Prototype read asset files" on public.asset_files;
create policy "Prototype read asset files" on public.asset_files for select to anon using (true);
drop policy if exists "Prototype write asset files" on public.asset_files;
create policy "Prototype write asset files" on public.asset_files for all to anon using (true) with check (true);

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
  status text not null default 'Open',
  priority text not null default 'Medium',
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
