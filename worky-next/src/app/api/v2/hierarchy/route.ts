import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const [customers, locations, sites] = await Promise.all([
    sql`select id, name, code, status from public.customers order by name`,
    sql`select id, customer_id, campus_code, name, city, state, status from public.locations order by campus_code`,
    sql`select * from public.site_overview order by customer_name, campus_code, name`,
  ])

  return NextResponse.json(customers.map(customer => ({
    ...customer,
    locations: locations
      .filter(location => location.customer_id === customer.id)
      .map(location => ({
        ...location,
        sites: sites.filter(site => site.location_id === location.id),
      })),
  })))
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const body = await request.json()
  if (body.kind === 'customer') {
    const [row] = await sql`insert into public.customers (name, code, notes) values (${body.name}, ${body.code ?? null}, ${body.notes ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'location') {
    const [row] = await sql`
      insert into public.locations (customer_id, campus_code, name, city, state, address, postal_code, timezone_name, notes)
      values (${body.customer_id}, ${body.campus_code}, ${body.name ?? null}, ${body.city}, ${body.state}, ${body.address ?? null}, ${body.postal_code ?? null}, ${body.timezone ?? 'America/New_York'}, ${body.notes ?? null})
      returning *
    `
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'site') {
    const [row] = await sql`
      insert into public.sites (location_id, name, site_code, building, lifecycle_phase, status, notes)
      values (${body.location_id}, ${body.name}, ${body.site_code ?? null}, ${body.building ?? null}, ${body.lifecycle_phase ?? 'planning'}, ${body.status ?? 'planning'}, ${body.notes ?? null})
      returning *
    `
    return NextResponse.json(row, { status: 201 })
  }
  return NextResponse.json({ error: 'Unsupported hierarchy entity' }, { status: 400 })
}
