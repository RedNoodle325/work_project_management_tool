import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = extractToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const claims = await verifyToken(token)
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ email: claims.email, display_name: claims.name })
}
