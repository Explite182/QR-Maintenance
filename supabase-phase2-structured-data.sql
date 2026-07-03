-- SiteWorks Phase 2 structured data setup
-- Run this in Supabase SQL Editor after Phase 1 storage setup.
-- It keeps normal searchable columns while adding a full JSON record payload per row.

alter table public.customers add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.locations add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.pm_templates add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.assets add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.work_orders add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.service_requests add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.pm_history add column if not exists data jsonb not null default '{}'::jsonb;

-- Older draft code used ticket_number in a few places. The live app now uses issue_number.
alter table public.work_orders add column if not exists issue_number integer;

create index if not exists idx_siteworks_customers_updated_at on public.customers(updated_at);
create index if not exists idx_siteworks_locations_updated_at on public.locations(updated_at);
create index if not exists idx_siteworks_templates_updated_at on public.pm_templates(updated_at);
create index if not exists idx_siteworks_assets_updated_at on public.assets(updated_at);
create index if not exists idx_siteworks_work_orders_updated_at on public.work_orders(updated_at);
create index if not exists idx_siteworks_service_requests_updated_at on public.service_requests(updated_at);
create index if not exists idx_siteworks_pm_history_completed_at on public.pm_history(completed_at);

create index if not exists idx_siteworks_assets_customer_location on public.assets(customer_id, location_id);
create index if not exists idx_siteworks_work_orders_customer_location on public.work_orders(customer_id, location_id);
create index if not exists idx_siteworks_service_requests_customer_location on public.service_requests(customer_id, location_id);
