import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import type { Role } from './permissions'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export interface Claims {
  sub: string
  email: string
  name?: string
  role: Role | 'visitor'
  exp?: number
  iat?: number
}

export async function signToken(claims: Omit<Claims, 'exp' | 'iat'>): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<Claims | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as Claims
  } catch {
    return null
  }
}

export function extractToken(req: NextRequest | Request): string | null {
  const auth = req.headers.get('Authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null
}
