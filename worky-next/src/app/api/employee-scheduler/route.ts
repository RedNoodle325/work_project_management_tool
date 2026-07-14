import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const rows = await sql`SELECT data, updated_at FROM public.employee_scheduler_state WHERE id = true`
  return NextResponse.json(rows[0] ?? { data: null })
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error

  const body = await request.json()
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    return NextResponse.json({ error: 'Scheduler data must be an object.' }, { status: 400 })
  }

  const data = JSON.stringify(body.data)
  const rows = await sql`
    INSERT INTO public.employee_scheduler_state (id, data)
    VALUES (true, ${data}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    RETURNING data, updated_at
  `
  return NextResponse.json(rows[0])
}
