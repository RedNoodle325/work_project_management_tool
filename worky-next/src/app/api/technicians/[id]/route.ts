import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import { geocodeUSZip } from '@/lib/zipCoordinates'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()
  await ensureOpsSchema()
  const [current] = await sql`select * from public.technicians where id = ${id}`
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const firstName = body.first_name === undefined ? current.first_name : String(body.first_name || '').trim()
  const lastName = body.last_name === undefined ? current.last_name : String(body.last_name || '').trim()
  const name = body.name === undefined ? [firstName, lastName].filter(Boolean).join(' ') || current.name : String(body.name || '').trim()
  const zipChanged = body.home_zip !== undefined
  const coordinates = zipChanged ? await geocodeUSZip(body.home_zip) : null

  const rows = await sql`
    UPDATE public.technicians SET
      name           = ${name},
      first_name     = ${firstName || null},
      last_name      = ${lastName || null},
      phone          = COALESCE(${body.phone ?? null}, phone),
      email          = COALESCE(${body.email ?? null}, email),
      home_zip       = ${zipChanged ? (coordinates?.zip ?? (String(body.home_zip || '').trim() || null)) : current.home_zip},
      location_city  = ${coordinates?.city ?? body.location_city ?? current.location_city},
      location_state = ${coordinates?.state ?? body.location_state ?? current.location_state},
      latitude       = ${zipChanged ? coordinates?.latitude ?? null : body.latitude ?? current.latitude},
      longitude      = ${zipChanged ? coordinates?.longitude ?? null : body.longitude ?? current.longitude},
      color          = COALESCE(${body.color ?? null}, color),
      is_active      = COALESCE(${body.is_active ?? null}, is_active),
      notes          = COALESCE(${body.notes ?? null}, notes),
      updated_at     = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(rows[0])
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params

  await sql`DELETE FROM public.technicians WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}
