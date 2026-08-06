import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { signToken } from '@/lib/auth'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const rows = await sql`
    SELECT
      account.id,
      account.email,
      account.password_hash,
      account.display_name,
      account.access_role
    FROM public.users account
    WHERE account.email = ${email.trim().toLowerCase()}
    LIMIT 1
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

  const access_role = user.access_role
  const token = await signToken({ sub: user.id, email: user.email, name: user.display_name, role: access_role })

  return NextResponse.json({ token, email: user.email, display_name: user.display_name, access_role })
}
