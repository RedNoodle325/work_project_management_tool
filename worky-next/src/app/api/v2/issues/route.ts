import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, issueRowsById, nextIssueNumber } from '@/lib/leanIssues'
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
          i.status, i.priority,
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
          i.status, i.priority,
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
  if (!siteId) return NextResponse.json({ error: 'Site is required.' }, { status: 400 })

  const equipmentName = String(body.equipment_name || '').trim()
  const serialNumber = String(body.serial_number || '').trim()
  const status = ISSUE_STATUSES.includes(body.status) ? body.status : 'open'
  const priority = ISSUE_PRIORITIES.includes(body.priority) ? body.priority : 'normal'
  const [unit] = equipmentName
    ? await sql`select id, serial_number from public.units where site_id = ${siteId} and lower(tag) = lower(${equipmentName}) limit 1`
    : []
  const serial = serialNumber || unit?.serial_number || null

  const row = await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    await trx`select pg_advisory_xact_lock(hashtext(${siteId}))`
    const issueNumber = String(body.issue_number || '').trim() || await nextIssueNumber(trx, siteId)
    const [existing] = await trx`
      select id from public.issues
      where site_id = ${siteId} and source = 'manual' and external_reference = ${issueNumber}
      limit 1
    `
    const saved = existing
      ? (await trx`
          update public.issues set
            unit_id = ${unit?.id || null}, title = ${issueNumber}, description = ${String(body.description || '').trim() || null},
            equipment_name = ${equipmentName || null}, equipment_serial_number = ${serial}, status = ${status}, priority = ${priority},
            source_url = ${String(body.source_url || '').trim() || null}, updated_at = now()
          where id = ${existing.id}
          returning id
        `)[0]
      : (await trx`
          insert into public.issues
            (site_id, unit_id, title, description, equipment_name, equipment_serial_number, status, priority, source, external_reference, source_url)
          values
            (${siteId}, ${unit?.id || null}, ${issueNumber}, ${String(body.description || '').trim() || null}, ${equipmentName || null}, ${serial}, ${status}, ${priority}, 'manual', ${issueNumber}, ${String(body.source_url || '').trim() || null})
          returning id
        `)[0]
    return saved
  })

  const [issue] = await issueRowsById(row.id)
  return NextResponse.json(issue, { status: 201 })
}
