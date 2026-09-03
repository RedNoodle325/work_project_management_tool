import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { currentProjectManager, ensureProjectJobs } from '@/lib/projectJobs'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { error, claims } = await requireAuth(req)
  if (error) return error
  await ensureProjectJobs()

  const [jobs, projectManagers, sites, currentUser] = await Promise.all([
    sql`
      SELECT j.*, u.display_name AS assigned_pm_name, u.email AS assigned_pm_email,
        s.name AS site_name, c.name AS site_customer_name,
        COALESCE(s.city, l.city) AS site_city, COALESCE(s.state, l.state) AS site_state
      FROM public.project_jobs j
      LEFT JOIN public.users u ON u.id = j.assigned_pm_id
      LEFT JOIN public.sites s ON s.id = j.site_id
      LEFT JOIN public.locations l ON l.id = s.location_id
      LEFT JOIN public.customers c ON c.id = s.customer_id
      ORDER BY j.job_number::integer ASC, j.project_code ASC
    `,
    sql`
      SELECT id, email, display_name, access_role FROM public.users
      WHERE access_role IN ('owner', 'admin', 'project_manager')
      ORDER BY display_name ASC NULLS LAST, email ASC
    `,
    sql`
      SELECT s.id, s.name, c.name AS customer_name,
        COALESCE(s.city, l.city) AS city, COALESCE(s.state, l.state) AS state
      FROM public.sites s
      LEFT JOIN public.locations l ON l.id = s.location_id
      LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE s.status <> 'inactive'
      ORDER BY c.name ASC NULLS LAST, s.name ASC
    `,
    currentProjectManager(claims),
  ])

  return NextResponse.json({ jobs, project_managers: projectManagers, sites, current_user: currentUser })
}
