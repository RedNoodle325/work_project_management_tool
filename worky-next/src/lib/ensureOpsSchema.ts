import sql from './db'

let schemaReady: Promise<void> | null = null

async function initialize() {
  await sql`alter table public.sites add column if not exists latitude numeric(9,6)`
  await sql`alter table public.sites add column if not exists longitude numeric(9,6)`
  await sql`
    create table if not exists public.technicians (
      id uuid primary key default gen_random_uuid(), name text not null, first_name text, last_name text,
      phone text, email text, home_zip text,
      location_city text, location_state text, latitude numeric(9,6), longitude numeric(9,6),
      color text, is_active boolean not null default true, notes text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )
  `
  await sql`alter table public.technicians add column if not exists first_name text`
  await sql`alter table public.technicians add column if not exists last_name text`
  await sql`alter table public.technicians add column if not exists home_zip text`
  await sql`
    update public.technicians
    set first_name = coalesce(first_name, split_part(name, ' ', 1)),
        last_name = coalesce(last_name, case when position(' ' in name) > 0 then btrim(substr(name, position(' ' in name) + 1)) else '' end)
    where first_name is null or last_name is null
  `
  await sql`
    create table if not exists public.job_schedule (
      id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
      pm_id uuid references public.users(id) on delete set null, job_name text not null,
      job_type text not null default 'Warranty', contract_number text, priority integer not null default 3,
      start_date date, end_date date, status text not null default 'scheduled', notes text, scope text,
      techs_needed integer not null default 1, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `
  await sql`
    create table if not exists public.job_schedule_techs (
      job_id uuid not null references public.job_schedule(id) on delete cascade,
      technician_id uuid not null references public.technicians(id) on delete cascade,
      created_at timestamptz not null default now(), primary key (job_id, technician_id)
    )
  `
  await sql`
    create table if not exists public.parts_orders (
      id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
      job_id uuid references public.job_schedule(id) on delete set null, part_number text, description text not null,
      quantity numeric(12,2) not null default 1, status text not null default 'needed', supplier text,
      order_number text, requested_by text, ordered_at date, expected_at date, received_at date, notes text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )
  `
  await sql`create index if not exists job_schedule_site_idx on public.job_schedule(site_id)`
  await sql`create index if not exists technicians_home_zip_idx on public.technicians(home_zip) where home_zip is not null`
  await sql`create index if not exists job_schedule_dates_idx on public.job_schedule(start_date, end_date)`
  await sql`create index if not exists job_schedule_techs_tech_idx on public.job_schedule_techs(technician_id)`
  await sql`create index if not exists parts_orders_site_status_idx on public.parts_orders(site_id, status)`
  await sql`
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
    on conflict (id) do nothing
  `
  await sql`
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
    where not exists (select 1 from public.part_order_items item where item.part_order_id = order_row.id)
    on conflict (id) do nothing
  `
}

export async function ensureOpsSchema() {
  if (!schemaReady) {
    schemaReady = initialize().catch(error => {
      schemaReady = null
      throw error
    })
  }
  await schemaReady
}
