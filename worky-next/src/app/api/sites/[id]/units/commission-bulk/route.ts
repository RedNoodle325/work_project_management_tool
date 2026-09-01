import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { ensureOpsSchema } from '@/lib/ensureOpsSchema'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 })

  const { id } = await params
  await ensureOpsSchema()
  const body = await req.json()
  const updates: Array<{
    unit_id: string; build_stage: string; ship_to?: string | null
    warranty_start_date?: string | null; warranty_end_date?: string | null; commissioning_status?: string
  }> = body.updates ?? []

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  let updated = 0

  for (const { unit_id, build_stage, ship_to, warranty_start_date, warranty_end_date, commissioning_status } of updates) {
    if (!unit_id || !build_stage) continue
    await sql`
      UPDATE public.units
      SET build_stage = ${build_stage},
          ship_to = ${ship_to ?? null},
          warranty_start_date = ${warranty_start_date ?? null},
          warranty_end_date = ${warranty_end_date ?? null},
          commissioning_status = COALESCE(${commissioning_status ?? null}, commissioning_status),
          updated_at = now()
      WHERE id = ${unit_id} AND site_id = ${id}
    `
    updated++
  }

  return NextResponse.json({ updated })
}
