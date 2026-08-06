import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

type DispatchSite = {
  id: string
  name: string
  project_name: string | null
  project_number: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { allowReadOnlyOwner: true, allowScheduler: true })
  if (auth.error) return auth.error

  const names = request.nextUrl.searchParams.getAll('site').map(name => name.trim()).filter(Boolean)
  if (!names.length) return NextResponse.json([])

  const normalized = [...new Set(names.map(name => name.toLowerCase()))]
  const sites = await sql<DispatchSite[]>`
    SELECT s.id, s.name, p.name AS project_name, p.project_number,
           s.address, s.city, s.state, s.postal_code AS zip_code
    FROM public.sites s
    LEFT JOIN LATERAL (
      SELECT name, project_number
      FROM public.projects
      WHERE site_id = s.id
      ORDER BY is_primary DESC, created_at DESC
      LIMIT 1
    ) p ON true
    WHERE LOWER(s.name) = ANY(${normalized}::text[])
       OR LOWER(COALESCE(p.name, '')) = ANY(${normalized}::text[])
    ORDER BY s.name
  `

  const siteIds = sites.map(site => site.id)
  const units = siteIds.length ? await sql<{ site_id: string; serial_number: string | null; model: string | null; unit_type: string | null }[]>`
    SELECT site_id, serial_number, model, unit_type
    FROM public.units
    WHERE site_id = ANY(${siteIds}::uuid[])
    ORDER BY serial_number NULLS LAST
  ` : []

  return NextResponse.json(sites.map(site => ({
    ...site,
    units: units.filter(unit => unit.site_id === site.id),
  })))
}
