import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, issueRowsById, nextIssueNumber } from '@/lib/leanIssues'
import sql from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const body = await request.json()

  const [current] = await sql`select * from public.issues where id = ${id}`
  if (!current) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
  const keys = Object.keys(body)
  if (keys.length === 1 && keys[0] === 'internal_notes') {
    await sql`
      update public.issues
      set internal_notes = ${String(body.internal_notes || '').trim() || null}, updated_at = now()
      where id = ${id}
    `
    const [issue] = await issueRowsById(id)
    return NextResponse.json(issue)
  }

  const saved = await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    const siteId = String(body.site_id || current.site_id).trim()
    await trx`select pg_advisory_xact_lock(hashtext(${siteId}))`
    const equipmentName = body.equipment_name === undefined ? current.equipment_name : String(body.equipment_name || '').trim()
    const serialNumber = body.serial_number === undefined ? current.equipment_serial_number : String(body.serial_number || '').trim()
    const [unit] = equipmentName
      ? await trx`select id, serial_number from public.units where site_id = ${siteId} and lower(tag) = lower(${equipmentName}) limit 1`
      : []
    const issueNumber = body.issue_number === undefined
      ? String(current.external_reference || current.title || '').trim()
      : String(body.issue_number || '').trim() || await nextIssueNumber(trx, siteId)
    const source = String(current.source || 'manual')
    const [duplicate] = await trx`
      select id from public.issues
      where id <> ${id}
        and site_id = ${siteId}
        and coalesce(source, 'manual') = ${source}
        and external_reference = ${issueNumber}
      limit 1
    `
    if (duplicate) throw new Error(`Issue ${issueNumber} already exists for this site.`)
    const status = ISSUE_STATUSES.includes(body.status) ? body.status : current.status
    const priority = ISSUE_PRIORITIES.includes(body.priority) ? body.priority : current.priority
    const [row] = await trx`
      update public.issues set
        site_id = ${siteId},
        unit_id = ${unit?.id || (equipmentName ? null : current.unit_id)},
        title = ${issueNumber},
        description = ${body.description === undefined ? current.description : String(body.description || '').trim() || null},
        equipment_name = ${equipmentName || null},
        equipment_serial_number = ${serialNumber || unit?.serial_number || null},
        status = ${status},
        priority = ${priority},
        external_reference = ${issueNumber},
        source_url = ${body.source_url === undefined ? current.source_url : String(body.source_url || '').trim() || null},
        internal_notes = ${body.internal_notes === undefined ? current.internal_notes : String(body.internal_notes || '').trim() || null},
        updated_at = now()
      where id = ${id}
      returning id
    `
    return row
  }).catch(error => {
    if (error instanceof Error) return { error: error.message }
    return { error: 'Unable to save issue.' }
  })

  if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 })
  const [issue] = await issueRowsById(saved.id)
  return NextResponse.json(issue)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const [deleted] = await sql`delete from public.issues where id = ${id} returning id`
  if (!deleted) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
