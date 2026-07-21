import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { extractToken, verifyToken, type Claims } from './auth'
import sql from './db'
import { hasPermission, isRole, permissionForRequest, type Permission, type Role } from './permissions'

type AuthResult =
  | { error: NextResponse; claims?: never }
  | { error?: never; claims: Claims }

export async function requireAuth(
  req: NextRequest | Request,
  options: { allowReadOnlyOwner?: boolean; allowScheduler?: boolean; permission?: Permission } = {},
): Promise<AuthResult> {
  const token = extractToken(req)
  if (token) {
    const claims = await verifyToken(token)
    if (claims) {
      // Re-check the account and its role on every request. This makes role
      // changes take effect immediately, including for already-issued tokens.
      const [user] = await sql`
        SELECT
          account.id,
          account.email,
          account.display_name,
          account.access_role
        FROM public.users account
        WHERE account.id = ${claims.sub}
        LIMIT 1
      `
      if (user && isRole(user.access_role)) {
        const role: Role = user.access_role
        const verifiedClaims: Claims = {
          ...claims,
          email: user.email,
          name: user.display_name,
          role,
        }
        const permission = options.permission ?? permissionForRequest(new URL(req.url).pathname, req.method)
        // `allowScheduler` remains supported during the transition for existing routes.
        if (hasPermission(role, permission) || (options.allowScheduler && hasPermission(role, 'scheduler:manage'))) return { claims: verifiedClaims }
        return { error: NextResponse.json({ error: 'Your role does not have permission for this action' }, { status: 403 }) }
      }
    }
  }

  // The tracker remains public to browse. Anonymous visitors can never change data.
  if (!options.permission && !options.allowReadOnlyOwner && (req.method === 'GET' || req.method === 'HEAD')) {
    return { claims: { sub: 'anon', email: '', name: 'Read-only visitor', role: 'visitor' } }
  }

  return {
    error: NextResponse.json(
      { error: 'Authentication is required' },
      { status: 401 },
    ),
  }
}
