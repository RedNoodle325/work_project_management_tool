import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const [customers, sites, updates, documents] = await Promise.all([
    sql`select count(*)::int as count from public.customers where status = 'active'`,
    sql`
      select
        overview.*,
        coalesce(on_site_visits.visits, '[]'::json) as active_visits
      from public.site_overview overview
      left join lateral (
        select json_agg(json_build_object(
          'id', visit.id,
          'technician_names', visit.technician_names,
          'summary', visit.summary,
          'started_at', visit.started_at,
          'scheduled_for', visit.scheduled_for
        ) order by coalesce(visit.started_at, visit.scheduled_for) desc) as visits
        from public.service_visits visit
        join public.asrs asr on asr.id = visit.asr_id
        where asr.site_id = overview.id
          and visit.status = 'in_progress'
      ) on_site_visits on true
      order by
        case when on_site_visits.visits is not null then 0 else 1 end,
        case overview.status when 'critical' then 0 when 'attention' then 1 when 'offline' then 2 else 3 end,
        coalesce(overview.last_update_at, overview.created_at) desc
    `,
    sql`
      select su.*, s.name as site_name, s.status as site_status, l.campus_code, c.name as customer_name,
        (select count(*)::int from public.attachments a where a.update_id = su.id) as attachment_count
      from public.site_updates su
      join public.sites s on s.id = su.site_id
      left join public.locations l on l.id = s.location_id
      join public.customers c on c.id = s.customer_id
      order by su.is_pinned desc, su.created_at desc limit 20
    `,
    sql`
      select a.*, s.name as site_name, l.campus_code
      from public.attachments a
      join public.sites s on s.id = a.site_id
      left join public.locations l on l.id = s.location_id
      order by a.created_at desc limit 8
    `,
  ])

  return NextResponse.json({ customer_count: customers[0]?.count || 0, sites, updates, documents })
}
