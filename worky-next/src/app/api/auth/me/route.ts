import { NextRequest, NextResponse } from 'next/server'
import { extractToken, verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { error, claims } = await requireAuth(req, { allowReadOnlyOwner: true, allowScheduler: true })
  if (error) return error

  return NextResponse.json({ email: claims.email, display_name: claims.name, access_role: claims.role })
}
