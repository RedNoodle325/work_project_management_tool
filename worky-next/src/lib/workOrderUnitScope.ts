import sql from './db'

export type UnitScopeMode = 'site_wide' | 'selected_units' | 'all_units' | 'all_fans'

export async function resolveWorkOrderUnitIds(
  trx: typeof sql,
  siteId: string,
  mode: UnitScopeMode,
  requestedIds: unknown,
) {
  if (mode === 'site_wide') return []
  if (mode === 'all_units') {
    const rows = await trx`select id from public.units where site_id = ${siteId}`
    return rows.map(row => String(row.id))
  }
  if (mode === 'all_fans') {
    const rows = await trx`
      select id from public.units where site_id = ${siteId}
      and (lower(coalesce(unit_type, '')) like '%fan%' or lower(tag) like '%fan%')
    `
    return rows.map(row => String(row.id))
  }
  const ids = Array.isArray(requestedIds) ? requestedIds.map(String) : []
  if (!ids.length) return []
  const rows = await trx`select id from public.units where site_id = ${siteId} and id = any(${trx.array(ids)}::uuid[])`
  return rows.map(row => String(row.id))
}
