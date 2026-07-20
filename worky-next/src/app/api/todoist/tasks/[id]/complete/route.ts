import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, { allowReadOnlyOwner: true })
  if (auth.error) return auth.error

  const token = process.env.TODOIST_API_TOKEN
  if (!token) return NextResponse.json({ error: 'Todoist is not configured. Add TODOIST_API_TOKEN to the server environment.' }, { status: 503 })

  const { id } = await params
  const response = await fetch(`https://api.todoist.com/api/v1/tasks/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() || 'Unable to complete Todoist task' }, { status: 502 })
  }

  return new NextResponse(null, { status: 204 })
}
