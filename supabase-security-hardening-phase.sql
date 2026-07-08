-- SiteWorks security hardening phase
-- Run this after your users can log in through Supabase Auth.
-- It replaces prototype anon read/write policies with authenticated, scoped policies.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists customer_id text not null default '';
alter table public.profiles add column if not exists location_id text not null default '';
alter table public.profiles add column if not exists role text not null default 'Customer';
alter table public.profiles add column if not exists name text not null default '';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.customers enable row level security;
alter table public.locations enable row level security;
alter table public.pm_templates enable row level security;
alter table public.assets enable row level security;
alter table public.work_orders enable row level security;
alter table public.service_requests enable row level security;
alter table public.pm_history enable row level security;
alter table public.asset_files enable row level security;
alter table public.profiles enable row level security;
alter table public.app_state enable row level security;
alter table public.public_reports enable row level security;

create or replace function public.siteworks_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid() limit 1), '');
$$;

create or replace function public.siteworks_current_customer_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select customer_id from public.profiles where id = auth.uid() limit 1), '');
$$;

create or replace function public.siteworks_current_location_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select location_id from public.profiles where id = auth.uid() limit 1), '');
$$;

create or replace function public.siteworks_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.siteworks_current_role() = 'Admin';
$$;

create or replace function public.siteworks_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.siteworks_current_role() in ('Admin', 'Manager', 'Facility Manager');
$$;

create or replace function public.siteworks_can_access_scope(record_customer_id text, record_location_id text default '')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.siteworks_is_admin()
      or (
        coalesce(record_customer_id, '') <> ''
        and record_customer_id = public.siteworks_current_customer_id()
        and (
          public.siteworks_current_location_id() = ''
          or coalesce(record_location_id, '') = ''
          or record_location_id = public.siteworks_current_location_id()
        )
      )
    );
$$;

-- Remove prototype policies.
drop policy if exists "Prototype read customers" on public.customers;
drop policy if exists "Prototype write customers" on public.customers;
drop policy if exists "Prototype read locations" on public.locations;
drop policy if exists "Prototype write locations" on public.locations;
drop policy if exists "Prototype read pm templates" on public.pm_templates;
drop policy if exists "Prototype write pm templates" on public.pm_templates;
drop policy if exists "Prototype read assets" on public.assets;
drop policy if exists "Prototype write assets" on public.assets;
drop policy if exists "Prototype read work orders" on public.work_orders;
drop policy if exists "Prototype write work orders" on public.work_orders;
drop policy if exists "Prototype read service requests" on public.service_requests;
drop policy if exists "Prototype write service requests" on public.service_requests;
drop policy if exists "Prototype read pm history" on public.pm_history;
drop policy if exists "Prototype write pm history" on public.pm_history;
drop policy if exists "Prototype read asset files" on public.asset_files;
drop policy if exists "Prototype write asset files" on public.asset_files;
drop policy if exists "Anyone can read profiles for prototype auth" on public.profiles;
drop policy if exists "Anyone can create profiles for prototype auth" on public.profiles;
drop policy if exists "Anyone can update profiles for prototype auth" on public.profiles;
drop policy if exists "Anyone can delete profiles for prototype auth" on public.profiles;
drop policy if exists "Anyone can read shared app data for prototype sync" on public.app_state;
drop policy if exists "Anyone can create shared app data for prototype sync" on public.app_state;
drop policy if exists "Anyone can update shared app data for prototype sync" on public.app_state;
drop policy if exists "Anyone can submit public QR reports" on public.public_reports;
drop policy if exists "Anyone can read public QR reports for prototype sync" on public.public_reports;
drop policy if exists "SiteWorks profiles scoped read" on public.profiles;
drop policy if exists "SiteWorks profiles scoped insert" on public.profiles;
drop policy if exists "SiteWorks profiles scoped update" on public.profiles;
drop policy if exists "SiteWorks profiles admin delete" on public.profiles;
drop policy if exists "SiteWorks customers scoped read" on public.customers;
drop policy if exists "SiteWorks customers admin write" on public.customers;
drop policy if exists "SiteWorks locations scoped read" on public.locations;
drop policy if exists "SiteWorks locations manager write" on public.locations;
drop policy if exists "SiteWorks templates authenticated read" on public.pm_templates;
drop policy if exists "SiteWorks templates admin write" on public.pm_templates;
drop policy if exists "SiteWorks assets scoped read" on public.assets;
drop policy if exists "SiteWorks assets manager write" on public.assets;
drop policy if exists "SiteWorks work orders scoped read" on public.work_orders;
drop policy if exists "SiteWorks work orders scoped write" on public.work_orders;
drop policy if exists "SiteWorks service requests scoped read" on public.service_requests;
drop policy if exists "SiteWorks service requests scoped write" on public.service_requests;
drop policy if exists "SiteWorks PM history scoped read" on public.pm_history;
drop policy if exists "SiteWorks PM history scoped write" on public.pm_history;
drop policy if exists "SiteWorks asset files scoped read" on public.asset_files;
drop policy if exists "SiteWorks asset files scoped write" on public.asset_files;
drop policy if exists "SiteWorks app state authenticated read" on public.app_state;
drop policy if exists "SiteWorks app state authenticated write" on public.app_state;
drop policy if exists "SiteWorks public reports anonymous submit" on public.public_reports;
drop policy if exists "SiteWorks public reports authenticated submit" on public.public_reports;
drop policy if exists "SiteWorks public reports scoped read" on public.public_reports;
drop policy if exists "SiteWorks public reports authenticated read" on public.public_reports;
drop policy if exists "SiteWorks public reports manager update" on public.public_reports;

-- Profiles: users can see their own profile; managers/admins can see scoped users.
create policy "SiteWorks profiles scoped read"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.siteworks_is_admin()
  or (
    public.siteworks_is_manager()
    and customer_id = public.siteworks_current_customer_id()
    and (public.siteworks_current_location_id() = '' or location_id = public.siteworks_current_location_id() or location_id = '')
  )
);

create policy "SiteWorks profiles scoped insert"
on public.profiles
for insert
to authenticated
with check (
  (id = auth.uid() and role = 'Customer')
  or public.siteworks_is_admin()
  or (
    public.siteworks_is_manager()
    and role <> 'Admin'
    and customer_id = public.siteworks_current_customer_id()
    and (public.siteworks_current_location_id() = '' or location_id = public.siteworks_current_location_id() or location_id = '')
  )
);

create policy "SiteWorks profiles scoped update"
on public.profiles
for update
to authenticated
using (
  public.siteworks_is_admin()
  or (
    public.siteworks_is_manager()
    and customer_id = public.siteworks_current_customer_id()
    and role <> 'Admin'
  )
)
with check (
  public.siteworks_is_admin()
  or (
    public.siteworks_is_manager()
    and role <> 'Admin'
    and customer_id = public.siteworks_current_customer_id()
  )
);

create policy "SiteWorks profiles admin delete"
on public.profiles
for delete
to authenticated
using (public.siteworks_is_admin());

-- Core data.
create policy "SiteWorks customers scoped read"
on public.customers for select to authenticated
using (public.siteworks_is_admin() or id = public.siteworks_current_customer_id());

create policy "SiteWorks customers admin write"
on public.customers for all to authenticated
using (public.siteworks_is_admin())
with check (public.siteworks_is_admin());

create policy "SiteWorks locations scoped read"
on public.locations for select to authenticated
using (public.siteworks_can_access_scope(customer_id, id));

create policy "SiteWorks locations manager write"
on public.locations for all to authenticated
using (public.siteworks_is_admin() or (public.siteworks_is_manager() and customer_id = public.siteworks_current_customer_id()))
with check (public.siteworks_is_admin() or (public.siteworks_is_manager() and customer_id = public.siteworks_current_customer_id()));

create policy "SiteWorks templates authenticated read"
on public.pm_templates for select to authenticated
using (true);

create policy "SiteWorks templates admin write"
on public.pm_templates for all to authenticated
using (public.siteworks_is_admin())
with check (public.siteworks_is_admin());

create policy "SiteWorks assets scoped read"
on public.assets for select to authenticated
using (public.siteworks_can_access_scope(customer_id, location_id));

create policy "SiteWorks assets manager write"
on public.assets for all to authenticated
using (public.siteworks_is_admin() or (public.siteworks_is_manager() and public.siteworks_can_access_scope(customer_id, location_id)))
with check (public.siteworks_is_admin() or (public.siteworks_is_manager() and public.siteworks_can_access_scope(customer_id, location_id)));

create policy "SiteWorks work orders scoped read"
on public.work_orders for select to authenticated
using (public.siteworks_can_access_scope(customer_id, location_id));

create policy "SiteWorks work orders scoped write"
on public.work_orders for all to authenticated
using (public.siteworks_can_access_scope(customer_id, location_id))
with check (public.siteworks_can_access_scope(customer_id, location_id));

create policy "SiteWorks service requests scoped read"
on public.service_requests for select to authenticated
using (public.siteworks_can_access_scope(customer_id, location_id));

create policy "SiteWorks service requests scoped write"
on public.service_requests for all to authenticated
using (public.siteworks_can_access_scope(customer_id, location_id))
with check (public.siteworks_can_access_scope(customer_id, location_id));

create policy "SiteWorks PM history scoped read"
on public.pm_history for select to authenticated
using (
  exists (
    select 1 from public.assets
    where assets.id = pm_history.asset_id
      and public.siteworks_can_access_scope(assets.customer_id, assets.location_id)
  )
);

create policy "SiteWorks PM history scoped write"
on public.pm_history for all to authenticated
using (
  exists (
    select 1 from public.assets
    where assets.id = pm_history.asset_id
      and public.siteworks_can_access_scope(assets.customer_id, assets.location_id)
  )
)
with check (
  exists (
    select 1 from public.assets
    where assets.id = pm_history.asset_id
      and public.siteworks_can_access_scope(assets.customer_id, assets.location_id)
  )
);

create policy "SiteWorks asset files scoped read"
on public.asset_files for select to authenticated
using (
  exists (
    select 1 from public.assets
    where assets.id = asset_files.asset_id
      and public.siteworks_can_access_scope(assets.customer_id, assets.location_id)
  )
);

create policy "SiteWorks asset files scoped write"
on public.asset_files for all to authenticated
using (
  exists (
    select 1 from public.assets
    where assets.id = asset_files.asset_id
      and public.siteworks_can_access_scope(assets.customer_id, assets.location_id)
  )
)
with check (
  exists (
    select 1 from public.assets
    where assets.id = asset_files.asset_id
      and public.siteworks_can_access_scope(assets.customer_id, assets.location_id)
  )
);

-- Shared snapshot is now login-only. The next server phase will remove this direct table sync entirely.
create policy "SiteWorks app state authenticated read"
on public.app_state for select to authenticated
using (true);

create policy "SiteWorks app state authenticated write"
on public.app_state for all to authenticated
using (true)
with check (true);

-- QR reports: anonymous users may submit only. Logged-in scoped users may import/read them.
create policy "SiteWorks public reports anonymous submit"
on public.public_reports
for insert
to anon
with check (
  length(trim(coalesce(note, ''))) > 0
  and length(coalesce(photo_data_url, '')) < 2048
);

create policy "SiteWorks public reports authenticated submit"
on public.public_reports
for insert
to authenticated
with check (
  length(trim(coalesce(note, ''))) > 0
  and length(coalesce(photo_data_url, '')) < 2048
);

create policy "SiteWorks public reports authenticated read"
on public.public_reports
for select
to authenticated
using (true);

create policy "SiteWorks public reports manager update"
on public.public_reports
for update
to authenticated
using (public.siteworks_is_manager() and public.siteworks_can_access_scope(customer_id, location_id))
with check (public.siteworks_is_manager() and public.siteworks_can_access_scope(customer_id, location_id));

-- Storage: anonymous uploads are limited to QR public-report photos. App uploads require login.
drop policy if exists "SiteWorks files public read" on storage.objects;
drop policy if exists "SiteWorks files app upload" on storage.objects;
drop policy if exists "SiteWorks files app update" on storage.objects;
drop policy if exists "SiteWorks files app delete" on storage.objects;
drop policy if exists "SiteWorks files authenticated read" on storage.objects;
drop policy if exists "SiteWorks files authenticated upload" on storage.objects;
drop policy if exists "SiteWorks files public report upload" on storage.objects;
drop policy if exists "SiteWorks files authenticated update" on storage.objects;
drop policy if exists "SiteWorks files authenticated delete" on storage.objects;

create policy "SiteWorks files authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id = 'siteworks-files');

create policy "SiteWorks files authenticated upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'siteworks-files');

create policy "SiteWorks files public report upload"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'siteworks-files'
  and name like 'public-reports/%'
);

create policy "SiteWorks files authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id = 'siteworks-files')
with check (bucket_id = 'siteworks-files');

create policy "SiteWorks files authenticated delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'siteworks-files');
