'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Package, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { V2 } from '@/api/v2'
import { Ops } from '@/api/ops'
import type { PartsOrder, PartsOrderStatus } from '@/types/ops'
import type { SiteSummaryV2 } from '@/types/v2'

const STATUSES: PartsOrderStatus[] = ['needed', 'ordered', 'shipped', 'received', 'installed', 'cancelled']
const STATUS_LABELS: Record<PartsOrderStatus, string> = { needed: 'Needed', ordered: 'Ordered', shipped: 'Shipped', received: 'Received', installed: 'Installed', cancelled: 'Cancelled' }

export function PartsOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<PartsOrder[]>([])
  const [sites, setSites] = useState<SiteSummaryV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({ siteId: '', status: '' })
  const [editOrder, setEditOrder] = useState<PartsOrder | 'new' | null>(null)

  function load() {
    Promise.all([Ops.partsOrders.list(), V2.hierarchy.list()])
      .then(([orderRows, hierarchy]) => {
        setOrders(orderRows)
        const byId = new Map<string, SiteSummaryV2>()
        hierarchy.forEach(customer => {
          customer.sites?.forEach(site => byId.set(site.id, site))
          customer.locations?.forEach(location => location.sites?.forEach(site => byId.set(site.id, site)))
        })
        setSites(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setError('')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => orders.filter(o =>
    (!filter.siteId || o.site_id === filter.siteId) && (!filter.status || o.status === filter.status)
  ), [orders, filter])

  const openCount = orders.filter(o => o.status !== 'installed' && o.status !== 'cancelled').length

  return <div className="x-page x-issues-page">
    <header className="x-directory-head">
      <div><span className="x-kicker">Supply chain</span><h1>Part orders</h1><p>Track every part from &quot;needed&quot; through installed, across all sites.</p></div>
      {user && <div className="x-issue-actions"><button className="primary" onClick={() => setEditOrder('new')}><Plus size={16} /> New part order</button></div>}
    </header>

    <div className="x-stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <div className="x-stat"><span><Package size={18} /></span><div><strong>{orders.length}</strong><small>Total part orders</small></div></div>
      <div className="x-stat is-warn"><span><Package size={18} /></span><div><strong>{openCount}</strong><small>Still open</small></div></div>
      <div className="x-stat is-live"><span><Package size={18} /></span><div><strong>{orders.filter(o => o.status === 'installed').length}</strong><small>Installed</small></div></div>
    </div>

    <div className="x-issue-toolbar">
      <select value={filter.siteId} onChange={e => setFilter(f => ({ ...f, siteId: e.target.value }))}><option value="">All sites</option>{sites.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select>
      <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}><option value="">All statuses</option>{STATUSES.map(s => <option value={s} key={s}>{STATUS_LABELS[s]}</option>)}</select>
      <span>{filtered.length} part orders</span>
    </div>

    {error && <div className="x-load-panel"><strong>Couldn&apos;t load part orders</strong><p>{error}</p></div>}
    {!error && loading && <div className="x-state"><h1>Loading part orders</h1><p>Gathering the latest orders…</p></div>}
    {!error && !loading && <div className="x-lean-issues x-parts-orders">
      <div className="x-parts-order-head"><span>Part</span><span>Site</span><span>Qty</span><span>Supplier / Order #</span><span>Status</span><span /></div>
      {filtered.map(order => <div className="x-parts-order-row" key={order.id}>
        <span><strong>{order.description}</strong><small>{order.part_number || 'No part #'}{order.job_name ? ` · ${order.job_name}` : ''}</small></span>
        <span>{order.site_name}</span>
        <span>{order.quantity}</span>
        <span>{order.supplier || '—'}<small>{order.order_number || 'No order #'}</small></span>
        <span><em className={`x-wo-status is-${order.status}`}>{STATUS_LABELS[order.status]}</em></span>
        <span>{user && <button className="x-issue-icon-action" onClick={() => setEditOrder(order)} title="Edit"><Pencil size={14} /></button>}</span>
      </div>)}
      {!filtered.length && <div className="x-resource-empty"><Package size={30} /><strong>No part orders found</strong><p>Add a part order to start tracking it.</p>{user && <button onClick={() => setEditOrder('new')}><Plus size={15} /> New part order</button>}</div>}
    </div>}

    {editOrder && <PartsOrderModal order={editOrder === 'new' ? null : editOrder} sites={sites} close={() => setEditOrder(null)} saved={() => { setEditOrder(null); load() }} />}
  </div>
}

function PartsOrderModal({ order, sites, close, saved }: { order: PartsOrder | null; sites: SiteSummaryV2[]; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({
    site_id: order?.site_id || '', part_number: order?.part_number || '', description: order?.description || '',
    quantity: order ? String(order.quantity) : '1', status: order?.status || 'needed', supplier: order?.supplier || '',
    order_number: order?.order_number || '', requested_by: order?.requested_by || '',
    ordered_at: order?.ordered_at?.slice(0, 10) || '', expected_at: order?.expected_at?.slice(0, 10) || '', received_at: order?.received_at?.slice(0, 10) || '',
    notes: order?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [field]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (order) await Ops.partsOrders.update(order.id, form)
      else await Ops.partsOrders.create(form)
      saved()
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  async function remove() {
    if (!order || !confirm('Delete this part order?')) return
    setSaving(true)
    try { await Ops.partsOrders.delete(order.id); saved() }
    catch (err) { setError((err as Error).message); setSaving(false) }
  }

  return <div className="x-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <form className="x-modal" onSubmit={submit}>
      <header><div><span className="x-kicker">Part order</span><h2>{order ? 'Edit part order' : 'New part order'}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
      <label className="x-field"><span>Site</span><select value={form.site_id} onChange={e => set('site_id')(e.target.value)} required><option value="">Choose a site</option>{sites.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
      <label className="x-field"><span>Description</span><textarea rows={2} value={form.description} onChange={e => set('description')(e.target.value)} required placeholder="What's being ordered" /></label>
      <div className="x-form-row"><label className="x-field"><span>Part #</span><input value={form.part_number} onChange={e => set('part_number')(e.target.value)} /></label><label className="x-field"><span>Qty</span><input type="number" min={0.01} step="any" value={form.quantity} onChange={e => set('quantity')(e.target.value)} /></label></div>
      <div className="x-form-row"><label className="x-field"><span>Supplier</span><input value={form.supplier} onChange={e => set('supplier')(e.target.value)} /></label><label className="x-field"><span>Order #</span><input value={form.order_number} onChange={e => set('order_number')(e.target.value)} /></label></div>
      <label className="x-field"><span>Status</span><select value={form.status} onChange={e => set('status')(e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
      <div className="x-form-row"><label className="x-field"><span>Ordered</span><input type="date" value={form.ordered_at} onChange={e => set('ordered_at')(e.target.value)} /></label><label className="x-field"><span>Expected</span><input type="date" value={form.expected_at} onChange={e => set('expected_at')(e.target.value)} /></label></div>
      <div className="x-form-row"><label className="x-field"><span>Received</span><input type="date" value={form.received_at} onChange={e => set('received_at')(e.target.value)} /></label><label className="x-field"><span>Requested by</span><input value={form.requested_by} onChange={e => set('requested_by')(e.target.value)} /></label></div>
      <label className="x-field"><span>Notes</span><textarea rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>
      {error && <p className="x-error">{error}</p>}
      <footer>
        {order && <button type="button" onClick={remove} className="x-danger-text"><Trash2 size={13} /> Delete</button>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={close}>Cancel</button>
        <button className="primary" disabled={saving}>{saving ? 'Saving…' : order ? 'Save changes' : 'Create part order'}</button>
      </footer>
    </form>
  </div>
}
