import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params

  const [units, issues, work, parts] = await Promise.all([
    sql`
      select u.*, s.name as site_name, s.location_id, l.campus_code, s.customer_id, c.name as customer_name,
             p.project_number
      from public.units u
      join public.sites s on s.id = u.site_id
      left join public.locations l on l.id = s.location_id
      join public.customers c on c.id = s.customer_id
      left join public.projects p on p.id = u.project_id
      where u.id = ${id}
    `,
    sql`select i.*, a.asr_number from public.issues i join public.asrs a on a.id = i.asr_id where i.unit_id = ${id} order by i.reported_at desc`,
    sql`select sw.*, a.asr_number, sv.status as visit_status from public.service_work sw join public.asrs a on a.id = sw.asr_id left join public.service_visits sv on sv.id = sw.service_visit_id where sw.unit_id = ${id} order by sw.performed_at desc`,
    sql`select poi.*, po.order_number, po.status as order_status, a.asr_number from public.part_order_items poi join public.part_orders po on po.id = poi.part_order_id join public.asrs a on a.id = po.asr_id where poi.unit_id = ${id} order by poi.created_at desc`,
  ])
  if (!units[0]) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  return NextResponse.json({ unit: units[0], issues, service_work: work, parts })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const body = await request.json()
  if (!String(body.tag || '').trim()) return NextResponse.json({ error: 'Unit tag is required' }, { status: 400 })
  const [current] = await sql`select status from public.units where id = ${id}`
  if (!current) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  const rows = await sql`
    update public.units set
      tag = ${String(body.tag).trim()},
      serial_number = ${body.serial_number || null},
      manufacturer = ${body.manufacturer || null},
      model = ${body.model || null},
      unit_type = ${body.unit_type || null},
      location_in_site = ${body.location_in_site || null},
      status = ${body.status || current.status},
      notes = ${body.notes || null}
    where id = ${id}
    returning *
  `
  if (!rows[0]) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const rows = await sql`delete from public.units where id = ${id} returning id`
  if (!rows[0]) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
