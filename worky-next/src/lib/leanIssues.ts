import sql from '@/lib/db'

export const ISSUE_STATUSES = ['open', 'in_progress', 'scheduled', 'waiting_parts', 'resolved', 'closed']
export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'critical']

export async function nextIssueNumber(trx: typeof sql, projectJobId: string) {
  const [job] = await trx`
    select id, job_number from public.project_jobs where id = ${projectJobId}
  `
  if (!job) throw new Error('Job not found.')
  const rawPrefix = String(job.job_number || 'JOB')
  const prefix = rawPrefix.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'SITE'
  const pattern = `${prefix}-`
  const [sequence] = await trx`
    select coalesce(max(right(coalesce(external_reference, title), 3)::integer), 0) as max_serial
    from public.issues
    where project_job_id = ${projectJobId}
      and left(coalesce(external_reference, title), ${pattern.length}) = ${pattern}
      and right(coalesce(external_reference, title), 3) ~ '^[0-9]{3}$'
  `
  return `${prefix}-${String(Number(sequence.max_serial) + 1).padStart(3, '0')}`
}

export function issueRowsById(id: string) {
  return sql`
    select i.id, i.site_id, s.name as site_name, i.project_job_id,
      j.job_number, j.project_code, j.name as project_name,
      coalesce(i.external_reference, i.title) as issue_number,
      i.description,
      coalesce(i.equipment_name, u.tag) as equipment_name,
      coalesce(i.equipment_serial_number, u.serial_number) as serial_number,
      i.status, i.priority,
      i.source_url, i.source, i.internal_notes, i.updated_at
    from public.issues i
    join public.sites s on s.id = i.site_id
    left join public.project_jobs j on j.id = i.project_job_id
    left join public.units u on u.id = i.unit_id
    where i.id = ${id}
  `
}
