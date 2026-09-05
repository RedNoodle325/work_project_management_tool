import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Claims } from './auth'
import type { Permission } from './permissions'
import { extractToken, verifyToken } from './auth'
import { hasPermission, isRole, permissionForRequest } from './permissions'
import sql from './db'

type AuthResult =
  | { error: NextResponse; claims?: never }
  | { error?: never; claims: Claims }

export async function requireAuth(
  req: NextRequest | Request,
  options: { allowReadOnlyOwner?: boolean; allowScheduler?: boolean; permission?: Permission } = {},
): Promise<AuthResult> {
  const token = extractToken(req)
  const verified = token ? await verifyToken(token) : null
  if (!verified?.sub) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }
  const [account] = await sql`
    SELECT id, email, display_name, access_role
    FROM public.users
    WHERE id = ${verified.sub}
    LIMIT 1
  `
  if (!account || !isRole(account.access_role)) {
    return { error: NextResponse.json({ error: 'Account is no longer active' }, { status: 401 }) }
  }
  const permission = options.permission ?? permissionForRequest(new URL(req.url).pathname, req.method)
  if (!hasPermission(account.access_role, permission)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 }) }
  }
  return { claims: { sub: account.id, email: account.email, name: account.display_name, role: account.access_role } }
}
