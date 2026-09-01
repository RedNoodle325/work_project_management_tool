import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('week_start') ?? null
  const siteId = searchParams.get('site_id') ?? null
  const technicianId = searchParams.get('technician_id') ?? null

  const jobs = await sql`
    SELECT
      j.*,
      s.name AS site_name,
      s.city AS site_city,
      s.state AS site_state,
      COALESCE(
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
         FROM public.job_schedule_techs jt
         JOIN public.technicians t ON t.id = jt.technician_id
         WHERE jt.job_id = j.id),
        '[]'
      ) AS technicians
    FROM public.job_schedule j
    JOIN public.sites s ON s.id = j.site_id
    WHERE (${weekStart}::date IS NULL OR (
            (j.start_date IS NULL OR j.start_date <= ${weekStart}::date + INTERVAL '6 days')
            AND (j.end_date IS NULL OR j.end_date >= ${weekStart}::date)
          ))
      AND (${siteId}::uuid IS NULL OR j.site_id = ${siteId}::uuid)
      AND (${technicianId}::uuid IS NULL OR EXISTS (
            SELECT 1 FROM public.job_schedule_techs jt
            WHERE jt.job_id = j.id AND jt.technician_id = ${technicianId}::uuid
          ))
    ORDER BY j.start_date ASC NULLS LAST, j.job_name ASC
  `

  return NextResponse.json(jobs)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const body = await request.json()
  const technicianIds: string[] = Array.isArray(body.technician_ids) ? body.technician_ids : []

  if (!body.site_id || !body.job_name || !String(body.job_name).trim()) {
    return NextResponse.json({ error: 'site_id and job_name are required' }, { status: 400 })
  }

  const [job] = await sql`
    INSERT INTO public.job_schedule
      (site_id, pm_id, job_name, job_type, contract_number, priority,
       start_date, end_date, status, notes, scope, techs_needed)
    VALUES
      (${body.site_id}, ${body.pm_id ?? null}, ${body.job_name},
       COALESCE(${body.job_type ?? null}, 'Warranty'),
       ${body.contract_number ?? null},
       COALESCE(${body.priority ?? null}, 3),
       ${body.start_date ?? null}, ${body.end_date ?? null},
       COALESCE(${body.status ?? null}, 'scheduled'),
       ${body.notes ?? null}, ${body.scope ?? null},
       COALESCE(${body.techs_needed ?? null}, 1))
    RETURNING *
  `

  if (technicianIds.length > 0) {
    for (const technicianId of technicianIds) {
      await sql`
        INSERT INTO public.job_schedule_techs (job_id, technician_id)
        VALUES (${job.id}, ${technicianId})
        ON CONFLICT (job_id, technician_id) DO NOTHING
      `
    }
  }

  return NextResponse.json(job, { status: 201 })
}
