import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

const fields = ['title', 'current_start', 'current_working_days', 'weekends_are_workdays', 'actual_start', 'actual_complete', 'status', 'notes'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id: siteId, eventId } = await params
  const body = await request.json()
  const [current] = await sql`select * from public.site_schedule_events where id = ${eventId} and site_id = ${siteId}`
  if (!current) return NextResponse.json({ error: 'Schedule event not found.' }, { status: 404 })

  const next = {
    title: String(body.title ?? current.title).trim(),
    current_start: String(body.current_start ?? current.current_start),
    current_working_days: Number(body.current_working_days ?? current.current_working_days),
    weekends_are_workdays: Boolean(body.weekends_are_workdays ?? current.weekends_are_workdays),
    actual_start: body.actual_start || null,
    actual_complete: body.actual_complete || null,
    status: String(body.status ?? current.status),
    notes: String(body.notes ?? current.notes ?? '').trim() || null,
  }
  if (!next.title || !/^\d{4}-\d{2}-\d{2}$/.test(next.current_start) || !Number.isInteger(next.current_working_days) || next.current_working_days < 1) return NextResponse.json({ error: 'Check the event title, start date, and working days.' }, { status: 400 })

  const changeNote = String(body.change_note || '').trim() || null
  const changes = fields.flatMap(field => String(current[field] ?? '') === String(next[field] ?? '') ? [] : [{ field, before: current[field], after: next[field] }])
  const event = await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    const [updated] = await trx`update public.site_schedule_events set title = ${next.title}, current_start = ${next.current_start}, current_working_days = ${next.current_working_days}, weekends_are_workdays = ${next.weekends_are_workdays}, actual_start = ${next.actual_start}, actual_complete = ${next.actual_complete}, status = ${next.status}, notes = ${next.notes}, updated_at = now() where id = ${eventId} returning *`
    for (const change of changes) await trx`insert into public.site_schedule_changes (schedule_event_id, field_name, previous_value, new_value, note) values (${eventId}, ${change.field}, ${String(change.before ?? '')}, ${String(change.after ?? '')}, ${changeNote})`
    return updated
  })
  return NextResponse.json(event)
}
