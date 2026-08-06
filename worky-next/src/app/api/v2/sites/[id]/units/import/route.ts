import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

function value(row: Record<string, string>, ...keys: string[]) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, item]) => [key.trim().toLowerCase(), String(item || '').trim()]))
  return keys.map(key => normalized[key.toLowerCase()]).find(Boolean) || ''
}

function unitStatus(status: string) {
  const text = status.toLowerCase()
  if (text.includes('not installed') || text.includes('planned')) return 'planned'
  if (text.includes('ready for') || text.includes('startup') || text.includes('functional')) return 'commissioning'
  if (text.includes('red tag')) return 'attention'
  if (text.includes('complete')) return 'active'
  return 'active'
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id: siteId } = await params
  const [site] = await sql`select id from public.sites where id = ${siteId}`
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an equipment CSV file.' }, { status: 400 })

  const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true })
  const rows = parsed.data.map(row => ({
    tag: value(row, 'unit tag', 'tag', 'equipment name', 'asset tag'),
    serial: value(row, 'serial #', 'serial number', 'serial'),
    manufacturer: value(row, 'manufacturer'),
    model: value(row, 'model', 'model number'),
    unitType: value(row, 'unit type', 'type', 'equipment type'),
    location: value(row, 'location', 'location in site', 'space'),
    status: unitStatus(value(row, 'cxalloy status', 'status')),
  })).filter(row => row.tag)
  if (!rows.length) return NextResponse.json({ error: 'No unit tags were found. Use a CSV with a Unit Tag column.' }, { status: 400 })

  let created = 0
  let updated = 0
  await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    for (const row of rows) {
      const [existing] = await trx`select id from public.units where site_id = ${siteId} and lower(tag) = lower(${row.tag})`
      if (existing) {
        await trx`update public.units set serial_number = coalesce(${row.serial || null}, serial_number), manufacturer = coalesce(${row.manufacturer || null}, manufacturer), model = coalesce(${row.model || null}, model), unit_type = coalesce(${row.unitType || null}, unit_type), location_in_site = coalesce(${row.location || null}, location_in_site), status = ${row.status} where id = ${existing.id}`
        updated++
      } else {
        await trx`insert into public.units (site_id, tag, serial_number, manufacturer, model, unit_type, location_in_site, status) values (${siteId}, ${row.tag}, ${row.serial || null}, ${row.manufacturer || null}, ${row.model || null}, ${row.unitType || null}, ${row.location || null}, ${row.status})`
        created++
      }
    }
  })
  return NextResponse.json({ created, updated, processed: rows.length })
}
