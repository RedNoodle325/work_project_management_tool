begin;

alter table public.users drop constraint if exists users_access_role_check;
alter table public.users add constraint users_access_role_check
  check (access_role in ('owner','admin','service_ops','project_manager','sales','technician','scheduler','viewer'));

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  request_type text not null check (request_type in ('billable','startup','warranty')),
  site_id uuid references public.sites(id) on delete set null,
  site_name text not null,
  site_address text not null,
  site_contact_name text not null,
  site_contact_details text not null,
  unit_serial_number text not null,
  region text not null check (region in ('Americas','EMEA','APAC')),
  requested_scope text not null,
  requested_service_date date not null,
  po_number text,
  payment_evidence text,
  contract_language text,
  c2_number text,
  warranty_start_date date,
  warranty_end_date date,
  warranty_details text,
  status text not null default 'pending_review' check (status in ('pending_review','returned','approved','cancelled')),
  requested_by uuid not null references public.users(id) on delete restrict,
  reviewed_by uuid references public.users(id) on delete set null,
  review_notes text,
  resulting_job_id uuid references public.job_schedule(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_status_created_idx on public.service_requests(status, created_at desc);
create index if not exists service_requests_requested_by_idx on public.service_requests(requested_by, created_at desc);
create index if not exists service_requests_site_idx on public.service_requests(site_id) where site_id is not null;

commit;
