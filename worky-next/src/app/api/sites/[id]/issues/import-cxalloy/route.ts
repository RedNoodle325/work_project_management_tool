import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

interface CxAlloyIssue {
  cxalloy_issue_id: string
  title: string
  description?: string
  unit_tag?: string
  priority?: string
  status?: string
  reported_by?: string
  resolution_notes?: string
  closed_date?: string
  reported_date?: string
  cx_zone?: string
  cx_issue_type?: string
  cx_source?: string
  service_ticket_id: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const issues: CxAlloyIssue[] = body.issues ?? []

  let imported = 0

  for (const issue of issues) {
    await sql`
      INSERT INTO public.issues
        (site_id, cxalloy_issue_id, title, description, unit_tag, priority, status,
         reported_by, resolution_notes, closed_date, reported_date, cx_zone,
         cx_issue_type, cx_source, ticket_type, service_ticket_id)
      VALUES
        (${id}, ${issue.cxalloy_issue_id}, ${issue.title}, ${issue.description ?? null},
         ${issue.unit_tag ?? null}, ${issue.priority ?? null}, ${issue.status ?? null},
         ${issue.reported_by ?? null}, ${issue.resolution_notes ?? null},
         ${issue.closed_date ?? null}, ${issue.reported_date ?? null},
         ${issue.cx_zone ?? null}, ${issue.cx_issue_type ?? null}, ${issue.cx_source ?? null},
         'commissioning_issue', ${issue.service_ticket_id})
      ON CONFLICT (cxalloy_issue_id) DO UPDATE SET
        title            = EXCLUDED.title,
        description      = EXCLUDED.description,
        unit_tag         = EXCLUDED.unit_tag,
        priority         = EXCLUDED.priority,
        status           = EXCLUDED.status,
        resolution_notes = EXCLUDED.resolution_notes,
        closed_date      = EXCLUDED.closed_date,
        cx_zone          = EXCLUDED.cx_zone,
        cx_issue_type    = EXCLUDED.cx_issue_type,
        cx_source        = EXCLUDED.cx_source,
        service_ticket_id = EXCLUDED.service_ticket_id
    `
    imported++
  }

  return NextResponse.json({ imported, skipped: 0 })
}
