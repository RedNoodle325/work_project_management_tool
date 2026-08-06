import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

let schedulerTableReady: Promise<unknown> | null = null

function ensureSchedulerTable() {
  schedulerTableReady ??= sql`
    CREATE TABLE IF NOT EXISTS public.employee_scheduler_state (
      id boolean PRIMARY KEY DEFAULT true CHECK (id),
      data jsonb NOT NULL DEFAULT '{"sites":[],"employees":[],"assignments":{}}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.catch(error => {
    schedulerTableReady = null
    throw error
  })
  return schedulerTableReady
}

export async function GET(request: NextRequest) {
  const { error, claims } = await requireAuth(request, { allowScheduler: true })
  if (error) return error

  await ensureSchedulerTable()
  const rows = await sql`SELECT data, updated_at FROM public.employee_scheduler_state WHERE id = true`
  return NextResponse.json({
    ...(rows[0] ?? { data: null }),
    can_edit: claims.role === 'owner' || claims.role === 'admin' || claims.role === 'scheduler',
    is_owner: claims.role === 'owner',
  })
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAuth(request, { allowScheduler: true })
  if (error) return error

  const body = await request.json()
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    return NextResponse.json({ error: 'Scheduler data must be an object.' }, { status: 400 })
  }

  const data = JSON.stringify(body.data)
  await ensureSchedulerTable()
  const rows = await sql`
    INSERT INTO public.employee_scheduler_state (id, data)
    VALUES (true, ${data}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    RETURNING data, updated_at
  `
  return NextResponse.json(rows[0])
}
