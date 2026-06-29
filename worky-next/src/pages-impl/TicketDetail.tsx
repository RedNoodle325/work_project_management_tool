'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { API } from '../api'
import { useToastFn } from '@/app/providers'
import { StatusBadge } from '../components/StatusBadge'
import type { Site, Ticket, Unit } from '../types'

interface PartItem {
  part_no: string
  description: string
  qty: number
}

const TICKET_TYPE_LABELS: Record<string, string> = {
  cs_ticket:    'ASR',
  parts_order:  'Parts Order',
  service_line: 'Service Line',
}

const TICKET_STATUS_OPTIONS = [
  'open', 'parts_ordered', 'tech_dispatched', 'on_site', 'resolved', 'closed',
]

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low']

export function TicketDetail() {
  const toast = useToastFn()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'

  const [ticket, setTicket] = useState<Partial<Ticket>>({
    status: 'open',
    ticket_type: 'cs_ticket',
  })
  const [sites, setSites] = useState<Site[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partsItems, setPartsItems] = useState<PartItem[]>([{ part_no: '', description: '', qty: 1 }])

  useEffect(() => {
    Promise.all([
      API.sites.list(),
      API.units.list(),
      isNew ? Promise.resolve(null) : API.tickets.get(id!),
    ]).then(([s, u, t]) => {
      setSites(s)
      setUnits(u)
      if (t) {
        setTicket(t)
        // Parse parts items if present
        const raw = (t as Ticket & { parts_items?: unknown }).parts_items
        if (raw) {
          try {
            const parsed = Array.isArray(raw) ? raw : JSON.parse(raw as string)
            if (parsed.length > 0) setPartsItems(parsed)
          } catch { /* ignore */ }
        }
      }
    }).catch(e => {
      toast('Error loading ticket: ' + (e as Error).message, 'error')
    }).finally(() => setLoading(false))
  }, [id])

  function siteUnits(siteId?: string) {
    return siteId ? units.filter(u => u.site_id === siteId) : []
  }

  async function handleStatusClick(status: string) {
    if (isNew) return
    try {
      await API.tickets.update(id!, { status })
      setTicket(t => ({ ...t, status }))
      toast('Status: ' + status.replace(/_/g, ' '))
    } catch (e) {
      toast('Error: ' + (e as Error).message, 'error')
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: Partial<Ticket & { parts_items?: PartItem[] }> = {
      title:       fd.get('title') as string || undefined,
      description: fd.get('description') as string || undefined,
      site_id:     fd.get('site_id') as string || undefined,
      unit_id:     fd.get('unit_id') as string || undefined,
      ticket_type: fd.get('ticket_type') as string,
      status:      fd.get('status') as string || ticket.status || 'open',
      priority:    fd.get('priority') as string || undefined,
      unit_tag:    fd.get('unit_tag') as string || undefined,
      resolution:  fd.get('resolution') as string || undefined,
    }

    // Collect parts for parts_order type
    if (data.ticket_type === 'parts_order') {
      data.parts_items = partsItems.filter(p => p.part_no || p.description)
    }

    // Clean empty strings
    for (const k of Object.keys(data) as Array<keyof typeof data>) {
      if (data[k] === '') (data as Record<string, unknown>)[k] = undefined
    }

    setSaving(true)
    try {
      if (isNew) {
        await API.tickets.create(data as Partial<Ticket>)
        toast('Ticket created')
        router.push('/tickets')
      } else {
        await API.tickets.update(id!, data as Partial<Ticket>)
        toast('Ticket updated')
        router.push('/tickets')
      }
    } catch (err) {
      toast('Error: ' + (err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this ticket? This cannot be undone.')) return
    try {
      await API.tickets.delete(id!)
      toast('Ticket deleted')
      router.push('/tickets')
    } catch (e) {
      toast('Error: ' + (e as Error).message, 'error')
    }
  }

  function addPart() {
    setPartsItems(p => [...p, { part_no: '', description: '', qty: 1 }])
  }

  function removePart(i: number) {
    setPartsItems(p => p.filter((_, idx) => idx !== i))
  }

  function updatePart(i: number, field: keyof PartItem, value: string | number) {
    setPartsItems(p => p.map((part, idx) =>
      idx === i ? { ...part, [field]: value } : part
    ))
  }

  const currentType = ticket.ticket_type || 'cs_ticket'
  const currentSiteId = ticket.site_id || ''

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading…</div>
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/tickets')}>
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0 }}>
              {isNew ? 'New Ticket' : (ticket.title || 'Ticket')}
            </h1>
            {!isNew && ticket.status && (
              <div className="page-subtitle">
                <StatusBadge status={ticket.status} size="sm" />
              </div>
            )}
          </div>
        </div>
        {!isNew && (
          <button
            className="btn btn-sm"
            style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44' }}
            onClick={handleDelete}
          >
            Delete
          </button>
        )}
      </div>

      {/* Status switcher for existing tickets */}
      {!isNew && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Status</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TICKET_STATUS_OPTIONS.map(s => (
              <button
                key={s}
                className={`btn btn-sm ${ticket.status === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleStatusClick(s)}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} style={{ maxWidth: 900 }}>
        {/* Core fields */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Ticket Details</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Ticket Type</label>
              <select
                name="ticket_type"
                defaultValue={currentType}
                onChange={e => setTicket(t => ({ ...t, ticket_type: e.target.value, unit_id: undefined }))}
              >
                {Object.entries(TICKET_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Site</label>
              <select
                name="site_id"
                defaultValue={currentSiteId}
                onChange={e => setTicket(t => ({ ...t, site_id: e.target.value, unit_id: undefined }))}
              >
                <option value="">— Select Site —</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Title / Summary</label>
              <input
                name="title"
                defaultValue={ticket.title || ''}
                placeholder="Brief summary"
              />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select name="priority" defaultValue={ticket.priority || ''}>
                <option value="">— None —</option>
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            {!isNew && (
              <div className="form-group">
                <label>Status</label>
                <select name="status" defaultValue={ticket.status || 'open'}>
                  {TICKET_STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Type-specific fields */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            {TICKET_TYPE_LABELS[currentType] || currentType}
          </div>
          <div className="form-grid">
            {currentType === 'cs_ticket' && (
              <>
                <div className="form-group">
                  <label>Unit (optional)</label>
                  <select name="unit_id" defaultValue={ticket.unit_id || ''}>
                    <option value="">— No specific unit —</option>
                    {siteUnits(currentSiteId).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.tag || u.serial_number || u.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group full">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    rows={5}
                    required
                    defaultValue={ticket.description || ''}
                  />
                </div>
              </>
            )}

            {currentType === 'parts_order' && (
              <>
                <div className="form-group">
                  <label>Unit Tag</label>
                  <input
                    name="unit_tag"
                    placeholder="e.g. AHU-01"
                    defaultValue={ticket.unit_tag || ''}
                  />
                </div>
                <div className="form-group full">
                  <label>Parts List</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {partsItems.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 2fr 70px 32px',
                          gap: 6, alignItems: 'center',
                        }}
                      >
                        <input
                          placeholder="Part #"
                          value={p.part_no}
                          onChange={e => updatePart(i, 'part_no', e.target.value)}
                        />
                        <input
                          placeholder="Description"
                          value={p.description}
                          onChange={e => updatePart(i, 'description', e.target.value)}
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={p.qty}
                          onChange={e => updatePart(i, 'qty', parseInt(e.target.value) || 1)}
                          style={{ textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          onClick={() => removePart(i)}
                          style={{
                            background: 'var(--red)22', color: 'var(--red)',
                            border: 'none', borderRadius: 4, cursor: 'pointer',
                            padding: '4px 6px', fontSize: 13,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addPart}
                  >
                    + Add Part
                  </button>
                </div>
              </>
            )}

            {currentType === 'service_line' && (
              <>
                <div className="form-group full">
                  <label>Scope of Work *</label>
                  <textarea
                    name="description"
                    rows={4}
                    required
                    defaultValue={ticket.description || ''}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Resolution notes (edit mode only) */}
        {!isNew && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Resolution Notes</div>
            <textarea
              name="resolution"
              rows={3}
              style={{ width: '100%' }}
              defaultValue={ticket.resolution || ''}
            />
          </div>
        )}

        <div className="form-actions" style={{ paddingBottom: 32 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/tickets')}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Open Ticket' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
