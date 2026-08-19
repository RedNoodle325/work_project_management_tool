import sql from '@/lib/db'

export const ISSUE_STATUSES = ['open', 'in_progress', 'scheduled', 'waiting_parts', 'resolved', 'closed']
export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'critical']

export async function nextIssueNumber(trx: typeof sql, siteId: string) {
  const [site] = await trx`
    select s.name, s.site_code, s.building, l.campus_code,
      (select p.project_number from public.projects p where p.site_id = s.id order by p.is_primary desc, p.created_at desc limit 1) as project_number
    from public.sites s
    left join public.locations l on l.id = s.location_id
    where s.id = ${siteId}
  `
  if (!site) throw new Error('Site not found.')
  const rawPrefix = String(site.site_code || site.project_number || site.campus_code || site.building || site.name || 'SITE')
  const prefix = rawPrefix.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'SITE'
  const pattern = `${prefix}-`
  const [sequence] = await trx`
    select coalesce(max(right(coalesce(external_reference, title), 3)::integer), 0) as max_serial
    from public.issues
    where site_id = ${siteId}
      and left(coalesce(external_reference, title), ${pattern.length}) = ${pattern}
      and right(coalesce(external_reference, title), 3) ~ '^[0-9]{3}$'
  `
  return `${prefix}-${String(Number(sequence.max_serial) + 1).padStart(3, '0')}`
}

export function issueRowsById(id: string) {
  return sql`
    select i.id, i.site_id, s.name as site_name,
      coalesce(i.external_reference, i.title) as issue_number,
      i.description,
      coalesce(i.equipment_name, u.tag) as equipment_name,
      coalesce(i.equipment_serial_number, u.serial_number) as serial_number,
      i.status, i.priority,
      i.source_url, i.source, i.internal_notes, i.updated_at
    from public.issues i
    join public.sites s on s.id = i.site_id
    left join public.units u on u.id = i.unit_id
    where i.id = ${id}
  `
}
