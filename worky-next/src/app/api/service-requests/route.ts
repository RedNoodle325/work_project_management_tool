import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { hasPermission } from '@/lib/permissions'
import sql from '@/lib/db'

const clean = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error
  const canReview = hasPermission(auth.claims.role, 'service_requests:review')
  const rows = canReview
    ? await sql`select r.*, u.display_name as requester_name, u.email as requester_email from public.service_requests r join public.users u on u.id=r.requested_by order by r.created_at desc`
    : await sql`select r.*, u.display_name as requester_name, u.email as requester_email from public.service_requests r join public.users u on u.id=r.requested_by where r.requested_by=${auth.claims.sub} order by r.created_at desc`
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { permission: 'service_requests:submit' })
  if (auth.error) return auth.error
  const body = await request.json()
  const requestType = clean(body.request_type, 20)
  if (!['billable','startup','warranty'].includes(requestType)) return NextResponse.json({ error: 'Select a valid request type' }, { status: 400 })
  const required = ['site_name','site_address','site_contact_name','site_contact_details','unit_serial_number','region','requested_scope','requested_service_date']
  if (required.some(field => !clean(body[field]))) return NextResponse.json({ error: 'Complete all required site, contact, unit, scope, and date fields' }, { status: 400 })
  if ((requestType === 'billable' || requestType === 'startup') && !clean(body.po_number) && !clean(body.payment_evidence)) return NextResponse.json({ error: 'Provide a PO number or proof that the work is authorized for payment' }, { status: 400 })
  if (requestType === 'startup' && !clean(body.contract_language)) return NextResponse.json({ error: 'Startup and commissioning contract language is required' }, { status: 400 })
  if (requestType === 'warranty' && (!clean(body.c2_number) || !clean(body.warranty_details))) return NextResponse.json({ error: 'A C-2 number and warranty information are required' }, { status: 400 })
  const created = await sql.begin(async tx => {
    const trx = tx as unknown as typeof sql
    const [stamp] = await trx`select to_char(now() at time zone 'America/New_York','YYYYMMDD') as day`
    await trx`select pg_advisory_xact_lock(hashtext(${`service-request:${stamp.day}`}))`
    const [sequence] = await trx`select coalesce(max(right(request_number,3)::int),0)+1 as value from public.service_requests where request_number like ${`SR-${stamp.day}-%`}`
    const number = `SR-${stamp.day}-${String(Number(sequence.value)).padStart(3,'0')}`
    const [row] = await trx`
      insert into public.service_requests
        (request_number,request_type,site_id,site_name,site_address,site_contact_name,site_contact_details,unit_serial_number,region,requested_scope,requested_service_date,po_number,payment_evidence,contract_language,c2_number,warranty_start_date,warranty_end_date,warranty_details,requested_by)
      values
        (${number},${requestType},${clean(body.site_id)||null},${clean(body.site_name)},${clean(body.site_address)},${clean(body.site_contact_name)},${clean(body.site_contact_details)},${clean(body.unit_serial_number)},${clean(body.region,20)},${clean(body.requested_scope)},${clean(body.requested_service_date,20)},${clean(body.po_number)||null},${clean(body.payment_evidence)||null},${clean(body.contract_language,8000)||null},${clean(body.c2_number)||null},${clean(body.warranty_start_date,20)||null},${clean(body.warranty_end_date,20)||null},${clean(body.warranty_details)||null},${auth.claims.sub})
      returning *
    `
    return row
  })
  return NextResponse.json(created,{status:201})
}
