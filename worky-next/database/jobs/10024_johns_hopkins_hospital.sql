-- Idempotent setup for job 10024.
-- Run after 005_project_representatives.sql.
begin;

insert into public.customers (name, code, status, notes)
values ('Johns Hopkins Hospital', 'JHH', 'active', 'End user for job 10024.')
on conflict do nothing;

insert into public.representatives (name, code, notes)
values ('ATS', 'ATS', 'Primary representative for job 10024.')
on conflict do nothing;

do $$
declare
  customer_uuid uuid;
  representative_uuid uuid;
  site_uuid uuid;
begin
  select id into customer_uuid from public.customers where lower(name) = lower('Johns Hopkins Hospital');
  select id into representative_uuid from public.representatives where lower(name) = lower('ATS');

  select id into site_uuid
  from public.sites
  where customer_id = customer_uuid and location_id is null and lower(name) = lower('Johns Hopkins Hospital');

  if site_uuid is null then
    insert into public.sites
      (customer_id, name, city, state, status, lifecycle_phase, notes)
    values
      (customer_uuid, 'Johns Hopkins Hospital', 'Baltimore', 'MD', 'planning', 'commissioning',
       'New CRAH commissioning job. L2 Rev01 and L3 Rev02 startup checklist templates provided.')
    returning id into site_uuid;
  end if;

  if not exists (select 1 from public.projects where project_number = '10024') then
    insert into public.projects
      (site_id, representative_id, project_number, name, status, is_primary, notes)
    values
      (site_uuid, representative_uuid, '10024', 'Johns Hopkins Hospital CRAH startup', 'active', true,
       'Representative: ATS. Source documents: 2026-03-09 L2 Rev01 and 2026-02-27 L3 Rev02 startup checklists.');
  end if;
end $$;

commit;
