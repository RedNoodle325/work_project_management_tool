import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const rows = await sql`
    UPDATE public.parts_orders SET
      site_id       = COALESCE(${body.site_id ?? null}, site_id),
      job_id        = COALESCE(${body.job_id ?? null}, job_id),
      part_number   = COALESCE(${body.part_number ?? null}, part_number),
      description   = COALESCE(${body.description ?? null}, description),
      quantity      = COALESCE(${body.quantity ?? null}, quantity),
      status        = COALESCE(${body.status ?? null}, status),
      supplier      = COALESCE(${body.supplier ?? null}, supplier),
      order_number  = COALESCE(${body.order_number ?? null}, order_number),
      requested_by  = COALESCE(${body.requested_by ?? null}, requested_by),
      ordered_at    = COALESCE(${body.ordered_at ?? null}, ordered_at),
      expected_at   = COALESCE(${body.expected_at ?? null}, expected_at),
      received_at   = COALESCE(${body.received_at ?? null}, received_at),
      notes         = COALESCE(${body.notes ?? null}, notes),
      updated_at    = NOW()
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

  await sql`DELETE FROM public.parts_orders WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}
