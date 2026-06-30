import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { deleteFile, getSignedUrl } from '@/lib/storage'
import sql from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const [attachment] = await sql`select storage_path from public.attachments where id = ${id}`
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  return NextResponse.json({ url: await getSignedUrl('site-files', attachment.storage_path, 300) })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const [attachment] = await sql`delete from public.attachments where id = ${id} returning storage_path`
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  await deleteFile('site-files', attachment.storage_path)
  return NextResponse.json({ ok: true })
}
