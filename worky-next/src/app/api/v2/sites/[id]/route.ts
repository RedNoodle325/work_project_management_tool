import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params

  const [siteRows, projects, units, contacts, updates, asrs, issues, partOrders, serviceVisits, attachments] = await Promise.all([
    sql`select * from public.site_overview where id = ${id}`,
    sql`select * from public.projects where site_id = ${id} order by is_primary desc, created_at desc`,
    sql`select * from public.units where site_id = ${id} order by tag`,
    sql`select c.*, sc.role, sc.is_primary from public.site_contacts sc join public.contacts c on c.id = sc.contact_id where sc.site_id = ${id} order by sc.is_primary desc, c.name`,
    sql`select su.*, (select count(*)::int from public.attachments a where a.update_id = su.id) as attachment_count from public.site_updates su where site_id = ${id} order by is_pinned desc, created_at desc limit 100`,
    sql`select a.*, p.project_number, (select count(*) from public.issues i where i.asr_id = a.id) as issue_count from public.asrs a join public.projects p on p.id = a.project_id where a.site_id = ${id} order by a.created_at desc`,
    sql`select i.*, a.asr_number, u.tag as unit_tag from public.issues i join public.asrs a on a.id = i.asr_id left join public.units u on u.id = i.unit_id where i.site_id = ${id} order by i.reported_at desc`,
    sql`select po.*, a.asr_number from public.part_orders po join public.asrs a on a.id = po.asr_id where a.site_id = ${id} order by po.created_at desc`,
    sql`select sv.*, a.asr_number from public.service_visits sv join public.asrs a on a.id = sv.asr_id where a.site_id = ${id} order by coalesce(sv.scheduled_for, sv.created_at) desc`,
    sql`select * from public.attachments where site_id = ${id} order by created_at desc`,
  ])

  if (!siteRows[0]) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  return NextResponse.json({ site: siteRows[0], projects, units, contacts, updates, asrs, issues, part_orders: partOrders, service_visits: serviceVisits, attachments })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const body = await request.json()

  if (body.kind === 'update') {
    const [row] = await sql`insert into public.site_updates (site_id, status, summary, title, details, update_type, is_pinned, author_name) values (${id}, ${body.status ?? null}, ${body.summary}, ${body.title ?? null}, ${body.details ?? null}, ${body.update_type ?? 'general'}, ${body.is_pinned ?? false}, ${body.author_name ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'project') {
    const [row] = await sql`insert into public.projects (site_id, project_number, name, status, is_primary, notes) values (${id}, ${body.project_number}, ${body.name}, ${body.status ?? 'active'}, ${body.is_primary ?? false}, ${body.notes ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'unit') {
    const [row] = await sql`insert into public.units (site_id, project_id, tag, serial_number, manufacturer, model, unit_type, location_in_site, status, notes) values (${id}, ${body.project_id ?? null}, ${body.tag}, ${body.serial_number ?? null}, ${body.manufacturer ?? null}, ${body.model ?? null}, ${body.unit_type ?? null}, ${body.location_in_site ?? null}, ${body.status ?? 'active'}, ${body.notes ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'contact') {
    const [site] = await sql`select customer_id from public.site_overview where id = ${id}`
    const [contact] = await sql`insert into public.contacts (customer_id, name, company, title, email, phone, notes) values (${site.customer_id}, ${body.name}, ${body.company ?? null}, ${body.title ?? null}, ${body.email ?? null}, ${body.phone ?? null}, ${body.notes ?? null}) returning *`
    await sql`insert into public.site_contacts (site_id, contact_id, role, is_primary) values (${id}, ${contact.id}, ${body.role ?? null}, ${body.is_primary ?? false})`
    return NextResponse.json(contact, { status: 201 })
  }
  if (body.kind === 'asr') {
    const [project] = await sql`select project_number from public.projects where id = ${body.project_id} and site_id = ${id}`
    if (!project) return NextResponse.json({ error: 'Project not found for this site' }, { status: 400 })
    const prefix = `ASR-${project.project_number}-`
    const manualNumber = String(body.asr_number ?? '').trim()
    if (manualNumber && (!manualNumber.startsWith(prefix) || !/^\d{4}$/.test(manualNumber.slice(prefix.length)))) {
      return NextResponse.json({ error: `ASR number must use ${prefix}####` }, { status: 400 })
    }
    const asr = await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${body.project_id}))`
      let number = manualNumber
      if (!number) {
        const [sequence] = await tx`
          select coalesce(max(right(asr_number, 4)::integer), 0) as max_serial
          from public.asrs
          where project_id = ${body.project_id}
            and left(asr_number, ${prefix.length}) = ${prefix}
            and length(asr_number) = ${prefix.length + 4}
            and right(asr_number, 4) ~ '^[0-9]{4}$'
        `
        number = `${prefix}${String(Number(sequence.max_serial) + 1).padStart(4, '0')}`
      }
      const [row] = await tx`insert into public.asrs (site_id, project_id, asr_number, title, description, status) values (${id}, ${body.project_id}, ${number}, ${body.title}, ${body.description ?? null}, ${body.status ?? 'open'}) returning *`
      return row
    })
    return NextResponse.json(asr, { status: 201 })
  }
  if (body.kind === 'issue') {
    const [asr] = await sql`select id from public.asrs where id = ${body.asr_id} and site_id = ${id}`
    if (!asr) return NextResponse.json({ error: 'ASR is required and must belong to this site' }, { status: 400 })
    const [row] = await sql`insert into public.issues (site_id, unit_id, asr_id, title, description, priority, status, source, external_reference) values (${id}, ${body.unit_id ?? null}, ${body.asr_id}, ${body.title}, ${body.description ?? null}, ${body.priority ?? 'normal'}, ${body.status ?? 'open'}, ${body.source ?? null}, ${body.external_reference ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'part_order') {
    const [row] = await sql`insert into public.part_orders (asr_id, supplier, order_number, status, ordered_at, expected_at, notes) values (${body.asr_id}, ${body.supplier ?? null}, ${body.order_number ?? null}, ${body.status ?? 'needed'}, ${body.ordered_at ?? null}, ${body.expected_at ?? null}, ${body.notes ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  if (body.kind === 'service_visit') {
    const [row] = await sql`insert into public.service_visits (asr_id, scheduled_for, status, provider, technician_names, summary, notes) values (${body.asr_id}, ${body.scheduled_for ?? null}, ${body.status ?? 'planned'}, ${body.provider ?? null}, ${body.technician_names ?? null}, ${body.summary ?? null}, ${body.notes ?? null}) returning *`
    return NextResponse.json(row, { status: 201 })
  }
  return NextResponse.json({ error: 'Unsupported site entity' }, { status: 400 })
}
