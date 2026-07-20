import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

export async function GET(req: NextRequest) {
  const { error, claims } = await requireAuth(req, { allowReadOnlyOwner: true })
  if (error) return error

  return NextResponse.json({ email: claims.email, display_name: claims.name })
}
