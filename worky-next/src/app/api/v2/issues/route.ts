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
          i.source_url, i.source, i.internal_notes, i.updated_at
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
          i.source_url, i.source, i.internal_notes, i.updated_at
        from public.issues i
        join public.sites s on s.id = i.site_id
        left join public.units u on u.id = i.unit_id
        order by i.reported_at desc, i.created_at desc
      `

  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const body = await request.json()
  const siteId = String(body.site_id || '').trim()
  const issueNumber = String(body.issue_number || '').trim()
  if (!siteId || !issueNumber) return NextResponse.json({ error: 'Site and issue number are required.' }, { status: 400 })

  const equipmentName = String(body.equipment_name || '').trim()
  const serialNumber = String(body.serial_number || '').trim()
  const status = ['open', 'in_progress', 'scheduled', 'waiting_parts', 'resolved', 'closed'].includes(body.status) ? body.status : 'open'
  const priority = ['low', 'normal', 'high', 'critical'].includes(body.priority) ? body.priority : 'normal'
  const [unit] = equipmentName
    ? await sql`select id, serial_number from public.units where site_id = ${siteId} and lower(tag) = lower(${equipmentName}) limit 1`
    : []
  const serial = serialNumber || unit?.serial_number || null
  const [existing] = await sql`
    select id from public.issues
    where site_id = ${siteId} and source = 'manual' and external_reference = ${issueNumber}
    limit 1
  `

  const row = existing
    ? (await sql`
        update public.issues set
          unit_id = ${unit?.id || null}, title = ${issueNumber}, description = ${String(body.description || '').trim() || null},
          equipment_name = ${equipmentName || null}, equipment_serial_number = ${serial}, status = ${status}, priority = ${priority},
          source_url = ${String(body.source_url || '').trim() || null}, updated_at = now()
        where id = ${existing.id}
        returning *
      `)[0]
    : (await sql`
        insert into public.issues
          (site_id, unit_id, title, description, equipment_name, equipment_serial_number, status, priority, source, external_reference, source_url)
        values
          (${siteId}, ${unit?.id || null}, ${issueNumber}, ${String(body.description || '').trim() || null}, ${equipmentName || null}, ${serial}, ${status}, ${priority}, 'manual', ${issueNumber}, ${String(body.source_url || '').trim() || null})
        returning *
      `)[0]

  return NextResponse.json(row, { status: existing ? 200 : 201 })
}
