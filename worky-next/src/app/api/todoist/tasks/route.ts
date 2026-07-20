import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

const TODOIST_API = 'https://api.todoist.com/api/v1/tasks'

function todoistToken() {
  return process.env.TODOIST_API_TOKEN
}

async function todoistFetch(path = '', init: RequestInit = {}) {
  const token = todoistToken()
  if (!token) throw new Error('Todoist is not configured. Add TODOIST_API_TOKEN to the server environment.')

  const response = await fetch(`${TODOIST_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Todoist returned ${response.status}`)
  }

  return response
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { allowReadOnlyOwner: true })
  if (auth.error) return auth.error

  try {
    const response = await todoistFetch('?limit=200')
    const data = await response.json()
    return NextResponse.json(data.results ?? [])
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load Todoist tasks' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { allowReadOnlyOwner: true })
  if (auth.error) return auth.error

  const body = await req.json() as { content?: unknown; description?: unknown; project_id?: unknown }
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return NextResponse.json({ error: 'Task text is required' }, { status: 400 })
  }

  try {
    const response = await todoistFetch('', {
      method: 'POST',
      body: JSON.stringify({
        content: body.content.trim(),
        description: typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
        project_id: typeof body.project_id === 'string' && body.project_id ? body.project_id : undefined,
      }),
    })
    return NextResponse.json(await response.json(), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to add Todoist task' }, { status: 502 })
  }
}
