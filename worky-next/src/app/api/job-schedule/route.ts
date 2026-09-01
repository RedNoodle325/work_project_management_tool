import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'
import { getJobSchedule, listJobSchedule } from '@/lib/jobSchedule'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('week_start') ?? null
  const siteId = searchParams.get('site_id') ?? null
  const technicianId = searchParams.get('technician_id') ?? null

  let jobs = await listJobSchedule()
  if (weekStart) {
    const end = new Date(`${weekStart}T12:00:00`); end.setDate(end.getDate() + 6)
    const weekEnd = end.toISOString().slice(0, 10)
    jobs = jobs.filter(job => job.assignment_lines.some(line => line.start_date <= weekEnd && line.end_date >= weekStart))
  }
  if (siteId) jobs = jobs.filter(job => job.site_id === siteId)
  if (technicianId) jobs = jobs.filter(job => job.assignment_lines.some(line => line.technicians.some(tech => tech.id === technicianId)))
  return NextResponse.json(jobs)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try { await ensureOpsSchema() }
  catch { return NextResponse.json({ error: 'Operational database setup failed. Apply database migration 012.' }, { status: 503 }) }

  const body = await request.json()
  if (!body.site_id || !body.job_name || !String(body.job_name).trim()) {
    return NextResponse.json({ error: 'site_id and job_name are required' }, { status: 400 })
  }

  const jobType = String(body.job_type || 'Warranty')
  const prefix = jobType === 'Warranty' ? 'WAR' : jobType === 'Billable service' ? 'BSV' : jobType === 'Billable startup' ? 'BSU' : 'OTH'
  const job = await sql.begin(async tx => {
    const [stamp] = await tx`select to_char(now() at time zone 'America/New_York', 'YYYYMMDD') as day`
    const lockKey = `work-order:${stamp.day}:${prefix}`
    await tx`select pg_advisory_xact_lock(hashtext(${lockKey}))`
    const [sequence] = await tx`select coalesce(max(right(work_order_number, 3)::int), 0) + 1 as value from public.job_schedule where work_order_number like ${`WO-${stamp.day}-${prefix}-%`}`
    const number = `WO-${stamp.day}-${prefix}-${String(Number(sequence.value)).padStart(3, '0')}`
    const [created] = await tx`
      INSERT INTO public.job_schedule (site_id, pm_id, work_order_number, job_name, job_type, contract_number, priority, status, notes)
      VALUES (${body.site_id}, ${body.pm_id ?? null}, ${number}, ${body.job_name}, ${jobType}, ${body.contract_number ?? null},
        COALESCE(${body.priority ?? null}, 3), COALESCE(${body.status ?? null}, 'scheduled'), ${body.notes ?? null}) RETURNING *
    `
    return created
  })
  return NextResponse.json(await getJobSchedule(job.id), { status: 201 })
}
