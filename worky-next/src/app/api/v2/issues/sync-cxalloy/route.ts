import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { cxalloyGet, cxalloyPost } from '@/lib/cxalloy'
import { upsertLeanIssues, type LeanIssueInput } from '@/lib/issueImport'

interface CxIssue {
  issue_id: number
  name?: string
  description?: string
  asset_name?: string
  asset_key?: number
  assigned_type?: string
  assigned_key?: number | string
}

interface CxIssuePage { records?: CxIssue[]; total_count?: number; page?: number }
interface CxEquipmentAttribute { name?: string; value?: string | number; source_id?: number }

const trackedAssignments = new Set(['person-367394', 'role-608500', 'company-75744'])

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  try {
    const body = await request.json()
    const siteId = String(body.site_id || '')
    const projectId = Number(body.project_id)
    if (!siteId || !Number.isInteger(projectId)) return NextResponse.json({ error: 'Site and CxAlloy project ID are required.' }, { status: 400 })
    const [site] = await sql`select id from public.sites where id = ${siteId}`
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

    const records: CxIssue[] = []
    let page = 1
    let total = Number.POSITIVE_INFINITY
    while (records.length < total && page <= 100) {
      const result = await cxalloyPost<CxIssuePage>('/issue', { project_id: projectId, page, perpage: 500 })
      const pageRecords = result.records || []
      records.push(...pageRecords)
      total = Number(result.total_count ?? records.length)
      if (!pageRecords.length) break
      page++
    }

    const attributes = await cxalloyGet<CxEquipmentAttribute[]>(`/equipmentattribute?project_id=${projectId}`)
    const serialByEquipment = new Map<number, string>()
    for (const attribute of Array.isArray(attributes) ? attributes : []) {
      if (attribute.source_id && /serial/i.test(attribute.name || '') && attribute.value !== undefined && attribute.value !== null) {
        serialByEquipment.set(attribute.source_id, String(attribute.value))
      }
    }

    const assignedRecords = records.filter(record => trackedAssignments.has(`${String(record.assigned_type || '').toLowerCase()}-${record.assigned_key}`))
    const issues: LeanIssueInput[] = assignedRecords.map(record => ({
      issueNumber: record.name || String(record.issue_id),
      description: record.description || '',
      equipmentName: record.asset_name || '',
      serialNumber: record.asset_key ? serialByEquipment.get(record.asset_key) : '',
      sourceUrl: `https://tq.cxalloy.com/project/${projectId}/constructionissue/${record.issue_id}`,
    }))
    const result = await upsertLeanIssues(siteId, issues)
    return NextResponse.json({ ...result, fetched: records.length, matchedAssignments: assignedRecords.length })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 })
  }
}
