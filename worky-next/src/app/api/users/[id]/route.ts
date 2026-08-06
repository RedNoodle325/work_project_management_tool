import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { requireAuth } from '@/lib/requireAuth'
import { isRole } from '@/lib/permissions'
import sql from '@/lib/db'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, claims } = await requireAuth(req, { permission: 'users:manage' })
  if (error) return error
  const { id } = await context.params
  const body = await req.json()
  const [target] = await sql`SELECT id, access_role FROM public.users WHERE id = ${id} LIMIT 1`
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.access_role === 'owner' && claims.sub !== id) return NextResponse.json({ error: 'The owner role cannot be changed' }, { status: 403 })
  if (body.access_role !== undefined && (!isRole(body.access_role) || body.access_role === 'owner')) {
    return NextResponse.json({ error: 'Select a valid non-owner role' }, { status: 400 })
  }
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : undefined
  if (body.display_name !== undefined && !displayName) return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
  const passwordHash = body.password === undefined ? undefined : (typeof body.password === 'string' && body.password.length >= 8 ? await hash(body.password, 12) : null)
  if (passwordHash === null) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  const [user] = await sql`
    UPDATE public.users SET
      display_name = COALESCE(${displayName ?? null}, display_name),
      access_role = COALESCE(${body.access_role ?? null}, access_role),
      password_hash = COALESCE(${passwordHash ?? null}, password_hash)
    WHERE id = ${id}
    RETURNING id, email, display_name, access_role, last_login, created_at
  `
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, claims } = await requireAuth(req, { permission: 'users:manage' })
  if (error) return error
  const { id } = await context.params
  if (claims.sub === id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  const [target] = await sql`SELECT access_role FROM public.users WHERE id = ${id} LIMIT 1`
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.access_role === 'owner') return NextResponse.json({ error: 'The owner account cannot be deleted' }, { status: 403 })
  await sql`DELETE FROM public.users WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}
