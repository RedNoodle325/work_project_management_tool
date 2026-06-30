import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const [customers, sites, updates, documents] = await Promise.all([
    sql`select count(*)::int as count from public.customers where status = 'active'`,
    sql`select * from public.site_overview order by coalesce(last_update_at, created_at) desc`,
    sql`
      select su.*, s.name as site_name, s.status as site_status, l.campus_code, c.name as customer_name,
        (select count(*)::int from public.attachments a where a.update_id = su.id) as attachment_count
      from public.site_updates su
      join public.sites s on s.id = su.site_id
      join public.locations l on l.id = s.location_id
      join public.customers c on c.id = l.customer_id
      order by su.is_pinned desc, su.created_at desc limit 20
    `,
    sql`
      select a.*, s.name as site_name, l.campus_code
      from public.attachments a
      join public.sites s on s.id = a.site_id
      join public.locations l on l.id = s.location_id
      order by a.created_at desc limit 8
    `,
  ])

  return NextResponse.json({ customer_count: customers[0]?.count || 0, sites, updates, documents })
}
