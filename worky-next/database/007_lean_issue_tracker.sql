begin;

alter table public.issues
  alter column asr_id drop not null,
  add column if not exists equipment_name text,
  add column if not exists equipment_serial_number text,
  add column if not exists source_url text;

create index if not exists issues_external_reference_idx
  on public.issues(site_id, source, external_reference);

commit;
