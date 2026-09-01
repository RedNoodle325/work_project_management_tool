-- Formalizes the technician scheduler / work order system (the API routes in
-- src/app/api/technicians, /api/job-schedule, and /api/dispatch already assumed
-- these tables but no migration ever created them), and adds a standalone parts
-- order tracker. Safe to run repeatedly.
begin;

-- Distance-based dispatch (src/app/api/dispatch/techs-for-site) needs the site's
-- coordinates; nothing else in the schema carries them yet.
alter table public.sites add column if not exists latitude numeric(9,6);
alter table public.sites add column if not exists longitude numeric(9,6);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  location_city text,
  location_state text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  color text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_schedule (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  pm_id uuid references public.users(id) on delete set null,
  job_name text not null,
  job_type text not null default 'Warranty',
  contract_number text,
  priority integer not null default 3,
  start_date date,
  end_date date,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'on_hold', 'complete', 'cancelled')),
  notes text,
  scope text,
  techs_needed integer not null default 1 check (techs_needed > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.job_schedule_techs (
  job_id uuid not null references public.job_schedule(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, technician_id)
);

create table if not exists public.parts_orders (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  job_id uuid references public.job_schedule(id) on delete set null,
  part_number text,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  status text not null default 'needed' check (status in ('needed', 'ordered', 'shipped', 'received', 'installed', 'cancelled')),
  supplier text,
  order_number text,
  requested_by text,
  ordered_at date,
  expected_at date,
  received_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_schedule_site_idx on public.job_schedule(site_id);
create index if not exists job_schedule_dates_idx on public.job_schedule(start_date, end_date);
create index if not exists job_schedule_techs_tech_idx on public.job_schedule_techs(technician_id);
create index if not exists parts_orders_site_status_idx on public.parts_orders(site_id, status);
create index if not exists parts_orders_job_idx on public.parts_orders(job_id) where job_id is not null;

-- Carry forward parts orders entered through the original ASR workflow. Each
-- item becomes a tracker row; header-only orders remain visible as one row.
insert into public.parts_orders
  (id, site_id, part_number, description, quantity, status, supplier, order_number,
   ordered_at, expected_at, received_at, notes, created_at, updated_at)
select
  item.id, request.site_id, item.part_number, item.description, item.quantity,
  case order_row.status
    when 'quoted' then 'needed'
    when 'partially_received' then 'received'
    else order_row.status
  end,
  order_row.supplier, order_row.order_number, order_row.ordered_at, order_row.expected_at,
  order_row.received_at, order_row.notes, order_row.created_at, order_row.updated_at
from public.part_order_items item
join public.part_orders order_row on order_row.id = item.part_order_id
join public.asrs request on request.id = order_row.asr_id
on conflict (id) do nothing;

insert into public.parts_orders
  (id, site_id, description, quantity, status, supplier, order_number,
   ordered_at, expected_at, received_at, notes, created_at, updated_at)
select
  order_row.id, request.site_id,
  coalesce(nullif(order_row.order_number, ''), nullif(order_row.supplier, ''), 'Parts order'),
  1,
  case order_row.status
    when 'quoted' then 'needed'
    when 'partially_received' then 'received'
    else order_row.status
  end,
  order_row.supplier, order_row.order_number, order_row.ordered_at, order_row.expected_at,
  order_row.received_at, order_row.notes, order_row.created_at, order_row.updated_at
from public.part_orders order_row
join public.asrs request on request.id = order_row.asr_id
where not exists (
  select 1 from public.part_order_items item where item.part_order_id = order_row.id
)
on conflict (id) do nothing;

do $$
declare table_name text;
begin
  foreach table_name in array array['technicians', 'job_schedule', 'parts_orders']
  loop
    if not exists (
      select 1 from pg_trigger where tgname = table_name || '_touch_updated_at'
    ) then
      execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
    end if;
  end loop;
end $$;

commit;
