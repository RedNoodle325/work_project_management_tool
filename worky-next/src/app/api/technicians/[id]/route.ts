import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const rows = await sql`
    UPDATE public.technicians SET
      name           = COALESCE(${body.name ?? null}, name),
      phone          = COALESCE(${body.phone ?? null}, phone),
      email          = COALESCE(${body.email ?? null}, email),
      location_city  = COALESCE(${body.location_city ?? null}, location_city),
      location_state = COALESCE(${body.location_state ?? null}, location_state),
      latitude       = COALESCE(${body.latitude ?? null}, latitude),
      longitude      = COALESCE(${body.longitude ?? null}, longitude),
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
