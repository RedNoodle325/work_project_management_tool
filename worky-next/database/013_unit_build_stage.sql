-- Replaces the invented L1-L5 commission_level scheme with the real production
-- pipeline units actually move through: production -> shipping (to customer or
-- warehouse) -> installation / set in place -> energization -> startup ->
-- functional testing -> commissioning.
-- commission_level is left in place (still read by CSV import / older filters)
-- but no longer drives the commissioning rollup below; build_stage does.
begin;

alter table public.units add column if not exists build_stage text not null default 'production'
  check (build_stage in ('production', 'shipped', 'installed', 'energized', 'startup', 'functional_testing', 'commissioned'));

alter table public.units add column if not exists ship_to text
  check (ship_to in ('customer', 'warehouse'));

-- Carry forward anything already marked complete under the old scheme.
update public.units
set build_stage = 'commissioned'
where build_stage = 'production'
  and commission_level in ('L5', 'complete', 'completed', 'commissioned');

create index if not exists units_build_stage_idx on public.units(build_stage);

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
  (select p.project_number from public.projects p where p.site_id = s.id order by p.is_primary desc, p.created_at desc limit 1) as project_number,
  (select r.name from public.projects p join public.representatives r on r.id = p.representative_id where p.site_id = s.id order by p.is_primary desc, p.created_at desc limit 1) as representative_name,
  (select count(*) from public.units u where u.site_id = s.id) as unit_count,
  (select count(*) from public.issues i where i.site_id = s.id and i.status not in ('resolved','closed')) as open_issue_count,
  (select count(*) from public.asrs a where a.site_id = s.id and a.status not in ('complete','cancelled')) as active_asr_count,
  (select count(*) from public.part_orders po join public.asrs a on a.id = po.asr_id where a.site_id = s.id and po.status not in ('received','installed','cancelled')) as pending_part_order_count,
  (select su.summary from public.site_updates su where su.site_id = s.id order by su.created_at desc limit 1) as latest_update,
  (select count(*) from public.units u where u.site_id = s.id and u.build_stage = 'commissioned') as commissioned_unit_count,
  (select count(*) from public.units u where u.site_id = s.id and u.build_stage <> 'commissioned') as commissioning_unit_count,
  case
    when (select count(*) from public.units u where u.site_id = s.id) = 0 then 0
    else floor(
      100.0
      * (select count(*) from public.units u where u.site_id = s.id and u.build_stage = 'commissioned')
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
  ), '{}'::jsonb) as unit_status_counts,
  coalesce((
    select jsonb_object_agg(stage, stage_count)
    from (
      select u.build_stage as stage, count(*)::int as stage_count
      from public.units u
      where u.site_id = s.id
      group by u.build_stage
    ) build_stages
  ), '{}'::jsonb) as build_stage_counts
from public.sites s
left join public.locations l on l.id = s.location_id
join public.customers c on c.id = s.customer_id;

commit;
