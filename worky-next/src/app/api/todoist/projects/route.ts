import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { allowReadOnlyOwner: true })
  if (auth.error) return auth.error

  const token = process.env.TODOIST_API_TOKEN
  if (!token) return NextResponse.json({ error: 'Todoist is not configured. Add TODOIST_API_TOKEN to the server environment.' }, { status: 503 })

  const response = await fetch('https://api.todoist.com/api/v1/projects?limit=200', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    return NextResponse.json({ error: await response.text() || 'Unable to load Todoist projects' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data.results ?? [])
}
