-- Allow a site to belong directly to a customer without requiring a campus.
begin;

alter table public.sites add column if not exists customer_id uuid references public.customers(id) on delete cascade;
alter table public.sites add column if not exists city text;
alter table public.sites add column if not exists state text;
alter table public.sites add column if not exists address text;
alter table public.sites add column if not exists postal_code text;
alter table public.units add column if not exists commission_level text not null default 'none';
alter table public.units add column if not exists operational_status text;
alter table public.units add column if not exists warranty_start_date date;
alter table public.units add column if not exists warranty_end_date date;

update public.sites s
set customer_id = l.customer_id
from public.locations l
where s.location_id = l.id and s.customer_id is null;

alter table public.sites alter column customer_id set not null;
alter table public.sites alter column location_id drop not null;
alter table public.sites drop constraint if exists sites_location_id_name_key;

create unique index if not exists sites_location_name_unique_ci
  on public.sites (location_id, lower(name)) where location_id is not null;
create unique index if not exists sites_standalone_name_unique_ci
  on public.sites (customer_id, lower(name)) where location_id is null;

alter table public.sites drop constraint if exists sites_standalone_location_check;
alter table public.sites add constraint sites_standalone_location_check
  check (location_id is not null or (city is not null and state is not null));

drop view if exists public.site_overview;
create view public.site_overview as
select
  s.id,
  s.location_id,
  s.customer_id,
  s.name,
  s.site_code,
  s.building,
  l.campus_code,
  coalesce(s.city, l.city) as city,
  coalesce(s.state, l.state) as state,
  coalesce(s.address, l.address) as address,
  coalesce(s.postal_code, l.postal_code) as postal_code,
  s.address_override,
  s.status,
  s.status_summary,
  s.lifecycle_phase,
  s.access_notes,
  s.notes,
  s.last_update_at,
  s.created_at,
  s.updated_at,
  c.name as customer_name,
  (select count(*) from public.units u where u.site_id = s.id) as unit_count,
  (select count(*) from public.issues i where i.site_id = s.id and i.status not in ('resolved','closed')) as open_issue_count,
  (select count(*) from public.asrs a where a.site_id = s.id and a.status not in ('complete','cancelled')) as active_asr_count,
  (select count(*) from public.part_orders po join public.asrs a on a.id = po.asr_id where a.site_id = s.id and po.status not in ('received','installed','cancelled')) as pending_part_order_count,
  (select su.summary from public.site_updates su where su.site_id = s.id order by su.created_at desc limit 1) as latest_update,
  (select count(*) from public.units u where u.site_id = s.id and (u.commission_level in ('L5','complete','completed','commissioned') or u.status in ('active','attention','offline','retired'))) as commissioned_unit_count,
  (select count(*) from public.units u where u.site_id = s.id and (u.status = 'commissioning' or u.commission_level in ('L1','L2','L3','L4'))) as commissioning_unit_count,
  case
    when (select count(*) from public.units u where u.site_id = s.id) = 0 then 0
    else floor(
      100.0
      * (select count(*) from public.units u where u.site_id = s.id and (u.commission_level in ('L5','complete','completed','commissioned') or u.status in ('active','attention','offline','retired')))
      / nullif((select count(*) from public.units u where u.site_id = s.id), 0)
    )::int
  end as commissioning_percent,
  (select count(*) from public.units u where u.site_id = s.id and u.warranty_end_date >= current_date) as warranty_active_unit_count,
  (select count(*) from public.units u where u.site_id = s.id and u.warranty_end_date >= current_date and u.warranty_end_date <= current_date + interval '90 days') as warranty_expiring_unit_count,
  (select count(*) from public.units u where u.site_id = s.id and u.warranty_end_date < current_date) as warranty_expired_unit_count,
  (select count(*) from public.units u where u.site_id = s.id and u.warranty_end_date is null) as warranty_missing_unit_count,
  coalesce((
    select jsonb_object_agg(unit_status, status_count)
    from (
      select u.status as unit_status, count(*)::int as status_count
      from public.units u
      where u.site_id = s.id
      group by u.status
    ) unit_statuses
  ), '{}'::jsonb) as unit_status_counts
from public.sites s
left join public.locations l on l.id = s.location_id
join public.customers c on c.id = s.customer_id;

commit;
