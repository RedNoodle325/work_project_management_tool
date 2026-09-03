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
  const projectManagerId = typeof body.project_manager_id === 'string' && body.project_manager_id ? body.project_manager_id : null

  if (projectManagerId) {
    const [manager] = await sql`
      SELECT id FROM public.users WHERE id = ${projectManagerId}
      AND access_role IN ('owner', 'admin', 'project_manager') LIMIT 1
    `
    if (!manager) return NextResponse.json({ error: 'Select a valid project manager' }, { status: 400 })
  }

  const [job] = await sql`
    UPDATE public.project_jobs SET assigned_pm_id = ${projectManagerId}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json(job)
}
