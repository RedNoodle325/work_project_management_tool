import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import { getJobSchedule } from '@/lib/jobSchedule'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request); if (error) return error
  await ensureOpsSchema()
  const { id } = await params
  const job = await getJobSchedule(id)
  return job ? NextResponse.json(job) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  await ensureOpsSchema()
  const body = await request.json()

  const rows = await sql`
    UPDATE public.job_schedule SET
      site_id         = COALESCE(${body.site_id ?? null}, site_id),
      pm_id           = COALESCE(${body.pm_id ?? null}, pm_id),
      job_name        = COALESCE(${body.job_name ?? null}, job_name),
      job_type        = COALESCE(${body.job_type ?? null}, job_type),
      contract_number = COALESCE(${body.contract_number ?? null}, contract_number),
      priority        = COALESCE(${body.priority ?? null}, priority),
      status          = COALESCE(${body.status ?? null}, status),
      notes           = COALESCE(${body.notes ?? null}, notes),
      updated_at      = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(await getJobSchedule(id))
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params

  await sql`DELETE FROM public.job_schedule WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}
