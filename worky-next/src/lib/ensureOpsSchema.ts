import sql from './db'

let schemaReady: Promise<void> | null = null

async function initialize() {
  await sql`alter table public.sites add column if not exists latitude numeric(9,6)`
  await sql`alter table public.sites add column if not exists longitude numeric(9,6)`
  await sql`
    alter table public.units add column if not exists commissioning_status text not null default 'not_required'
    check (commissioning_status in ('not_required', 'pre_startup_testing', 'ready_for_startup', 'startup',
      'ready_for_commissioning', 'commissioning', 'commissioned', 'recommissioning_required', 'recommissioning'))
  `
  await sql`update public.units set commissioning_status = 'commissioned' where build_stage = 'commissioned' and commissioning_status = 'not_required'`
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
  await sql`alter table public.job_schedule add column if not exists work_order_number text`
  await sql`
    alter table public.job_schedule add column if not exists unit_scope_mode text not null default 'site_wide'
    check (unit_scope_mode in ('site_wide', 'selected_units', 'all_units', 'all_fans'))
  `
  await sql`update public.job_schedule set status = 'closed' where status = 'complete'`
  await sql`
    with numbered as (
      select id,
        'WO-' || to_char(created_at at time zone 'America/New_York', 'YYYYMMDD') || '-' ||
        case lower(job_type)
          when 'warranty' then 'WAR'
          when 'billable service' then 'BSV'
          when 'service' then 'BSV'
          when 'billable startup' then 'BSU'
          when 'commissioning' then 'BSU'
          else 'OTH'
        end || '-' ||
        lpad(row_number() over (
          partition by (created_at at time zone 'America/New_York')::date,
          case lower(job_type)
            when 'warranty' then 'WAR' when 'billable service' then 'BSV' when 'service' then 'BSV'
            when 'billable startup' then 'BSU' when 'commissioning' then 'BSU' else 'OTH' end
          order by created_at, id
        )::text, 3, '0') as number
      from public.job_schedule where work_order_number is null
    )
    update public.job_schedule j set work_order_number = numbered.number
    from numbered where j.id = numbered.id
  `
  await sql`create unique index if not exists job_schedule_work_order_number_uidx on public.job_schedule(work_order_number)`
  await sql`
    create table if not exists public.technician_calendar_events (
      id uuid primary key default gen_random_uuid(),
      technician_id uuid references public.technicians(id) on delete cascade,
      event_type text not null check (event_type in ('day_off', 'travel', 'holiday', 'pto')),
      title text, start_date date not null, end_date date not null, notes text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      check (end_date >= start_date), check (technician_id is not null or event_type = 'holiday')
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
    create table if not exists public.job_schedule_lines (
      id uuid primary key default gen_random_uuid(),
      job_id uuid not null references public.job_schedule(id) on delete cascade,
      line_number integer not null, start_date date not null, end_date date not null,
      techs_needed integer not null default 1, scope text, notes text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique(job_id, line_number), check (end_date >= start_date), check (techs_needed > 0)
    )
  `
  await sql`
    create table if not exists public.job_schedule_line_techs (
      line_id uuid not null references public.job_schedule_lines(id) on delete cascade,
      technician_id uuid not null references public.technicians(id) on delete cascade,
      created_at timestamptz not null default now(), primary key (line_id, technician_id)
    )
  `
  await sql`
    create table if not exists public.job_schedule_units (
      job_id uuid not null references public.job_schedule(id) on delete cascade,
      unit_id uuid not null references public.units(id) on delete cascade,
      created_at timestamptz not null default now(), primary key (job_id, unit_id)
    )
  `
  await sql`
    insert into public.job_schedule_lines (job_id, line_number, start_date, end_date, techs_needed, scope, notes)
    select j.id, 1, coalesce(j.start_date, j.created_at::date),
      coalesce(j.end_date, j.start_date, j.created_at::date), j.techs_needed, j.scope, j.notes
    from public.job_schedule j
    where not exists (select 1 from public.job_schedule_lines l where l.job_id = j.id)
      and (j.start_date is not null or exists (select 1 from public.job_schedule_techs jt where jt.job_id = j.id))
  `
  await sql`
    insert into public.job_schedule_line_techs (line_id, technician_id)
    select l.id, jt.technician_id
    from public.job_schedule_lines l join public.job_schedule_techs jt on jt.job_id = l.job_id
    where l.line_number = 1 on conflict do nothing
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
  await sql`create index if not exists technician_calendar_events_dates_idx on public.technician_calendar_events(start_date, end_date)`
  await sql`create index if not exists technician_calendar_events_tech_idx on public.technician_calendar_events(technician_id) where technician_id is not null`
  await sql`create index if not exists job_schedule_dates_idx on public.job_schedule(start_date, end_date)`
  await sql`create index if not exists job_schedule_techs_tech_idx on public.job_schedule_techs(technician_id)`
  await sql`create index if not exists job_schedule_lines_job_dates_idx on public.job_schedule_lines(job_id, start_date, end_date)`
  await sql`create index if not exists job_schedule_line_techs_tech_idx on public.job_schedule_line_techs(technician_id)`
  await sql`create index if not exists job_schedule_units_unit_idx on public.job_schedule_units(unit_id)`
  await sql`create index if not exists units_commissioning_status_idx on public.units(commissioning_status)`
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
