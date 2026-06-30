import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params

  const tickets = await sql`
    SELECT id, site_id, title, description, status, c2_number, parts_ordered, service_lines,
           serial_number, ticket_type, open_date, priority_num, site_company_id, scope_of_work,
           created_at, updated_at
    FROM public.service_tickets
    WHERE site_id = ${id}
    ORDER BY created_at DESC
  `
  return NextResponse.json(tickets)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, description, status, c2_number, parts_ordered, service_lines, scope_of_work } = body

  const [site] = await sql`SELECT project_number FROM public.sites WHERE id = ${id}`
  const projectNumber = String(site?.project_number ?? '').trim()
  if (!projectNumber) {
    return NextResponse.json({ error: 'A project number is required before an ASR can be created.' }, { status: 400 })
  }

  const prefix = `ASR-${projectNumber}-`
  const requestedNumber = String(c2_number ?? '').trim()
  if (requestedNumber) {
    const suffix = requestedNumber.slice(prefix.length)
    if (!requestedNumber.startsWith(prefix) || !/^\d{4}$/.test(suffix)) {
      return NextResponse.json({ error: `ASR number must use the format ${prefix}0001.` }, { status: 400 })
    }
  }

  const created = await sql.begin(async tx => {
    // postgres.js transaction clients are callable tags at runtime. Its current
    // TransactionSql declaration loses that call signature under this Next/TS
    // toolchain, so retain the runtime object with the parent client's type.
    const trx = tx as unknown as typeof sql
    // Serialize ASR allocation per site so simultaneous requests cannot receive
    // the same number.
    await trx`SELECT pg_advisory_xact_lock(hashtext(${id}))`

    let asrNumber = requestedNumber
    if (asrNumber) {
      const [duplicate] = await trx`SELECT id FROM public.service_tickets WHERE c2_number = ${asrNumber} LIMIT 1`
      if (duplicate) throw new Error(`ASR ${asrNumber} already exists.`)
    } else {
      const [sequence] = await trx`
        SELECT COALESCE(MAX(RIGHT(c2_number, 4)::INTEGER), 0) AS max_serial
        FROM public.service_tickets
        WHERE site_id = ${id}
          AND LEFT(c2_number, ${prefix.length}) = ${prefix}
          AND LENGTH(c2_number) = ${prefix.length + 4}
          AND RIGHT(c2_number, 4) ~ '^[0-9]{4}$'
      `
      const nextSerial = Number(sequence.max_serial) + 1
      if (nextSerial > 9999) throw new Error('This project has exhausted its four-digit ASR sequence.')
      asrNumber = `${prefix}${String(nextSerial).padStart(4, '0')}`
    }

    const [record] = await trx`
      INSERT INTO public.service_tickets
        (site_id, title, description, status, c2_number, parts_ordered, service_lines, scope_of_work)
      VALUES
        (${id}, ${title}, ${description ?? null}, ${status ?? null}, ${asrNumber},
         ${parts_ordered ?? null}, ${service_lines ?? null}, ${scope_of_work ?? null})
      RETURNING id, site_id, title, description, status, c2_number, parts_ordered, service_lines,
                serial_number, ticket_type, open_date, priority_num, site_company_id, scope_of_work,
                created_at, updated_at
    `
    return record
  })

  return NextResponse.json(created, { status: 201 })
}
