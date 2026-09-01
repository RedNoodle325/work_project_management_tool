import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import { geocodeUSZip } from '@/lib/zipCoordinates'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const technicians = await sql`
    SELECT * FROM public.technicians ORDER BY last_name ASC NULLS LAST, first_name ASC NULLS LAST, name ASC
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
    first_name,
    last_name,
    name: legacyName,
    phone,
    email,
    home_zip,
    location_city,
    location_state,
    latitude,
    longitude,
    color,
    is_active,
    notes,
  } = body

  const firstName = String(first_name || legacyName || '').trim()
  const lastName = String(last_name || '').trim()
  const name = [firstName, lastName].filter(Boolean).join(' ')
  if (!firstName) {
    return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  }
  const coordinates = await geocodeUSZip(home_zip)

  const rows = await sql`
    INSERT INTO public.technicians
      (name, first_name, last_name, phone, email, home_zip, location_city, location_state, latitude, longitude, color, is_active, notes)
    VALUES
      (${name}, ${firstName}, ${lastName || null}, ${phone ?? null}, ${email ?? null}, ${coordinates?.zip ?? home_zip ?? null},
       ${location_city ?? coordinates?.city ?? null}, ${location_state ?? coordinates?.state ?? null},
       ${latitude ?? coordinates?.latitude ?? null}, ${longitude ?? coordinates?.longitude ?? null},
       ${color ?? null}, ${is_active ?? true}, ${notes ?? null})
    RETURNING *
  `
  return NextResponse.json(rows[0], { status: 201 })
}
