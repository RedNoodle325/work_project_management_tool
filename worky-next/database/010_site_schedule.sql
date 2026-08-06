begin;

create table if not exists public.site_schedule_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  planned_start date not null,
  planned_working_days integer not null check (planned_working_days > 0),
  current_start date not null,
  current_working_days integer not null check (current_working_days > 0),
  weekends_are_workdays boolean not null default false,
  actual_start date,
  actual_complete date,
  status text not null default 'planned' check (status in ('planned', 'delayed', 'in_progress', 'complete', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_schedule_events_site_current_start_idx on public.site_schedule_events (site_id, current_start);

create table if not exists public.site_schedule_changes (
  id uuid primary key default gen_random_uuid(),
  schedule_event_id uuid not null references public.site_schedule_events(id) on delete cascade,
  field_name text not null,
  previous_value text,
  new_value text,
  note text,
  changed_at timestamptz not null default now()
);

create index if not exists site_schedule_changes_event_changed_idx on public.site_schedule_changes (schedule_event_id, changed_at desc);

commit;
