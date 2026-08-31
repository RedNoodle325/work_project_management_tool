import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const rows = await sql`
    UPDATE public.job_schedule SET
      site_id         = COALESCE(${body.site_id ?? null}, site_id),
      pm_id           = COALESCE(${body.pm_id ?? null}, pm_id),
      job_name        = COALESCE(${body.job_name ?? null}, job_name),
      job_type        = COALESCE(${body.job_type ?? null}, job_type),
      contract_number = COALESCE(${body.contract_number ?? null}, contract_number),
      priority        = COALESCE(${body.priority ?? null}, priority),
      start_date      = COALESCE(${body.start_date ?? null}, start_date),
      end_date        = COALESCE(${body.end_date ?? null}, end_date),
      status          = COALESCE(${body.status ?? null}, status),
      notes           = COALESCE(${body.notes ?? null}, notes),
      scope           = COALESCE(${body.scope ?? null}, scope),
      techs_needed    = COALESCE(${body.techs_needed ?? null}, techs_needed),
      updated_at      = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (Array.isArray(body.technician_ids)) {
    const technicianIds: string[] = body.technician_ids
    await sql`DELETE FROM public.job_schedule_techs WHERE job_id = ${id}`
    for (const technicianId of technicianIds) {
      await sql`
        INSERT INTO public.job_schedule_techs (job_id, technician_id)
        VALUES (${id}, ${technicianId})
        ON CONFLICT (job_id, technician_id) DO NOTHING
      `
    }
  }

  return NextResponse.json(rows[0])
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params

  await sql`DELETE FROM public.job_schedule WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}
