import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import sql from '@/lib/db'

const EVENT_TYPES = ['day_off', 'travel', 'holiday', 'pto']

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  await ensureOpsSchema()
  const { id } = await params
  const body = await request.json()
  const eventType = String(body.event_type || '')
  const technicianId = body.technician_id || null
  if (!EVENT_TYPES.includes(eventType)) return NextResponse.json({ error: 'Choose a valid event type.' }, { status: 400 })
  if (!body.start_date || !body.end_date) return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 })
  if (eventType !== 'holiday' && !technicianId) return NextResponse.json({ error: 'Choose a technician.' }, { status: 400 })
  const [event] = await sql`
    update public.technician_calendar_events set technician_id = ${technicianId}, event_type = ${eventType},
      title = ${String(body.title || '').trim() || null}, start_date = ${body.start_date}, end_date = ${body.end_date},
      notes = ${String(body.notes || '').trim() || null}, updated_at = now()
    where id = ${id} returning *
  `
  if (!event) return NextResponse.json({ error: 'Calendar event not found.' }, { status: 404 })
  return NextResponse.json(event)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  await ensureOpsSchema()
  const { id } = await params
  const [event] = await sql`delete from public.technician_calendar_events where id = ${id} returning id`
  if (!event) return NextResponse.json({ error: 'Calendar event not found.' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
