import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { currentProjectManager, ensureProjectJobs } from '@/lib/projectJobs'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { error, claims } = await requireAuth(req)
  if (error) return error
  await ensureProjectJobs()

  const [jobs, projectManagers, currentUser] = await Promise.all([
    sql`
      SELECT j.*, u.display_name AS assigned_pm_name, u.email AS assigned_pm_email
      FROM public.project_jobs j
      LEFT JOIN public.users u ON u.id = j.assigned_pm_id
      ORDER BY j.job_number::integer ASC, j.project_code ASC
    `,
    sql`
      SELECT id, email, display_name, access_role FROM public.users
      WHERE access_role IN ('owner', 'admin', 'project_manager')
      ORDER BY display_name ASC NULLS LAST, email ASC
    `,
    currentProjectManager(claims),
  ])

  return NextResponse.json({ jobs, project_managers: projectManagers, current_user: currentUser })
}
