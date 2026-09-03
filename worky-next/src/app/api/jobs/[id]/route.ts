import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { ensureProjectJobs } from '@/lib/projectJobs'
import sql from '@/lib/db'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, { permission: 'workspace:write' })
  if (error) return error
  await ensureProjectJobs()
  const { id } = await context.params
  const body = await req.json()
  const hasProjectManager = Object.prototype.hasOwnProperty.call(body, 'project_manager_id')
  const hasSite = Object.prototype.hasOwnProperty.call(body, 'site_id')
  const hasRepresentative = Object.prototype.hasOwnProperty.call(body, 'representative_id')
  const hasCustomer = Object.prototype.hasOwnProperty.call(body, 'customer_id')
  const projectManagerId = typeof body.project_manager_id === 'string' && body.project_manager_id ? body.project_manager_id : null
  const siteId = typeof body.site_id === 'string' && body.site_id ? body.site_id : null
  const representativeId = typeof body.representative_id === 'string' && body.representative_id ? body.representative_id : null
  const customerId = typeof body.customer_id === 'string' && body.customer_id ? body.customer_id : null

  if (!hasProjectManager && !hasSite && !hasRepresentative && !hasCustomer) {
    return NextResponse.json({ error: 'Choose a job assignment to update' }, { status: 400 })
  }

  const [current] = await sql`SELECT * FROM public.project_jobs WHERE id = ${id}`
  if (!current) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  if (projectManagerId) {
    const [manager] = await sql`
      SELECT id FROM public.users WHERE id = ${projectManagerId}
      AND access_role IN ('owner', 'admin', 'project_manager') LIMIT 1
    `
    if (!manager) return NextResponse.json({ error: 'Select a valid project manager' }, { status: 400 })
  }

  if (representativeId) {
    const [representative] = await sql`SELECT id FROM public.representatives WHERE id = ${representativeId} LIMIT 1`
    if (!representative) return NextResponse.json({ error: 'Select a valid representative' }, { status: 400 })
  }

  if (customerId) {
    const [customer] = await sql`SELECT id FROM public.customers WHERE id = ${customerId} LIMIT 1`
    if (!customer) return NextResponse.json({ error: 'Select a valid customer' }, { status: 400 })
  }

  let nextSiteId = hasSite ? siteId : current.site_id
  let nextCustomerId = hasCustomer ? customerId : current.customer_id
  if (hasSite && siteId) {
    const [site] = await sql`SELECT id, customer_id FROM public.sites WHERE id = ${siteId} LIMIT 1`
    if (!site) return NextResponse.json({ error: 'Select a valid site' }, { status: 400 })
    nextCustomerId = site.customer_id
  } else if (hasCustomer && nextSiteId) {
    const [site] = await sql`SELECT customer_id FROM public.sites WHERE id = ${nextSiteId} LIMIT 1`
    if (!site || site.customer_id !== nextCustomerId) nextSiteId = null
  }

  const nextProjectManagerId = hasProjectManager ? projectManagerId : current.assigned_pm_id
  const nextRepresentativeId = hasRepresentative ? representativeId : current.representative_id
  const [job] = await sql`
    UPDATE public.project_jobs SET
      assigned_pm_id = ${nextProjectManagerId},
      representative_id = ${nextRepresentativeId},
      customer_id = ${nextCustomerId},
      site_id = ${nextSiteId},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `
  return NextResponse.json(job)
}
