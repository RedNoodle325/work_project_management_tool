-- Allow a site to belong directly to a customer without requiring a campus.
begin;

alter table public.sites add column if not exists customer_id uuid references public.customers(id) on delete cascade;
alter table public.sites add column if not exists city text;
alter table public.sites add column if not exists state text;
alter table public.sites add column if not exists address text;

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
  s.*,
  l.campus_code,
  coalesce(s.city, l.city) as city,
  coalesce(s.state, l.state) as state,
  coalesce(s.address, l.address) as address,
  c.name as customer_name,
  (select count(*) from public.units u where u.site_id = s.id) as unit_count,
  (select count(*) from public.issues i where i.site_id = s.id and i.status not in ('resolved','closed')) as open_issue_count,
  (select count(*) from public.asrs a where a.site_id = s.id and a.status not in ('complete','cancelled')) as active_asr_count,
  (select count(*) from public.part_orders po join public.asrs a on a.id = po.asr_id where a.site_id = s.id and po.status not in ('received','installed','cancelled')) as pending_part_order_count,
  (select su.summary from public.site_updates su where su.site_id = s.id order by su.created_at desc limit 1) as latest_update
from public.sites s
left join public.locations l on l.id = s.location_id
join public.customers c on c.id = s.customer_id;

commit;
