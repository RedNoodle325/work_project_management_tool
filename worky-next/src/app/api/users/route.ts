import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { hash } from 'bcryptjs'
import { isRole } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, { permission: 'users:manage' })
  if (error) return error

  const users = await sql`
    SELECT id, email, display_name, access_role, last_login, created_at
    FROM public.users
    ORDER BY email ASC
  `

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, { permission: 'users:manage' })
  if (error) return error

  const { email, password, display_name, access_role } = await req.json()
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const displayName = typeof display_name === 'string' ? display_name.trim() : ''
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || !displayName || typeof password !== 'string' || password.length < 8 || !isRole(access_role) || access_role === 'owner') {
    return NextResponse.json({ error: 'Provide a name, valid email, password of at least 8 characters, and a non-owner role' }, { status: 400 })
  }

  const [existing] = await sql`SELECT id FROM public.users WHERE email = ${normalizedEmail} LIMIT 1`
  if (existing) return NextResponse.json({ error: 'An account already exists for that email' }, { status: 409 })
  const passwordHash = await hash(password, 12)
  const [user] = await sql`
    INSERT INTO public.users (email, password_hash, display_name, access_role)
    VALUES (${normalizedEmail}, ${passwordHash}, ${displayName}, ${access_role})
    RETURNING id, email, display_name, access_role, last_login, created_at
  `
  return NextResponse.json(user, { status: 201 })
}
