import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { signToken } from '@/lib/auth'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const [{ count }] = await sql`SELECT COUNT(*) FROM public.users`
  if (Number(count) > 0) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 403 })
  }

  const { email, password, display_name } = await req.json()

  if (!email || !password || !display_name) {
    return NextResponse.json({ error: 'Email, password, and display_name are required' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const password_hash = await hash(password, 12)

  const [user] = await sql`
    INSERT INTO public.users (email, password_hash, display_name, access_role)
    VALUES (${normalizedEmail}, ${password_hash}, ${display_name.trim()}, 'owner')
    RETURNING id, email, display_name
  `

  const token = await signToken({ sub: user.id, email: user.email, name: user.display_name, role: 'owner' })

  return NextResponse.json({ token, email: user.email, display_name: user.display_name, access_role: 'owner' })
}
