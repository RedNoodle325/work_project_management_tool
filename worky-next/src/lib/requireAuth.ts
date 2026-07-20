import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { extractToken, verifyToken, type Claims } from './auth'
import sql from './db'

type AuthResult =
  | { error: NextResponse; claims?: never }
  | { error?: never; claims: Claims }

export async function requireAuth(
  req: NextRequest | Request,
  options: { allowReadOnlyOwner?: boolean } = {},
): Promise<AuthResult> {
  const token = extractToken(req)
  if (token) {
    const claims = await verifyToken(token)
    if (claims) {
      // Re-check the owner on the server rather than trusting the token alone.
      // This also blocks a token issued before the workspace was made private.
      const [owner] = await sql`
        SELECT id FROM public.users
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `
      if (owner?.id === claims.sub) return { claims }
    }
  }

  // The tracker is public to browse. Only the owner can use a non-read request
  // to create, change, upload, import, or delete data.
  if (!options.allowReadOnlyOwner && (req.method === 'GET' || req.method === 'HEAD')) {
    return { claims: { sub: 'anon', email: '', name: 'Read-only visitor' } }
  }

  return {
    error: NextResponse.json(
      { error: 'Authentication is required' },
      { status: 401 },
    ),
  }
}
