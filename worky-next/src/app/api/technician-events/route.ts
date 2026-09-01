import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import sql from '@/lib/db'

const EVENT_TYPES = ['day_off', 'travel', 'holiday', 'pto']

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  await ensureOpsSchema()
  const weekStart = request.nextUrl.searchParams.get('week_start') || null
  const events = await sql`
    select event.*, tech.name as technician_name
    from public.technician_calendar_events event
    left join public.technicians tech on tech.id = event.technician_id
    where (${weekStart}::date is null or (event.start_date <= ${weekStart}::date + interval '6 days' and event.end_date >= ${weekStart}::date))
    order by event.start_date, event.event_type, tech.name nulls first
  `
  return NextResponse.json(events)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  await ensureOpsSchema()
  const body = await request.json()
  const eventType = String(body.event_type || '')
  const technicianId = body.technician_id || null
  if (!EVENT_TYPES.includes(eventType)) return NextResponse.json({ error: 'Choose a valid event type.' }, { status: 400 })
  if (!body.start_date || !body.end_date) return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 })
  if (eventType !== 'holiday' && !technicianId) return NextResponse.json({ error: 'Choose a technician.' }, { status: 400 })
  const [event] = await sql`
    insert into public.technician_calendar_events (technician_id, event_type, title, start_date, end_date, notes)
    values (${technicianId}, ${eventType}, ${String(body.title || '').trim() || null}, ${body.start_date}, ${body.end_date}, ${String(body.notes || '').trim() || null})
    returning *
  `
  return NextResponse.json(event, { status: 201 })
}
