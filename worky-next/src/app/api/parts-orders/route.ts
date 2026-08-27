import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('site_id') ?? null
  const status = searchParams.get('status') ?? null

  const orders = await sql`
    SELECT po.*, s.name AS site_name, j.job_name
    FROM public.parts_orders po
    JOIN public.sites s ON s.id = po.site_id
    LEFT JOIN public.job_schedule j ON j.id = po.job_id
    WHERE (${siteId}::uuid IS NULL OR po.site_id = ${siteId}::uuid)
      AND (${status}::text IS NULL OR po.status = ${status}::text)
    ORDER BY
      CASE po.status WHEN 'needed' THEN 0 WHEN 'ordered' THEN 1 WHEN 'shipped' THEN 2 WHEN 'received' THEN 3 WHEN 'installed' THEN 4 ELSE 5 END,
      po.created_at DESC
  `
  return NextResponse.json(orders)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const body = await request.json()

  if (!body.site_id || !body.description || !String(body.description).trim()) {
    return NextResponse.json({ error: 'site_id and description are required' }, { status: 400 })
  }

  const [order] = await sql`
    INSERT INTO public.parts_orders
      (site_id, job_id, part_number, description, quantity, status, supplier,
       order_number, requested_by, ordered_at, expected_at, received_at, notes)
    VALUES
      (${body.site_id}, ${body.job_id ?? null}, ${body.part_number ?? null}, ${body.description},
       COALESCE(${body.quantity ?? null}, 1),
       COALESCE(${body.status ?? null}, 'needed'),
       ${body.supplier ?? null}, ${body.order_number ?? null}, ${body.requested_by ?? null},
       ${body.ordered_at ?? null}, ${body.expected_at ?? null}, ${body.received_at ?? null},
       ${body.notes ?? null})
    RETURNING *
  `
  return NextResponse.json(order, { status: 201 })
}
