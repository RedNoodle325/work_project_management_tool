-- Shared employee-scheduler state. Run this once against the Railway database.
begin;

create table if not exists public.employee_scheduler_state (
  id boolean primary key default true check (id),
  data jsonb not null default '{"sites":[],"employees":[],"assignments":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

commit;
