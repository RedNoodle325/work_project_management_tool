import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? null
  const siteId = searchParams.get('site_id') ?? null
  const unitType = searchParams.get('unit_type') ?? null
  const commissionLevel = searchParams.get('commission_level') ?? null

  const units = await sql`
    SELECT * FROM public.units
    WHERE (${id}::UUID IS NULL OR id = ${id})
    AND (${siteId}::UUID IS NULL OR site_id = ${siteId})
    AND (${unitType}::TEXT IS NULL OR unit_type = ${unitType})
    AND (${commissionLevel}::TEXT IS NULL OR commission_level = ${commissionLevel})
    ORDER BY job_number, line_number
  `

  return NextResponse.json(units)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req)
  if (error) return error

  const body = await req.json()

  const {
    site_id,
    unit_type,
    serial_number,
    job_number,
    line_number,
    manufacturer,
    model,
    description,
    location_in_site,
    install_date,
    warranty_start_date,
    warranty_end_date,
    notes,
  } = body

  const [unit] = await sql`
    INSERT INTO public.units (
      site_id,
      unit_type,
      serial_number,
      job_number,
      line_number,
      manufacturer,
      model,
      description,
      location_in_site,
      install_date,
      warranty_start_date,
      warranty_end_date,
      notes,
      commission_level,
      status
    ) VALUES (
      ${site_id ?? null},
      ${unit_type ?? null},
      ${serial_number ?? null},
      ${job_number ?? null},
      ${line_number ?? null},
      ${manufacturer ?? null},
      ${model ?? null},
      ${description ?? null},
      ${location_in_site ?? null},
      ${install_date ?? null},
      ${warranty_start_date ?? null},
      ${warranty_end_date ?? null},
      ${notes ?? null},
      ${'none'},
      ${'active'}
    )
    RETURNING *
  `

  return NextResponse.json(unit, { status: 201 })
}
