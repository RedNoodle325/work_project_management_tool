import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { signToken } from '@/lib/auth'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // This workspace is intentionally single-owner. The first account created
  // during setup is the owner; later rows cannot be used to gain access.
  const rows = await sql`
    SELECT id, email, password_hash, display_name
    FROM public.users
    WHERE email = ${email.toLowerCase()}
      AND id = (
        SELECT id FROM public.users
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      )
  `

  const user = rows[0]
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await sql`UPDATE public.users SET last_login = NOW() WHERE id = ${user.id}`

  const token = await signToken({ sub: user.id, email: user.email, name: user.display_name })

  return NextResponse.json({ token, email: user.email, display_name: user.display_name })
}
