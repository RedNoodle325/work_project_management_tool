import sql from '@/lib/db'

export interface LeanIssueInput {
  issueNumber: string
  description: string
  equipmentName: string
  serialNumber?: string
  sourceUrl?: string
}

export async function upsertLeanIssues(projectJobId: string, siteId: string, issues: LeanIssueInput[], source = 'cxalloy') {
  const units = await sql`
    select id, tag, serial_number
    from public.units
    where site_id = ${siteId}
  `
  const unitsByTag = new Map(units.map(unit => [String(unit.tag).trim().toLowerCase(), unit]))
  let created = 0
  let updated = 0

  for (const issue of issues) {
    const unit = unitsByTag.get(issue.equipmentName.trim().toLowerCase())
    const serialNumber = issue.serialNumber?.trim() || String(unit?.serial_number || '').trim() || null
    const existing = await sql`
      select id
      from public.issues
      where project_job_id = ${projectJobId}
        and source = ${source}
        and external_reference = ${issue.issueNumber}
      limit 1
    `

    if (existing[0]) {
      await sql`
        update public.issues set
          site_id = ${siteId},
          project_job_id = ${projectJobId},
          unit_id = ${unit?.id || null},
          title = ${issue.issueNumber},
          description = ${issue.description || null},
          equipment_name = ${issue.equipmentName || null},
          equipment_serial_number = ${serialNumber},
          source_url = ${issue.sourceUrl || null},
          updated_at = now()
        where id = ${existing[0].id}
      `
      updated++
    } else {
      await sql`
        insert into public.issues
          (site_id, project_job_id, unit_id, title, description, equipment_name, equipment_serial_number,
           status, priority, source, external_reference, source_url)
        values
          (${siteId}, ${projectJobId}, ${unit?.id || null}, ${issue.issueNumber}, ${issue.description || null},
           ${issue.equipmentName || null}, ${serialNumber}, 'open', 'normal', ${source},
           ${issue.issueNumber}, ${issue.sourceUrl || null})
      `
      created++
    }
  }

  return { imported: issues.length, created, updated }
}
