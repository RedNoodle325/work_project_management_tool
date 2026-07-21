import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { extractToken, verifyToken, type Claims } from './auth'
import sql from './db'

type AuthResult =
  | { error: NextResponse; claims?: never }
  | { error?: never; claims: Claims }

export async function requireAuth(
  req: NextRequest | Request,
  options: { allowReadOnlyOwner?: boolean; allowScheduler?: boolean } = {},
): Promise<AuthResult> {
  const token = extractToken(req)
  if (token) {
    const claims = await verifyToken(token)
    if (claims) {
      // Re-check the account and its scope on every request instead of trusting
      // the token role. The first account remains the workspace owner; every
      // later account is restricted to the employee scheduler.
      const [user] = await sql`
        SELECT
          account.id,
          account.email,
          account.display_name,
          account.id = (
            SELECT id FROM public.users
            ORDER BY created_at ASC, id ASC
            LIMIT 1
          ) AS is_owner
        FROM public.users account
        WHERE account.id = ${claims.sub}
        LIMIT 1
      `
      if (user) {
        const role = user.is_owner ? 'owner' : 'scheduler'
        const verifiedClaims: Claims = {
          ...claims,
          email: user.email,
          name: user.display_name,
          role,
        }
        if (role === 'owner' || options.allowScheduler) return { claims: verifiedClaims }
        if (options.allowReadOnlyOwner || (req.method !== 'GET' && req.method !== 'HEAD')) {
          return {
            error: NextResponse.json(
              { error: 'This account can only edit the employee scheduler' },
              { status: 403 },
            ),
          }
        }
      }
    }
  }

  // The tracker is public to browse. Only the owner can use a non-read request
  // to create, change, upload, import, or delete data.
  if (!options.allowReadOnlyOwner && (req.method === 'GET' || req.method === 'HEAD')) {
    return { claims: { sub: 'anon', email: '', name: 'Read-only visitor', role: 'visitor' } }
  }

  return {
    error: NextResponse.json(
      { error: 'Authentication is required' },
      { status: 401 },
    ),
  }
}
