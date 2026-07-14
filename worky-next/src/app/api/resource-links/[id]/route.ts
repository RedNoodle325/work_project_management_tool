import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const url = safeUrl(body.url)
  if (!url) return NextResponse.json({ error: 'Enter a valid http or https link' }, { status: 400 })

  const rows = await sql`
    UPDATE public.resource_links SET
      name        = ${body.name.trim()},
      url         = ${url},
      category    = ${body.category?.trim() || 'general'},
      description = ${body.description?.trim() || null},
      sort_order  = ${body.sort_order ?? 0}
    WHERE id = ${id}
    RETURNING *
  `
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth(request)
  if (error) return error

  const { id } = await params
  await sql`DELETE FROM public.resource_links WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}

function safeUrl(value: unknown) {
  try {
    const url = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch { return null }
}
