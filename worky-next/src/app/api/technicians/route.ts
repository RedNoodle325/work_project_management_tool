import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const technicians = await sql`
    SELECT * FROM public.technicians ORDER BY name ASC
  `
  return NextResponse.json(technicians)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const body = await request.json()
  const {
    name,
    phone,
    email,
    location_city,
    location_state,
    latitude,
    longitude,
    color,
    is_active,
    notes,
  } = body

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const rows = await sql`
    INSERT INTO public.technicians
      (name, phone, email, location_city, location_state, latitude, longitude, color, is_active, notes)
    VALUES
      (${name}, ${phone ?? null}, ${email ?? null},
       ${location_city ?? null}, ${location_state ?? null},
       ${latitude ?? null}, ${longitude ?? null},
       ${color ?? null}, ${is_active ?? true}, ${notes ?? null})
    RETURNING *
  `
  return NextResponse.json(rows[0], { status: 201 })
}
