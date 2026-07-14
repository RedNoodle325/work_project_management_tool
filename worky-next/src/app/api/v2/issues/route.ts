import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  const siteId = request.nextUrl.searchParams.get('site_id')

  const rows = siteId
    ? await sql`
        select i.id, i.site_id, s.name as site_name,
          coalesce(i.external_reference, i.title) as issue_number,
          i.description,
          coalesce(i.equipment_name, u.tag) as equipment_name,
          coalesce(i.equipment_serial_number, u.serial_number) as serial_number,
          i.source_url, i.source, i.updated_at
        from public.issues i
        join public.sites s on s.id = i.site_id
        left join public.units u on u.id = i.unit_id
        where i.site_id = ${siteId}
        order by i.reported_at desc, i.created_at desc
      `
    : await sql`
        select i.id, i.site_id, s.name as site_name,
          coalesce(i.external_reference, i.title) as issue_number,
          i.description,
          coalesce(i.equipment_name, u.tag) as equipment_name,
          coalesce(i.equipment_serial_number, u.serial_number) as serial_number,
          i.source_url, i.source, i.updated_at
        from public.issues i
        join public.sites s on s.id = i.site_id
        left join public.units u on u.id = i.unit_id
        order by i.reported_at desc, i.created_at desc
      `

  return NextResponse.json(rows)
}
