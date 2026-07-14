import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(request)
  if (error) return error
  const { id } = await params
  const body = await request.json()
  const [issue] = await sql`
    update public.issues
    set internal_notes = ${String(body.internal_notes || '').trim() || null}, updated_at = now()
    where id = ${id}
    returning id, internal_notes, updated_at
  `
  if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
  return NextResponse.json(issue)
}
