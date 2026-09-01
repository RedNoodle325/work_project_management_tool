import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { geocodeUSZip } from '@/lib/zipCoordinates'

const SCHEDULER_CUSTOMER = 'Unassigned job sites'

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const body = await request.json()
  const projectNumber = String(body.project_number || '').trim()
  const requestedSiteId = String(body.site_id || '').trim() || null
  if (!projectNumber) return NextResponse.json({ error: 'Project number is required.' }, { status: 400 })
  const siteCoordinates = await geocodeUSZip(body.site_zip)

  try {
    const result = await sql.begin(async tx => {
      const trx = tx as unknown as typeof sql
      await trx`select pg_advisory_xact_lock(hashtext(lower(${projectNumber})))`

      const [existingProject] = await trx`
        select p.site_id
        from public.projects p
        where lower(p.project_number) = lower(${projectNumber})
        limit 1
      `
      if (existingProject) {
        if (requestedSiteId && existingProject.site_id !== requestedSiteId) {
          return { conflict: true as const }
        }
        const [site] = await trx`select * from public.site_overview where id = ${existingProject.site_id}`
        return { site, created_site: false, added_project: false }
      }

      if (requestedSiteId) {
        const [siteExists] = await trx`select id from public.sites where id = ${requestedSiteId}`
        if (!siteExists) return { missing: true as const }
        const [projectCount] = await trx`select count(*)::int as count from public.projects where site_id = ${requestedSiteId}`
        await trx`
          insert into public.projects (site_id, project_number, name, status, is_primary)
          values (${requestedSiteId}, ${projectNumber}, ${`Project ${projectNumber}`}, 'active', ${projectCount.count === 0})
        `
        if (siteCoordinates) await trx`
          update public.sites set
            postal_code = coalesce(postal_code, ${siteCoordinates.zip}),
            city = case when city is null or city = 'TBD' then ${siteCoordinates.city} else city end,
            state = case when state is null or state = 'TBD' then ${siteCoordinates.state} else state end,
            latitude = coalesce(latitude, ${siteCoordinates.latitude}),
            longitude = coalesce(longitude, ${siteCoordinates.longitude})
          where id = ${requestedSiteId}
        `
        const [site] = await trx`select * from public.site_overview where id = ${requestedSiteId}`
        return { site, created_site: false, added_project: true }
      }

      await trx`
        insert into public.customers (name, code, notes)
        values (${SCHEDULER_CUSTOMER}, 'SCHED', 'Sites created from the technician scheduler; complete the site details when available.')
        on conflict do nothing
      `
      const [customer] = await trx`select id from public.customers where lower(name) = lower(${SCHEDULER_CUSTOMER})`
      const [site] = await trx`
        insert into public.sites (customer_id, name, city, state, postal_code, latitude, longitude, status, lifecycle_phase, notes)
        values (${customer.id}, ${`Project ${projectNumber}`}, ${siteCoordinates?.city ?? 'TBD'}, ${siteCoordinates?.state ?? 'TBD'},
          ${siteCoordinates?.zip ?? null}, ${siteCoordinates?.latitude ?? null}, ${siteCoordinates?.longitude ?? null},
          'planning', 'planning', 'Created from the technician scheduler. Site details are pending.')
        returning id
      `
      await trx`
        insert into public.projects (site_id, project_number, name, status, is_primary)
        values (${site.id}, ${projectNumber}, ${`Project ${projectNumber}`}, 'active', true)
      `
      const [summary] = await trx`select * from public.site_overview where id = ${site.id}`
      return { site: summary, created_site: true, added_project: true }
    })

    if ('conflict' in result) {
      return NextResponse.json({ error: 'That project number already belongs to another site.' }, { status: 409 })
    }
    if ('missing' in result) return NextResponse.json({ error: 'The selected site no longer exists.' }, { status: 404 })
    return NextResponse.json(result, { status: result.created_site ? 201 : 200 })
  } catch (error) {
    console.error('Scheduler site creation failed:', error)
    return NextResponse.json({ error: 'Unable to create the job site.' }, { status: 500 })
  }
}
