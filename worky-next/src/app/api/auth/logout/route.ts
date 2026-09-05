import { NextResponse } from 'next/server'

export async function POST() {
  const response = new NextResponse(null, { status: 204 })
  response.cookies.set('worky_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
