import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Claims } from './auth'
import type { Permission } from './permissions'

type AuthResult =
  | { error: NextResponse; claims?: never }
  | { error?: never; claims: Claims }

export async function requireAuth(
  _req: NextRequest | Request,
  _options: { allowReadOnlyOwner?: boolean; allowScheduler?: boolean; permission?: Permission } = {},
): Promise<AuthResult> {
  void _options
  return { claims: { sub: 'public-workspace', email: '', name: 'Program workspace', role: 'owner' } }
}
