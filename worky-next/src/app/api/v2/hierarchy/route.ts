import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  try {
    const [customers, locations, sites] = await Promise.all([
      sql`select id, name, code, status from public.customers order by name`,
      sql`select id, customer_id, campus_code, name, city, state, status from public.locations order by campus_code`,
      sql`
        select so.*,
          coalesce((
            select json_agg(j.job_number order by j.job_number::integer)
            from (select distinct job_number from public.project_jobs where site_id = so.id) j
          ), '[]'::json) as project_numbers
        from public.site_overview so
        order by so.customer_name, so.campus_code nulls first, so.name
      `,
    ])

    return NextResponse.json(customers.map(customer => ({
      ...customer,
      sites: sites.filter(site => site.customer_id === customer.id && !site.location_id),
      locations: locations
        .filter(location => location.customer_id === customer.id)
        .map(location => ({
          ...location,
          sites: sites.filter(site => site.location_id === location.id),
        })),
    })))
  } catch (error) {
    console.error('Hierarchy read failed:', error)
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  try {
    const body = await request.json()
    if (body.kind === 'customer') {
      const [existing] = await sql`select id, name from public.customers where lower(name) = lower(${String(body.name || '').trim()})`
      if (existing) return NextResponse.json({ error: `Customer “${existing.name}” already exists. Use that customer when creating the site instead.` }, { status: 409 })
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
      const locationId = body.location_id || null
      let customerId = body.customer_id || null
      if (locationId) {
        const [location] = await sql`select customer_id from public.locations where id = ${locationId}`
        if (!location) return NextResponse.json({ error: 'Campus not found' }, { status: 400 })
        customerId = location.customer_id
      }
      if (!customerId) return NextResponse.json({ error: 'Customer is required' }, { status: 400 })
      if (!locationId && (!body.city || !body.state)) return NextResponse.json({ error: 'City and state are required for a standalone site' }, { status: 400 })
      const [row] = await sql`
        insert into public.sites (location_id, customer_id, name, site_code, building, city, state, address, postal_code, lifecycle_phase, status, notes)
        values (${locationId}, ${customerId}, ${body.name}, ${body.site_code ?? null}, ${body.building ?? null}, ${locationId ? null : body.city}, ${locationId ? null : body.state}, ${locationId ? null : body.address ?? null}, ${locationId ? null : body.postal_code ?? null}, ${body.lifecycle_phase ?? 'planning'}, ${body.status ?? 'planning'}, ${body.notes ?? null})
        returning *
      `
      return NextResponse.json(row, { status: 201 })
    }
    return NextResponse.json({ error: 'Unsupported hierarchy entity' }, { status: 400 })
  } catch (error) {
    console.error('Hierarchy create failed:', error)
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 })
  }
}

function databaseErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === '23505') return 'That record already exists.'
  return 'Database operation failed. Check the server log for details.'
}
