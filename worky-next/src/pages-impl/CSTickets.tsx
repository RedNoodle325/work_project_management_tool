'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { API } from '../api'
import type { ServiceTicket, Issue, Site, IssueLineLink, ServiceLine, PartOrdered } from '../types'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useToastFn } from '@/app/providers'

// ── Scope of work templates ────────────────────────────────────────────────────

const SCOPE_TEMPLATES: Record<string, string> = {
  warranty_repair: `SCOPE OF WORK: WARRANTY REPAIR\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\n1. Mobilize technician to site\n2. Diagnose reported issue(s)\n3. Perform warranty repair / replacement of defective component(s)\n4. Verify unit operation post-repair\n5. Complete service report and documentation\n\nParts Required:\n- [Part # / Description]\n\nEstimated Duration: [X] day(s)`,
  warranty_startup: `SCOPE OF WORK: WARRANTY - 90 DAY STARTUP\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\n1. Mobilize technician to site\n2. Perform 90-day startup inspection per Munters checklist\n3. Verify all mechanical and electrical connections\n4. Check refrigerant levels and system pressures\n5. Commission controls and verify setpoints\n6. Document all readings and observations\n7. Address any punch-list items\n\nEstimated Duration: [X] day(s)`,
  pm_service: `SCOPE OF WORK: PREVENTIVE MAINTENANCE\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\n1. Mobilize technician to site\n2. Perform PM inspection per Munters maintenance checklist\n3. Inspect and clean coils, filters, drain pans\n4. Check belts, bearings, and motor condition\n5. Verify refrigerant charge and system pressures\n6. Inspect electrical connections and controls\n7. Document all readings and recommendations\n\nEstimated Duration: [X] day(s)`,
  emergency_repair: `SCOPE OF WORK: EMERGENCY REPAIR\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\nPriority: URGENT\n\n1. Mobilize technician to site ASAP\n2. Diagnose failure / alarm condition\n3. Perform emergency repair to restore unit operation\n4. Verify unit is operating within spec\n5. Document root cause and corrective action\n6. Recommend follow-up actions if needed\n\nParts Required:\n- [Part # / Description]\n\nEstimated Duration: [X] day(s)`,
  parts_replacement: `SCOPE OF WORK: PARTS REPLACEMENT\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\n1. Mobilize technician to site\n2. Replace the following component(s):\n   - [Part # / Description]\n3. Verify proper installation and operation\n4. Run unit through full cycle and check performance\n5. Complete service report\n\nParts Required:\n- [Part # / Description / Qty]\n\nEstimated Duration: [X] day(s)`,
  troubleshoot: `SCOPE OF WORK: TROUBLESHOOT & DIAGNOSE\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\nReported Issue: [Description of problem]\n\n1. Mobilize technician to site\n2. Review unit history and reported symptoms\n3. Perform systematic troubleshooting\n4. Identify root cause of issue\n5. Provide repair recommendation and parts list\n6. Complete diagnostic report\n\nEstimated Duration: [X] day(s)`,
  commissioning: `SCOPE OF WORK: COMMISSIONING / STARTUP\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\n1. Mobilize technician to site\n2. Verify all mechanical and electrical installation per Munters specs\n3. Perform pre-startup checks (power, piping, controls)\n4. Energize unit and perform initial startup\n5. Commission controls — verify setpoints, alarms, and sequences\n6. Record all startup readings and parameters\n7. Train site personnel on basic operation\n8. Complete commissioning report and documentation\n\nEstimated Duration: [X] day(s)`,
  inspection: `SCOPE OF WORK: INSPECTION\n\nUnit(s): [Tag / Serial]\nSite: [Site Name]\n\n1. Mobilize technician to site\n2. Perform visual and operational inspection of unit(s)\n3. Document current condition, readings, and observations\n4. Identify any deficiencies or required repairs\n5. Provide written inspection report with photos\n6. Recommend corrective actions and timeline\n\nEstimated Duration: [X] day(s)`,
}

const STATUS_OPTS = [
  { val: 'open',        label: 'Open',       color: 'var(--blue)'   },
  { val: 'in_progress', label: 'In Progress', color: 'var(--yellow)' },
  { val: 'complete',    label: 'Complete',    color: 'var(--green)'  },
  { val: 'cancelled',   label: 'Cancelled',   color: 'var(--text3)'  },
]

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function lineStatusColor(s?: string) {
  if (!s) return 'var(--text3)'
  const l = s.toLowerCase()
  if (l.includes('invoiced') || l.includes('closed') || l.includes('complete')) return 'var(--green)'
  if (l.includes('assigned') || l.includes('entry') || l.includes('glovia')) return 'var(--yellow)'
  return 'var(--blue)'
}

function isLineClosed(s?: string) {
  if (!s) return false
  const l = s.toLowerCase()
  return l.includes('invoiced') || l.includes('closed') || l.includes('complete') || l.includes('released')
}

// ── Issue Picker Modal ─────────────────────────────────────────────────────────

interface IssuePickerProps {
  orderId: string
  ticketId: string
  issues: Issue[]
  alreadyLinked: Set<string>
  onLink: (issueId: string) => void
  onClose: () => void
}

function IssuePicker({ orderId, issues, alreadyLinked, onLink, onClose }: IssuePickerProps) {
  const [search, setSearch] = useState('')
  const available = issues.filter(i => !alreadyLinked.has(i.id))
  const filtered = available.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return (i.title || '').toLowerCase().includes(q)
      || (i.unit_tag || '').toLowerCase().includes(q)
      || (i.description || '').toLowerCase().includes(q)
  })

  return (
    <Modal title={`Link Issue to ${orderId}`} onClose={onClose} maxWidth={500}>
      <input
        autoFocus
        className="form-control"
        placeholder="Search issues…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div style={{ overflowY: 'auto', maxHeight: '50vh', minHeight: 100 }}>
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 20, fontSize: 12 }}>
            No available issues for this site
          </div>
        )}
        {filtered.slice(0, 50).map(i => {
          const sc = i.status === 'open' ? 'var(--blue)' : i.status === 'resolved' ? 'var(--green)' : 'var(--yellow)'
          return (
            <div
              key={i.id}
              onClick={() => onLink(i.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderBottom: '1px solid var(--border)', cursor: 'pointer', borderRadius: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)', minWidth: 80 }}>
                {i.unit_tag || '—'}
              </span>
              <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.title || '—'}
              </span>
              <span style={{ fontSize: 10, color: sc, border: `1px solid ${sc}44`, background: `${sc}22`, padding: '1px 6px', borderRadius: 99 }}>
                {i.status || 'open'}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Ticket Card ────────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: ServiceTicket
  site?: Site
  issues: Issue[]
  lineLinkMap: Record<string, Array<{ linkId: string; issue: Issue }>>
  onEdit: () => void
  onUnlink: (linkId: string, ticketId: string) => void
  onShowPicker: (ticketId: string, orderId: string) => void
}

function TicketCard({ ticket, site, issues: _issues, lineLinkMap, onEdit, onUnlink, onShowPicker }: TicketCardProps) {
  const [linesOpen, setLinesOpen] = useState(false)
  const [hideArchived, setHideArchived] = useState(false)

  const lines: ServiceLine[] = Array.isArray(ticket.service_lines) ? ticket.service_lines : []
  const closedLines = lines.filter(l => isLineClosed(l.status)).length

  const visibleLines = hideArchived ? lines.filter(l => !isLineClosed(l.status)) : lines

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10, background: 'var(--bg2)', overflow: 'hidden' }}>
      {/* Header row — clicking opens edit modal */}
      <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={onEdit}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{ticket.title}</span>
              <StatusBadge status={ticket.status} />
              {ticket.c2_number && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{ticket.c2_number}</span>
                </span>
              )}
              {lines.length > 1 && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {lines.length} lines{closedLines > 0 && (
                    <> · <span style={{ color: 'var(--green)' }}>{closedLines} done</span></>
                  )}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
              {site ? (
                <span>
                  📍{' '}
                  <Link href={`/sites/${site.id}`}
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--text2)' }}
                  >
                    {site.name}
                  </Link>
                </span>
              ) : ticket.site_company_id ? (
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{ticket.site_company_id}</span>
              ) : null}
              <span>{fmtDate(ticket.open_date || ticket.created_at)}</span>
              {ticket.ticket_type && <span style={{ color: 'var(--text3)' }}>{ticket.ticket_type}</span>}
            </div>
            {ticket.description && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, maxWidth: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ticket.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service lines section */}
      {lines.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
            <div
              onClick={() => setLinesOpen(o => !o)}
              style={{
                padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '.05em', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10, transition: 'transform .15s', transform: linesOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
              Service Lines ({lines.length})
            </div>
            {closedLines > 0 && (
              <label style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={hideArchived}
                  onChange={e => setHideArchived(e.target.checked)}
                  style={{ width: 12, height: 12 }}
                />
                Hide archived ({closedLines})
              </label>
            )}
          </div>

          {linesOpen && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Order ID', 'Parts', 'Scope / Activity', 'Serial', 'Status', 'Tech', 'Issues'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--text3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.map((l, i) => {
                    const sc = lineStatusColor(l.status)
                    const closed = isLineClosed(l.status)
                    const lineId = l.order_id || `Line ${l.line_no ?? i + 1}`
                    const partInfo = [l.part_number, l.description].filter(Boolean).join(' · ') || '—'
                    const scope = l.problem_desc || l.activity_group || '—'
                    const orderType = l.order_type || ''
                    const typeLabel = orderType === 'field_quote' ? 'Quote'
                      : orderType === 'helpdesk_order' ? 'Helpdesk'
                      : orderType === 'sale_quotation' ? 'Sale Quote' : ''
                    const linkedToLine = l.order_id ? (lineLinkMap[l.order_id] || []) : []

                    return (
                      <tr key={lineId} style={{ borderBottom: '1px solid var(--border)', opacity: closed ? 0.5 : 1 }}>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                          {lineId}
                          {typeLabel && <><br /><span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'inherit' }}>{typeLabel}</span></>}
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={partInfo}>
                          {partInfo}
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={scope}>
                          {scope}
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {l.serial_number || '—'}
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}44`, borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>
                            {l.status || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {l.technician || '—'}
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                            {linkedToLine.map(ll => (
                              <span
                                key={ll.linkId}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  background: 'var(--bg)', border: '1px solid var(--border)',
                                  borderRadius: 4, padding: '1px 6px', fontSize: 10, whiteSpace: 'nowrap',
                                }}
                                title={ll.issue.title || ''}
                              >
                                <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                                  {ll.issue.unit_tag || ll.issue.title?.slice(0, 20) || '—'}
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); onUnlink(ll.linkId, ticket.id) }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}
                                  title="Unlink"
                                >✕</button>
                              </span>
                            ))}
                            {l.order_id && (
                              <button
                                onClick={e => { e.stopPropagation(); onShowPicker(ticket.id, l.order_id!) }}
                                style={{
                                  background: 'none', border: '1px dashed var(--border)', borderRadius: 4,
                                  padding: '1px 6px', fontSize: 10, color: 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                                title="Link issue to this line"
                              >+ Issue</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ticket Modal ───────────────────────────────────────────────────────────────

interface TicketModalProps {
  ticket: ServiceTicket | null
  sites: Site[]
  issues: Issue[]
  onSave: (t: ServiceTicket) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function TicketModal({ ticket, sites, issues, onSave, onDelete, onClose }: TicketModalProps) {
  const toast = useToastFn()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(ticket?.title ?? '')
  const [description, setDescription] = useState(ticket?.description ?? '')
  const [siteId, setSiteId] = useState(ticket?.site_id ?? '')
  const [status, setStatus] = useState(ticket?.status ?? 'open')
  const [numberMode, setNumberMode] = useState<'auto' | 'manual'>('auto')
  const [asrNumber, setAsrNumber] = useState(ticket?.c2_number ?? '')
  const [scopeOfWork, setScopeOfWork] = useState(ticket?.scope_of_work ?? '')
  const [parts, setParts] = useState<PartOrdered[]>(
    Array.isArray(ticket?.parts_ordered) ? ticket!.parts_ordered : []
  )
  const [lines, setLines] = useState<Array<{ astea_id: string; description: string }>>(
    Array.isArray(ticket?.service_lines)
      ? ticket!.service_lines.map(l => ({ astea_id: l.astea_id ?? '', description: l.description ?? '' }))
      : []
  )

  const linkedIssues = ticket ? issues.filter(i => i.service_ticket_id === ticket.id) : []

  function addPart() { setParts(p => [...p, { description: '', qty: 1, so_number: '' }]) }
  function removePart(i: number) { setParts(p => p.filter((_, idx) => idx !== i)) }
  function updatePart(i: number, field: keyof PartOrdered, value: string | number) {
    setParts(p => p.map((part, idx) => idx === i ? { ...part, [field]: value } : part))
  }

  function addLine() { setLines(l => [...l, { astea_id: '', description: '' }]) }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: 'astea_id' | 'description', value: string) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line))
  }

  function applyScopeTemplate(key: string) {
    if (!key) return
    const tmpl = SCOPE_TEMPLATES[key]
    if (!tmpl) return
    setScopeOfWork(s => s.trim() ? s + '\n\n' + tmpl : tmpl)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast('Title is required', 'error')
    setSaving(true)
    const data: Partial<ServiceTicket> = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      c2_number: !ticket && numberMode === 'manual' ? asrNumber.trim() : undefined,
      scope_of_work: scopeOfWork.trim() || undefined,
      parts_ordered: parts.filter(p => p.description),
      service_lines: lines.filter(l => l.astea_id).map(l => ({ astea_id: l.astea_id, description: l.description || undefined })),
    }
    try {
      if (ticket) {
        const updated = await API.serviceTickets.update(ticket.id, data)
        onSave(updated)
        toast('ASR saved')
      } else {
        if (!siteId) { toast('Site is required', 'error'); setSaving(false); return }
      const created = await API.serviceTickets.create(siteId, { ...data, site_id: siteId })
        onSave(created)
        toast('ASR created')
      }
      onClose()
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!ticket) return
    if (!confirm('Delete this ASR?')) return
    try {
      await API.serviceTickets.delete(ticket.id)
      onDelete(ticket.id)
      toast('ASR deleted')
      onClose()
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    }
  }

  return (
    <Modal title={ticket ? 'Edit ASR' : 'New ASR'} onClose={onClose} maxWidth={700}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group full">
            <label>Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the work" />
          </div>
          <div className="form-group full">
            <label>Description</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {!ticket ? (
            <div className="form-group full">
              <label>Site *</label>
              <select required value={siteId} onChange={e => setSiteId(e.target.value)}>
                <option value="">— Select site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, gridColumn: '1 / -1' }}>
              Site: <strong style={{ color: 'var(--text2)' }}>{sites.find(s => s.id === ticket.site_id)?.name ?? '—'}</strong>
            </div>
          )}
          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>ASR Number</label>
            {ticket ? (
              <input value={ticket.c2_number || '—'} disabled style={{ fontFamily: 'monospace' }} />
            ) : (
              <>
                <select value={numberMode} onChange={e => setNumberMode(e.target.value as 'auto' | 'manual')}>
                  <option value="auto">Generate next available</option>
                  <option value="manual">Enter existing ASR</option>
                </select>
                {numberMode === 'manual' && (
                  <input
                    value={asrNumber}
                    onChange={e => setAsrNumber(e.target.value)}
                    placeholder={`ASR-${sites.find(s => s.id === siteId)?.project_number || 'PROJECT'}-0001`}
                    style={{ fontFamily: 'monospace', marginTop: 6 }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Service Lines */}
        <div style={{ margin: '8px 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>
              Service Lines <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(Astea Request IDs)</span>
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>+ Add</button>
          </div>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input
                placeholder="Astea Request ID"
                value={l.astea_id}
                onChange={e => updateLine(i, 'astea_id', e.target.value)}
                style={{ width: 170, fontFamily: 'monospace' }}
              />
              <input
                placeholder="Description / notes"
                value={l.description}
                onChange={e => updateLine(i, 'description', e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(i)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
          ))}
        </div>

        {/* Parts Ordered */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Parts Ordered</label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addPart}>+ Add</button>
          </div>
          {parts.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input
                placeholder="Part description"
                value={p.description ?? ''}
                onChange={e => updatePart(i, 'description', e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                placeholder="Qty"
                value={p.qty ?? 1}
                onChange={e => updatePart(i, 'qty', parseInt(e.target.value) || 1)}
                style={{ width: 60 }}
              />
              <input
                placeholder="SO#"
                value={p.so_number ?? ''}
                onChange={e => updatePart(i, 'so_number', e.target.value)}
                style={{ width: 120, fontFamily: 'monospace' }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => removePart(i)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
          ))}
        </div>

        {/* Scope of Work */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Scope of Work</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                value=""
                onChange={e => applyScopeTemplate(e.target.value)}
              >
                <option value="">— Insert template —</option>
                <option value="warranty_repair">Warranty Repair</option>
                <option value="warranty_startup">Warranty - 90 Day Startup</option>
                <option value="pm_service">PM Service Visit</option>
                <option value="emergency_repair">Emergency Repair</option>
                <option value="parts_replacement">Parts Replacement</option>
                <option value="troubleshoot">Troubleshoot &amp; Diagnose</option>
                <option value="commissioning">Commissioning / Startup</option>
                <option value="inspection">Inspection</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 8px', fontSize: 11 }}
                title="Copy to clipboard"
                onClick={() => {
                  if (!scopeOfWork.trim()) { toast('Nothing to copy', 'error'); return }
                  navigator.clipboard.writeText(scopeOfWork).then(() => toast('Scope copied to clipboard'))
                }}
              >📋 Copy</button>
            </div>
          </div>
          <textarea
            rows={5}
            value={scopeOfWork}
            onChange={e => setScopeOfWork(e.target.value)}
            placeholder="Describe the scope of work for this ticket…"
            style={{ width: '100%', fontSize: 12, lineHeight: 1.5, fontFamily: 'inherit', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }}
          />
        </div>

        {/* Linked Issues (read-only in modal) */}
        {linkedIssues.length > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
              Linked Issues ({linkedIssues.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {linkedIssues.map(i => (
                <span key={i.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                  <span style={{ fontFamily: 'monospace' }}>{i.unit_tag || '—'}</span>
                  <span style={{ color: 'var(--text3)', marginLeft: 4 }}>{i.title || ''}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          {ticket ? (
            <button type="button" className="btn btn-secondary" style={{ color: 'var(--red)' }} onClick={handleDelete}>Delete</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || (!ticket && numberMode === 'manual' && !asrNumber.trim())}>{ticket ? 'Save Changes' : 'Create ASR'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function CSTickets() {
  const toast = useToastFn()
  const xmlInputRef = useRef<HTMLInputElement>(null)

  const [tickets, setTickets] = useState<ServiceTicket[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [lineLinks, setLineLinks] = useState<IssueLineLink[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())

  const [editingTicket, setEditingTicket] = useState<ServiceTicket | null | undefined>(undefined) // undefined = closed
  const [pickerState, setPickerState] = useState<{ ticketId: string; orderId: string } | null>(null)

  useEffect(() => {
    Promise.all([
      API.serviceTickets.listAll(),
      API.issues.listAll().catch(() => []),
      API.sites.list(),
      API.issueLineLinks.listAll().catch(() => []),
    ]).then(([t, i, s, ll]) => {
      setTickets(t)
      setIssues(i)
      setSites(s)
      setLineLinks(ll)
    }).catch(err => toast('Failed to load tickets: ' + err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const siteMap = useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites])

  const lineLinkMap = useMemo(() => {
    const map: Record<string, Array<{ linkId: string; issue: Issue }>> = {}
    for (const link of lineLinks) {
      if (!map[link.order_id]) map[link.order_id] = []
      const issue = issues.find(i => i.id === link.issue_id)
      if (issue) map[link.order_id].push({ linkId: link.id, issue })
    }
    return map
  }, [lineLinks, issues])

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (filterSite && t.site_id !== filterSite) return false
      if (filterStatuses.size && !filterStatuses.has(t.status ?? 'open')) return false
      if (search) {
        const q = search.toLowerCase()
        const parts = Array.isArray(t.parts_ordered) ? t.parts_ordered : []
        const lines = Array.isArray(t.service_lines) ? t.service_lines : []
        const soNums = parts.map(p => p.so_number ?? '').join(' ')
        const asteas = lines.map(l => l.astea_id ?? '').join(' ')
        if (!(
          (t.title ?? '').toLowerCase().includes(q) ||
          (t.c2_number ?? '').toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          soNums.toLowerCase().includes(q) ||
          asteas.toLowerCase().includes(q)
        )) return false
      }
      return true
    })
  }, [tickets, filterSite, filterStatuses, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    STATUS_OPTS.forEach(s => { c[s.val] = tickets.filter(t => t.status === s.val).length })
    return c
  }, [tickets])

  function toggleStatus(val: string) {
    setFilterStatuses(prev => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  async function handleUnlink(linkId: string, ticketId: string) {
    try {
      await API.issueLineLinks.delete(ticketId, linkId)
      setLineLinks(ll => ll.filter(l => l.id !== linkId))
      toast('Issue unlinked')
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    }
  }

  async function handleLink(issueId: string) {
    if (!pickerState) return
    try {
      const link = await API.issueLineLinks.create(pickerState.ticketId, { issue_id: issueId, order_id: pickerState.orderId })
      setLineLinks(ll => [...ll, link])
      setPickerState(null)
      toast('Issue linked')
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    }
  }

  async function handleXmlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await API.serviceTickets.importXml(file)
      toast(`Imported: ${result.created} created, ${result.updated} updated`)
      const updated = await API.serviceTickets.listAll()
      setTickets(updated)
    } catch (err: unknown) {
      toast('Import error: ' + (err as Error).message, 'error')
    } finally {
      if (xmlInputRef.current) xmlInputRef.current.value = ''
    }
  }

  const pickerTicket = pickerState ? tickets.find(t => t.id === pickerState.ticketId) : undefined
  const pickerIssues = pickerTicket?.site_id
    ? issues.filter(i => i.site_id === pickerTicket.site_id)
    : issues
  const pickerAlreadyLinked = new Set(
    pickerState ? (lineLinkMap[pickerState.orderId] || []).map(ll => ll.issue.id) : []
  )

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40, textAlign: 'center' }}>Loading…</div>

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>ASRs</h1>
          <div className="page-subtitle">{counts['open'] ?? 0} open tickets</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }} title="Import ASRs from Astea XML export">
            ↑ Import XML
            <input ref={xmlInputRef} type="file" accept=".xml,text/xml" style={{ display: 'none' }} onChange={handleXmlImport} />
          </label>
          <button className="btn btn-primary" onClick={() => setEditingTicket(null)}>+ New ASR</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search title, C2#, SO#, Astea ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Status:</span>
            {STATUS_OPTS.map(s => {
              const active = filterStatuses.has(s.val)
              return (
                <button
                  key={s.val}
                  onClick={() => toggleStatus(s.val)}
                  style={{
                    padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${s.color}`, background: active ? s.color : 'transparent',
                    color: active ? '#fff' : s.color, transition: 'all .15s', whiteSpace: 'nowrap',
                  }}
                >
                  {s.label} <span style={{ opacity: .7 }}>{counts[s.val] ?? 0}</span>
                </button>
              )
            })}
            {filterStatuses.size > 0 && (
              <button
                onClick={() => setFilterStatuses(new Set())}
                style={{ padding: '3px 8px', borderRadius: 99, fontSize: 11, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}
              >✕ Clear</button>
            )}
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 'auto' }}>{filtered.length} shown</span>
        </div>
      </div>

      {/* Ticket list */}
      <div>
        {filtered.length === 0 ? (
          <div className="card" style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>No ASRs match your filters</div>
        ) : (
          filtered.map(t => (
            <TicketCard
              key={t.id}
              ticket={t}
              site={t.site_id ? siteMap[t.site_id] : undefined}
              issues={issues}
              lineLinkMap={lineLinkMap}
              onEdit={() => setEditingTicket(t)}
              onUnlink={handleUnlink}
              onShowPicker={(ticketId, orderId) => setPickerState({ ticketId, orderId })}
            />
          ))
        )}
      </div>

      {/* Create/edit modal */}
      {editingTicket !== undefined && (
        <TicketModal
          ticket={editingTicket}
          sites={sites}
          issues={issues}
          onSave={updated => {
            setTickets(prev => {
              const idx = prev.findIndex(t => t.id === updated.id)
              return idx >= 0 ? prev.map((t, i) => i === idx ? updated : t) : [updated, ...prev]
            })
          }}
          onDelete={id => setTickets(prev => prev.filter(t => t.id !== id))}
          onClose={() => setEditingTicket(undefined)}
        />
      )}

      {/* Issue picker */}
      {pickerState && (
        <IssuePicker
          orderId={pickerState.orderId}
          ticketId={pickerState.ticketId}
          issues={pickerIssues}
          alreadyLinked={pickerAlreadyLinked}
          onLink={handleLink}
          onClose={() => setPickerState(null)}
        />
      )}
    </div>
  )
}
