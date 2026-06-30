-- Project Management Tool v2
-- DESTRUCTIVE: removes every table in public except public.users.
-- Run only after taking a Supabase backup.

begin;

create extension if not exists pgcrypto;

do $$
declare
  item record;
begin
  for item in
    select tablename
    from pg_tables
    where schemaname = 'public' and tablename <> 'users'
  loop
    execute format('drop table if exists public.%I cascade', item.tablename);
  end loop;

  for item in
    select viewname
    from pg_views
    where schemaname = 'public'
  loop
    execute format('drop view if exists public.%I cascade', item.viewname);
  end loop;
end $$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customers_name_unique_ci on public.customers (lower(name));

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  campus_code text not null,
  name text,
  city text not null,
  state text not null,
  address text,
  postal_code text,
  timezone_name text not null default 'America/New_York',
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, campus_code)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  site_code text,
  building text,
  address_override text,
  status text not null default 'planning' check (status in ('planning', 'active', 'attention', 'critical', 'offline', 'complete', 'inactive')),
  status_summary text,
  lifecycle_phase text not null default 'planning' check (lifecycle_phase in ('planning', 'construction', 'commissioning', 'warranty', 'service', 'closed')),
  access_notes text,
  notes text,
  last_update_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  project_number text not null,
  name text not null,
  status text not null default 'active' check (status in ('planned', 'active', 'on_hold', 'complete', 'cancelled')),
  start_date date,
  end_date date,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_number)
);

create unique index projects_one_primary_per_site
  on public.projects(site_id) where is_primary;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  tag text not null,
  serial_number text,
  manufacturer text,
  model text,
  unit_type text,
  location_in_site text,
  status text not null default 'active' check (status in ('planned', 'installed', 'commissioning', 'active', 'attention', 'offline', 'retired')),
  install_date date,
  warranty_start_date date,
  warranty_end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, tag)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  company text,
  title text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_contacts (
  site_id uuid not null references public.sites(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (site_id, contact_id)
);

create table public.site_updates (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  status text check (status in ('planning', 'active', 'attention', 'critical', 'offline', 'complete', 'inactive')),
  summary text not null,
  details text,
  author_id uuid references public.users(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);

create table public.asrs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  asr_number text not null unique,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'scheduled', 'in_progress', 'waiting_parts', 'complete', 'cancelled')),
  opened_at date not null default current_date,
  closed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  asr_id uuid not null references public.asrs(id) on delete restrict,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'scheduled', 'in_progress', 'waiting_parts', 'resolved', 'closed')),
  source text,
  external_reference text,
  resolution text,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_visits (
  id uuid primary key default gen_random_uuid(),
  asr_id uuid not null references public.asrs(id) on delete cascade,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'scheduled', 'in_progress', 'complete', 'cancelled')),
  provider text,
  technician_names text,
  summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_work (
  id uuid primary key default gen_random_uuid(),
  service_visit_id uuid references public.service_visits(id) on delete cascade,
  asr_id uuid not null references public.asrs(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  unit_id uuid not null references public.units(id) on delete cascade,
  performed_at timestamptz not null default now(),
  technician_name text,
  work_performed text not null,
  result text,
  created_at timestamptz not null default now()
);

create table public.part_orders (
  id uuid primary key default gen_random_uuid(),
  asr_id uuid not null references public.asrs(id) on delete cascade,
  supplier text,
  order_number text,
  status text not null default 'needed' check (status in ('needed', 'quoted', 'ordered', 'partially_received', 'received', 'installed', 'cancelled')),
  ordered_at date,
  expected_at date,
  received_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.part_order_items (
  id uuid primary key default gen_random_uuid(),
  part_order_id uuid not null references public.part_orders(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  part_number text,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  received_quantity numeric(12,2) not null default 0 check (received_quantity >= 0),
  installed_quantity numeric(12,2) not null default 0 check (installed_quantity >= 0),
  created_at timestamptz not null default now()
);

create index locations_customer_idx on public.locations(customer_id);
create index sites_location_idx on public.sites(location_id);
create index projects_site_idx on public.projects(site_id);
create index units_site_idx on public.units(site_id);
create index asrs_site_idx on public.asrs(site_id);
create index asrs_project_idx on public.asrs(project_id);
create index issues_site_status_idx on public.issues(site_id, status);
create index issues_unit_idx on public.issues(unit_id);
create index issues_asr_idx on public.issues(asr_id);
create index updates_site_created_idx on public.site_updates(site_id, created_at desc);
create index work_unit_performed_idx on public.service_work(unit_id, performed_at desc);
create index part_orders_asr_idx on public.part_orders(asr_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['customers','locations','sites','projects','units','contacts','asrs','issues','service_visits','part_orders']
  loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.sync_site_from_update()
returns trigger language plpgsql as $$
begin
  update public.sites
  set status = coalesce(new.status, status),
      status_summary = new.summary,
      last_update_at = new.created_at,
      updated_at = now()
  where id = new.site_id;
  return new;
end $$;

create trigger site_updates_sync_site
after insert on public.site_updates
for each row execute function public.sync_site_from_update();

create or replace view public.site_overview as
select
  s.*,
  l.campus_code,
  l.city,
  l.state,
  l.customer_id,
  c.name as customer_name,
  (select count(*) from public.units u where u.site_id = s.id) as unit_count,
  (select count(*) from public.issues i where i.site_id = s.id and i.status not in ('resolved','closed')) as open_issue_count,
  (select count(*) from public.asrs a where a.site_id = s.id and a.status not in ('complete','cancelled')) as active_asr_count,
  (select count(*) from public.part_orders po join public.asrs a on a.id = po.asr_id where a.site_id = s.id and po.status not in ('received','installed','cancelled')) as pending_part_order_count,
  (select su.summary from public.site_updates su where su.site_id = s.id order by su.created_at desc limit 1) as latest_update
from public.sites s
join public.locations l on l.id = s.location_id
join public.customers c on c.id = l.customer_id;

commit;
