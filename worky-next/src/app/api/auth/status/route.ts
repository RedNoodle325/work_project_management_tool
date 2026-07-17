import { NextResponse } from 'next/server'
import sql from '@/lib/db'

// This reveals only whether the one-time owner setup is still available.
// It is deliberately public so a fresh installation can show the correct form.
export async function GET() {
  const [{ count }] = await sql`SELECT COUNT(*) FROM public.users`
  return NextResponse.json({ setup_required: Number(count) === 0 })
}
