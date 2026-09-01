import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request); if (error) return error
  await ensureOpsSchema()
  const { id } = await params
  const body = await request.json()
  if (!body.start_date || !body.end_date) return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 })
  if (body.end_date < body.start_date) return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
  const result = await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    const [job] = await trx`select status from public.job_schedule where id = ${id} for update`
    if (!job) return null
    if (job.status === 'closed' || job.status === 'cancelled') throw new Error('Reopen this work order before adding an assignment.')
    const [next] = await trx`select coalesce(max(line_number), 0) + 1 as value from public.job_schedule_lines where job_id = ${id}`
    const [line] = await trx`
      insert into public.job_schedule_lines (job_id, line_number, start_date, end_date, techs_needed, scope, notes)
      values (${id}, ${next.value}, ${body.start_date}, ${body.end_date}, ${body.techs_needed ?? 1}, ${body.scope ?? null}, ${body.notes ?? null}) returning *
    `
    const technicianIds: string[] = Array.isArray(body.technician_ids) ? body.technician_ids : []
    for (const technicianId of technicianIds) await trx`insert into public.job_schedule_line_techs (line_id, technician_id) values (${line.id}, ${technicianId}) on conflict do nothing`
    return line
  }).catch(errorValue => ({ error: errorValue instanceof Error ? errorValue.message : 'Could not add assignment' }))
  if (!result) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json(result, { status: 201 })
}
