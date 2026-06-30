import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { uploadFile } from '@/lib/storage'
import sql from '@/lib/db'

const CATEGORIES = new Set(['po', 'quote', 'invoice', 'submittal', 'email', 'photo', 'report', 'other'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const rows = await sql`
    select a.*, su.summary as update_summary
    from public.attachments a
    left join public.site_updates su on su.id = a.update_id
    where a.site_id = ${id}
    order by a.created_at desc
  `
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, claims } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const [site] = await sql`select id from public.sites where id = ${id}`
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 })
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Files must be 50 MB or smaller' }, { status: 400 })
  }

  const categoryValue = String(form.get('category') || 'other').toLowerCase()
  const category = CATEGORIES.has(categoryValue) ? categoryValue : 'other'
  const updateId = String(form.get('update_id') || '') || null
  if (updateId) {
    const [update] = await sql`select id from public.site_updates where id = ${updateId} and site_id = ${id}`
    if (!update) return NextResponse.json({ error: 'Update does not belong to this site' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
  const storagePath = `${id}/${crypto.randomUUID()}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile('site-files', storagePath, buffer, file.type || 'application/octet-stream')

  const [row] = await sql`
    insert into public.attachments
      (site_id, update_id, category, file_name, storage_path, mime_type, size_bytes, description, uploaded_by, uploaded_by_name)
    values
      (${id}, ${updateId}, ${category}, ${file.name}, ${storagePath}, ${file.type || null}, ${file.size},
       ${String(form.get('description') || '') || null}, ${claims.sub === 'anon' ? null : claims.sub}, ${claims.name ?? claims.email ?? null})
    returning *
  `
  return NextResponse.json(row, { status: 201 })
}
