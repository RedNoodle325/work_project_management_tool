import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { error } = await requireAuth(request); if (error) return error
  await ensureOpsSchema()
  const { id, lineId } = await params
  const body = await request.json()
  if (!body.start_date || !body.end_date || body.end_date < body.start_date) return NextResponse.json({ error: 'Enter a valid start and end date' }, { status: 400 })
  const result = await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    const [job] = await trx`select status from public.job_schedule where id = ${id} for update`
    if (!job) return null
    if (job.status === 'closed' || job.status === 'cancelled') throw new Error('Reopen this work order before changing assignments.')
    const [line] = await trx`
      update public.job_schedule_lines set start_date=${body.start_date}, end_date=${body.end_date},
        techs_needed=${body.techs_needed ?? 1}, scope=${body.scope ?? null}, notes=${body.notes ?? null}, updated_at=now()
      where id=${lineId} and job_id=${id} returning *
    `
    if (!line) return null
    await trx`delete from public.job_schedule_line_techs where line_id=${lineId}`
    const technicianIds: string[] = Array.isArray(body.technician_ids) ? body.technician_ids : []
    for (const technicianId of technicianIds) await trx`insert into public.job_schedule_line_techs (line_id, technician_id) values (${lineId}, ${technicianId}) on conflict do nothing`
    return line
  }).catch(errorValue => ({ error: errorValue instanceof Error ? errorValue.message : 'Could not update assignment' }))
  if (!result) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { error } = await requireAuth(request); if (error) return error
  await ensureOpsSchema()
  const { id, lineId } = await params
  const [job] = await sql`select status from public.job_schedule where id=${id}`
  if (!job) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
  if (job.status === 'closed' || job.status === 'cancelled') return NextResponse.json({ error: 'Reopen this work order before removing assignments.' }, { status: 409 })
  await sql`delete from public.job_schedule_lines where id=${lineId} and job_id=${id}`
  return new NextResponse(null, { status: 204 })
}
