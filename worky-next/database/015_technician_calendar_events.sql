begin;

create table if not exists public.technician_calendar_events (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid references public.technicians(id) on delete cascade,
  event_type text not null check (event_type in ('day_off', 'travel', 'holiday', 'pto')),
  title text,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (technician_id is not null or event_type = 'holiday')
);

create index if not exists technician_calendar_events_dates_idx on public.technician_calendar_events(start_date, end_date);
create index if not exists technician_calendar_events_tech_idx on public.technician_calendar_events(technician_id) where technician_id is not null;

commit;
