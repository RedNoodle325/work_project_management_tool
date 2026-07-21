import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, { permission: 'users:manage' })
  if (error) return error

  const users = await sql`
    SELECT id, email, display_name, last_login
    FROM public.users
    WHERE id <> (
      SELECT id FROM public.users
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    )
    ORDER BY email
  `

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, { permission: 'users:manage' })
  if (error) return error

  const { email, password, display_name } = await req.json()
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const displayName = typeof display_name === 'string' ? display_name.trim() : ''

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!displayName) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
  }

  const [owner] = await sql`
    SELECT id, email FROM public.users
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  `
  if (owner?.email === normalizedEmail) {
    return NextResponse.json({ error: 'The owner account cannot be converted to scheduler-only access' }, { status: 400 })
  }

  const passwordHash = await hash(password, 12)
  const [existing] = await sql`SELECT id FROM public.users WHERE email = ${normalizedEmail} LIMIT 1`
  const [user] = existing
    ? await sql`
        UPDATE public.users
        SET password_hash = ${passwordHash}, display_name = ${displayName}, access_role = 'scheduler'
        WHERE id = ${existing.id} AND id <> ${owner.id}
        RETURNING id, email, display_name
      `
    : await sql`
        INSERT INTO public.users (email, password_hash, display_name, access_role)
        VALUES (${normalizedEmail}, ${passwordHash}, ${displayName}, 'scheduler')
        RETURNING id, email, display_name
      `

  return NextResponse.json({ ...user, access_role: 'scheduler' })
}
