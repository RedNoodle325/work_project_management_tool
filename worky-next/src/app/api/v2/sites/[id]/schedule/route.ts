import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id: siteId } = await params
  const events = await sql`select * from public.site_schedule_events where site_id = ${siteId} order by current_start, created_at`
  const changes = await sql`select c.* from public.site_schedule_changes c join public.site_schedule_events e on e.id = c.schedule_event_id where e.site_id = ${siteId} order by c.changed_at desc`
  return NextResponse.json({ events, changes })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id: siteId } = await params
  const body = await request.json()
  const title = String(body.title || '').trim()
  const plannedStart = String(body.planned_start || '')
  const workingDays = Number(body.planned_working_days)
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(plannedStart) || !Number.isInteger(workingDays) || workingDays < 1) return NextResponse.json({ error: 'Title, planned start, and working days are required.' }, { status: 400 })
  const [event] = await sql`insert into public.site_schedule_events (site_id, title, planned_start, planned_working_days, current_start, current_working_days, weekends_are_workdays, notes) values (${siteId}, ${title}, ${plannedStart}, ${workingDays}, ${plannedStart}, ${workingDays}, ${Boolean(body.weekends_are_workdays)}, ${String(body.notes || '').trim() || null}) returning *`
  return NextResponse.json(event, { status: 201 })
}
