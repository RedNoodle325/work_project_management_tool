'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { API } from '../api'
import type { Issue, Site, ServiceTicket } from '../types'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useToastFn } from '@/app/providers'

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { val: 'open',            label: 'Open',            color: 'var(--red)'    },
  { val: 'techs_scheduled', label: 'Techs Scheduled', color: 'var(--accent)' },
  { val: 'parts_on_order',  label: 'Parts on Order',  color: 'var(--orange)' },
  { val: 'in_progress',     label: 'In Progress',     color: 'var(--yellow)' },
  { val: 'complete',        label: 'Complete',         color: 'var(--green)'  },
]

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--orange)', low: 'var(--text2)',
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical', high: 'High', low: 'Low',
}

const ISSUE_TYPES = [
  'Incorrect Installation', 'Damage after Install', 'Missing Components',
  'Material/Component Failure', 'Shipping Damage',
  'Documentation Not Complete or Ready', 'Design Defect/Lack of Design', 'Other',
]

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Issue Modal (create + edit) ────────────────────────────────────────────────

interface IssueModalProps {
  issue: Issue | null
  sites: Site[]
  asrs: ServiceTicket[]
  onSave: (i: Issue) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

function IssueModal({ issue, sites, asrs, onSave, onDelete, onClose }: IssueModalProps) {
  const toast = useToastFn()
  const [saving, setSaving] = useState(false)
  const [siteId, setSiteId] = useState(issue?.site_id ?? '')
  const [title, setTitle] = useState(issue?.title ?? '')
  const [description, setDescription] = useState(issue?.description ?? '')
  const [unitTag, setUnitTag] = useState(issue?.unit_tag ?? '')
  const [cxZone, setCxZone] = useState(issue?.cx_zone ?? '')
  const [priority, setPriority] = useState(issue?.priority ?? 'low')
  const [status, setStatus] = useState(issue?.status ?? 'open')
  const [cxIssueType, setCxIssueType] = useState(issue?.cx_issue_type ?? '')
  const [cxalloyUrl, setCxalloyUrl] = useState(issue?.cxalloy_url ?? '')
  const [resolutionNotes, setResolutionNotes] = useState(issue?.resolution_notes ?? '')
  const [asrId, setAsrId] = useState(issue?.service_ticket_id ?? '')
  const issueSiteId = issue?.site_id ?? siteId
  const availableAsrs = asrs.filter(asr => asr.site_id === issueSiteId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast('Title is required', 'error')
    if (!issue && !siteId) return toast('Site is required', 'error')
    if (!asrId) return toast('ASR is required', 'error')
    setSaving(true)
    const data: Partial<Issue> = {
      title: title.trim(),
      description: description.trim() || undefined,
      unit_tag: unitTag.trim() || undefined,
      cx_zone: cxZone.trim() || undefined,
      priority: priority || undefined,
      status,
      cx_issue_type: cxIssueType || undefined,
      cxalloy_url: cxalloyUrl.trim() || undefined,
      resolution_notes: resolutionNotes.trim() || undefined,
      service_ticket_id: asrId,
    }
    try {
      if (issue) {
        const updated = await API.issues.update(issue.id, data)
        onSave(updated)
        toast('Issue saved')
      } else {
        const created = await API.issues.create(siteId, { ...data, site_id: siteId })
        onSave(created)
        toast('Issue created')
      }
      onClose()
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!issue || !onDelete) return
    if (!confirm('Delete this issue?')) return
    try {
      await API.issues.delete(issue.id)
      onDelete(issue.id)
      toast('Issue deleted')
      onClose()
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    }
  }

  return (
    <Modal title={issue ? 'Edit Issue' : 'New Issue'} onClose={onClose} maxWidth={560}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {!issue && (
            <div className="form-group full">
              <label>Site *</label>
              <select required value={siteId} onChange={e => setSiteId(e.target.value)}>
                <option value="">— Select Site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group full">
            <label>ASR *</label>
            <select required value={asrId} onChange={e => setAsrId(e.target.value)} disabled={!issueSiteId}>
              <option value="">— Select ASR —</option>
              {availableAsrs.map(asr => (
                <option key={asr.id} value={asr.id}>
                  {asr.c2_number || asr.title}{asr.c2_number && asr.title ? ` — ${asr.title}` : ''}
                </option>
              ))}
            </select>
            {issueSiteId && availableAsrs.length === 0 && (
              <div style={{ color: 'var(--yellow)', fontSize: 11, marginTop: 4 }}>This site has no ASRs yet.</div>
            )}
          </div>
          <div className="form-group full">
            <label>Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the issue" />
          </div>
          <div className="form-group full">
            <label>Description</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Details…" />
          </div>
          <div className="form-group">
            <label>Equipment Tag</label>
            <input value={unitTag} onChange={e => setUnitTag(e.target.value)} placeholder="e.g. CRAC-DH1300-18" />
          </div>
          <div className="form-group">
            <label>Zone</label>
            <input value={cxZone} onChange={e => setCxZone(e.target.value)} placeholder="e.g. Data Hall 1300" />
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {issue && (
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="open">Open</option>
                <option value="techs_scheduled">Techs Scheduled</option>
                <option value="parts_on_order">Parts on Order</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          )}
          <div className="form-group full">
            <label>Issue Type</label>
            <select value={cxIssueType} onChange={e => setCxIssueType(e.target.value)}>
              <option value="">— None —</option>
              {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {(issue?.cxalloy_issue_id || cxalloyUrl) && (
            <div className="form-group full">
              <label>CxAlloy Issue URL</label>
              <input
                type="url"
                value={cxalloyUrl}
                onChange={e => setCxalloyUrl(e.target.value)}
                placeholder="https://app.cxalloy.com/…"
              />
            </div>
          )}
          <div className="form-group full">
            <label>Comments / Resolution</label>
            <textarea rows={2} value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Notes on resolution…" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
          {issue && onDelete ? (
            <button type="button" className="btn btn-secondary" style={{ color: 'var(--red)' }} onClick={handleDelete}>Delete</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{issue ? 'Save' : 'Create Issue'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── CxAlloy CSV Import Modal ───────────────────────────────────────────────────

// Flexible column name matching for CxAlloy CSV exports
function pickCol(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(h => h.toLowerCase().trim() === k.toLowerCase())
    if (found && row[found]?.trim()) return row[found].trim()
  }
  return ''
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []
  // Simple CSV parser — handles quoted fields
  function splitLine(line: string): string[] {
    const cols: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { cols.push(cur); cur = '' }
      else cur += c
    }
    cols.push(cur)
    return cols
  }
  const headers = splitLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = splitLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] ?? '').trim().replace(/^"|"$/g, '')]))
  })
}

interface CxImportModalProps {
  sites: Site[]
  asrs: ServiceTicket[]
  onImported: () => void
  onClose: () => void
}

function CxImportModal({ sites, asrs, onImported, onClose }: CxImportModalProps) {
  const toast = useToastFn()
  const [siteId, setSiteId] = useState('')
  const [asrId, setAsrId] = useState('')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [filename, setFilename] = useState('')
  const [importing, setImporting] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string)
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!siteId) return toast('Select a site first', 'error')
    if (!asrId) return toast('Select an ASR first', 'error')
    if (!rows.length) return toast('No rows parsed from CSV', 'error')
    setImporting(true)
    const issues = rows.map(r => ({
      cxalloy_issue_id: pickCol(r, 'issue id', 'punch id', 'id', 'issue_id', 'punchid', 'item id'),
      title:            pickCol(r, 'title', 'issue title', 'punch title', 'name', 'summary', 'subject'),
      description:      pickCol(r, 'description', 'details', 'notes', 'comment', 'comments'),
      unit_tag:         pickCol(r, 'equipment tag', 'tag', 'unit tag', 'equipment', 'asset tag', 'unit_tag'),
      priority:         pickCol(r, 'priority'),
      status:           pickCol(r, 'status'),
      reported_by:      pickCol(r, 'reported by', 'created by', 'author', 'submitter'),
      resolution_notes: pickCol(r, 'resolution notes', 'resolution', 'resolution comments'),
      closed_date:      pickCol(r, 'closed date', 'close date', 'resolved date', 'date closed'),
      reported_date:    pickCol(r, 'reported date', 'created date', 'date created', 'date reported', 'open date', 'date'),
      cx_zone:          pickCol(r, 'zone', 'area', 'location'),
      cx_issue_type:    pickCol(r, 'issue type', 'type', 'category'),
      cx_source:        pickCol(r, 'source'),
      cxalloy_url:      pickCol(r, 'url', 'link', 'issue url', 'issue link', 'href'),
      service_ticket_id: asrId,
    })).filter(i => i.cxalloy_issue_id || i.title)

    if (!issues.length) return (setImporting(false), toast('No valid issues found — check CSV column names', 'error'))
    try {
      const result = await API.issues.importCxAlloy(siteId, issues)
      toast(`Imported ${result.imported}, skipped ${result.skipped} (already exist)`)
      onImported()
      onClose()
    } catch (err: unknown) {
      toast('Import failed: ' + (err as Error).message, 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="Import from CxAlloy" onClose={onClose} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label>Site *</label>
          <select value={siteId} onChange={e => { setSiteId(e.target.value); setAsrId('') }}>
            <option value="">— Select Site —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>ASR *</label>
          <select value={asrId} onChange={e => setAsrId(e.target.value)} disabled={!siteId}>
            <option value="">— Select ASR —</option>
            {asrs.filter(asr => asr.site_id === siteId).map(asr => (
              <option key={asr.id} value={asr.id}>{asr.c2_number || asr.title}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>CxAlloy Issues CSV</label>
          <input type="file" accept=".csv,.txt" onChange={handleFile} />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Export from CxAlloy → Issues list → Export CSV. Columns auto-detected.
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{
            background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px',
            border: '1px solid var(--border)', fontSize: 12,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {filename} — <span style={{ color: 'var(--green)' }}>{rows.length} rows</span>
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 11 }}>
              Columns: {Object.keys(rows[0]).join(', ')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={importing || !rows.length || !siteId}
            onClick={handleImport}
          >
            {importing ? 'Importing…' : `Import ${rows.length > 0 ? rows.length + ' rows' : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function Issues() {
  const toast = useToastFn()

  const [issues, setIssues] = useState<Issue[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [asrs, setAsrs] = useState<ServiceTicket[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set(['open', 'techs_scheduled', 'parts_on_order', 'in_progress']))

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingIssue, setEditingIssue] = useState<Issue | null | undefined>(undefined)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    Promise.all([API.issues.listAll(), API.sites.list(), API.serviceTickets.listAll()])
      .then(([i, s, serviceRecords]) => { setIssues(i); setSites(s); setAsrs(serviceRecords) })
      .catch(err => toast('Failed to load: ' + err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const siteMap = useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    STATUS_OPTS.forEach(s => { c[s.val] = issues.filter(i => i.status === s.val).length })
    return c
  }, [issues])

  const filtered = useMemo(() => {
    return issues.filter(i => {
      if (filterSite && i.site_id !== filterSite) return false
      if (filterStatuses.size && !filterStatuses.has(i.status ?? 'open')) return false
      if (filterPriority && i.priority !== filterPriority) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(
          (i.title ?? '').toLowerCase().includes(q) ||
          (i.unit_tag ?? '').toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q)
        )) return false
      }
      return true
    })
  }, [issues, filterSite, filterStatuses, filterPriority, search])

  function toggleStatus(val: string) {
    setFilterStatuses(prev => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40, textAlign: 'center' }}>Loading…</div>

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Issues</h1>
          <div className="page-subtitle">
            {issues.length} total · {counts['open'] ?? 0} open · {counts['complete'] ?? 0} complete
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>↑ Import CxAlloy CSV</button>
          <button className="btn btn-primary" onClick={() => setEditingIssue(null)}>+ New Issue</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 180 }}
          />
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="low">Low</option>
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

      {/* Desktop table */}
      <div className="card desktop-only">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue ID</th>
                <th>Site</th>
                <th>Equipment</th>
                <th>ASR</th>
                <th style={{ minWidth: 200 }}>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No issues match your filters</td></tr>
              ) : filtered.flatMap(i => {
                const site = i.site_id ? siteMap[i.site_id] : undefined
                const isOpen = expandedId === i.id
                const priColor = PRIORITY_COLOR[i.priority ?? ''] ?? 'var(--text3)'

                const row = (
                  <tr
                    key={i.id + '_row'}
                    style={{ cursor: 'pointer', background: isOpen ? 'var(--bg3)' : undefined }}
                    onClick={() => setExpandedId(isOpen ? null : i.id)}
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.title ?? ''}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 5, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>▶</span>
                      {i.cxalloy_issue_id || i.title || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {site ? (
                        <Link href={`/sites/${site.id}`} onClick={e => e.stopPropagation()} style={{ color: 'inherit' }}>{site.name}</Link>
                      ) : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{i.unit_tag || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: i.service_ticket_id ? 'var(--text2)' : 'var(--yellow)' }}>
                      {asrs.find(asr => asr.id === i.service_ticket_id)?.c2_number || 'Unassigned'}
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {i.description ? (
                        <span style={{ fontSize: 12, color: 'var(--text3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 } as React.CSSProperties}>
                          {i.description}
                        </span>
                      ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                    </td>
                    <td>
                      <span style={{ color: priColor, fontWeight: 600, fontSize: 11 }}>
                        {PRIORITY_LABEL[i.priority ?? ''] || i.priority || '—'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={i.status ?? 'open'} size="sm" />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtDate(i.reported_date || i.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingIssue(i)}>Edit</button>
                    </td>
                  </tr>
                )

                const detail = isOpen ? (
                  <tr key={i.id + '_detail'} style={{ background: 'var(--bg3)' }}>
                    <td colSpan={9} style={{ padding: '0 16px 16px 32px', borderBottom: '2px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px', paddingTop: 12, marginBottom: (i.description || i.resolution_notes) ? 12 : 0 }}>
                        {i.cx_issue_type && <div><div className="section-title">Issue Type</div><div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.cx_issue_type}</div></div>}
                        {i.cx_zone && <div><div className="section-title">Zone</div><div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.cx_zone}</div></div>}
                        {i.cx_source && <div><div className="section-title">Source</div><div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.cx_source}</div></div>}
                        {i.reported_by && <div><div className="section-title">Reported By</div><div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.reported_by}</div></div>}
                        {i.closed_date && <div><div className="section-title">Closed</div><div style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(i.closed_date)}</div></div>}
                      </div>
                      {i.description && (
                        <div style={{ marginBottom: 8 }}>
                          <div className="section-title">Description</div>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{i.description}</div>
                        </div>
                      )}
                      {i.resolution_notes && (
                        <div>
                          <div className="section-title">Comments / Resolution</div>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text2)', marginTop: 3, background: 'var(--bg2)', borderRadius: 6, padding: '8px 10px' }}>{i.resolution_notes}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null

                return [row, detail].filter(Boolean)
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mobile-issue-cards mobile-only">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No issues match your filters</div>
        ) : filtered.map(i => {
          const site = i.site_id ? siteMap[i.site_id] : undefined
          const isOpen = expandedId === i.id
          const isCx = !!i.cxalloy_issue_id
          const priColor = PRIORITY_COLOR[i.priority ?? ''] ?? 'var(--text3)'
          // CxAlloy = cyan left border; manual/field = accent pink
          const accentColor = isCx ? 'var(--cyan)' : 'var(--accent)'

          // Primary label: unit_tag is the identifier, fall back to title
          const primaryLabel = i.unit_tag || i.title || '—'
          // Secondary text: for CX issues, description is the CxAlloy description; for manual, it's the description
          const secondaryText = i.description

          return (
            <div
              key={i.id}
              style={{
                borderLeft: `3px solid ${isCx ? 'var(--cyan)' : 'var(--accent)'}`,
                background: 'var(--bg2)',
                borderRadius: '0 8px 8px 0',
                borderTop: '1px solid var(--border)',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              {/* Collapsed row — always visible, tap to expand */}
              <div
                style={{ padding: '9px 12px', cursor: 'pointer' }}
                onClick={() => setExpandedId(isOpen ? null : i.id)}
              >
                {/* Row 1: source badge + identifier + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1,
                    color: accentColor,
                    background: `color-mix(in srgb, ${isCx ? 'var(--cyan)' : 'var(--accent)'} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${isCx ? 'var(--cyan)' : 'var(--accent)'} 40%, transparent)`,
                    borderRadius: 3, padding: '1px 5px', flexShrink: 0,
                  }}>
                    {isCx ? 'CX' : 'FIELD'}
                  </span>

                  {/* CxAlloy issue ID — clickable link if URL available */}
                  {isCx && (
                    i.cxalloy_url ? (
                      <a
                        href={i.cxalloy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontFamily: 'monospace', fontSize: 11,
                          color: 'var(--cyan)', textDecoration: 'none',
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        {i.cxalloy_issue_id}
                        <span style={{ fontSize: 9, opacity: 0.8 }}>↗</span>
                      </a>
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                        {i.cxalloy_issue_id}
                      </span>
                    )
                  )}

                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <StatusBadge status={i.status ?? 'open'} size="sm" />
                  </span>
                </div>

                {/* Row 2: primary identifier (unit_tag / title) — bold */}
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--text)',
                  lineHeight: 1.3, marginBottom: secondaryText ? 3 : 5,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {primaryLabel}
                </div>

                {/* Row 3: description — 1 line, muted */}
                {secondaryText && (
                  <div style={{
                    fontSize: 12, color: 'var(--text3)', marginBottom: 5,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {secondaryText}
                  </div>
                )}

                {/* Row 4: meta — site · priority · date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                  {site && (
                    <Link href={`/sites/${site.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--text3)', textDecoration: 'none' }}
                    >
                      {site.name}
                    </Link>
                  )}
                  <span style={{ fontFamily: 'monospace', color: i.service_ticket_id ? 'var(--text3)' : 'var(--yellow)' }}>
                    {asrs.find(asr => asr.id === i.service_ticket_id)?.c2_number || 'Unassigned ASR'}
                  </span>
                  {site && i.priority && <span style={{ opacity: 0.4 }}>·</span>}
                  {i.priority && (
                    <span style={{ color: priColor, fontWeight: 700 }}>
                      {PRIORITY_LABEL[i.priority] || i.priority}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto' }}>
                    {fmtDate(i.reported_date || i.created_at)}
                  </span>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isOpen && (
                <div style={{ borderTop: `1px solid var(--border)`, background: 'var(--bg3)' }}>
                  <div style={{ padding: '10px 12px' }}>
                    {/* CxAlloy title shown as reference when it differs from unit_tag */}
                    {isCx && i.title && i.title !== i.unit_tag && (
                      <div style={{ marginBottom: 10 }}>
                        <div className="mic-detail-label" style={{ marginBottom: 2 }}>CxAlloy Title</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{i.title}</div>
                      </div>
                    )}

                    {/* Full description */}
                    {secondaryText && (
                      <div style={{ marginBottom: 10 }}>
                        <div className="mic-detail-label" style={{ marginBottom: 2 }}>Description</div>
                        <div className="mic-detail-text">{secondaryText}</div>
                      </div>
                    )}

                    {/* CX metadata grid */}
                    {(i.cx_issue_type || i.cx_zone || i.cx_source || i.reported_by || i.closed_date) && (
                      <div className="mic-detail-grid" style={{ marginBottom: 8 }}>
                        {i.cx_issue_type && (
                          <div><div className="mic-detail-label">Issue Type</div><div className="mic-detail-value">{i.cx_issue_type}</div></div>
                        )}
                        {i.cx_zone && (
                          <div><div className="mic-detail-label">Zone</div><div className="mic-detail-value">{i.cx_zone}</div></div>
                        )}
                        {i.cx_source && (
                          <div><div className="mic-detail-label">Source</div><div className="mic-detail-value">{i.cx_source}</div></div>
                        )}
                        {i.reported_by && (
                          <div><div className="mic-detail-label">Reported By</div><div className="mic-detail-value">{i.reported_by}</div></div>
                        )}
                        {i.closed_date && (
                          <div><div className="mic-detail-label">Closed</div><div className="mic-detail-value">{fmtDate(i.closed_date)}</div></div>
                        )}
                      </div>
                    )}

                    {/* Resolution notes */}
                    {i.resolution_notes && (
                      <div>
                        <div className="mic-detail-label" style={{ marginBottom: 2 }}>Resolution</div>
                        <div className="mic-detail-text" style={{ background: 'var(--bg2)', borderRadius: 5, padding: '7px 9px' }}>{i.resolution_notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Action row */}
                  <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingIssue(i)}>Edit</button>
                    {isCx && i.cxalloy_url && (
                      <a
                        href={i.cxalloy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                        style={{ color: 'var(--cyan)', textDecoration: 'none' }}
                      >
                        Open in CxAlloy ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {editingIssue !== undefined && (
        <IssueModal
          issue={editingIssue}
          sites={sites}
          asrs={asrs}
          onSave={saved => {
            setIssues(prev => {
              const idx = prev.findIndex(i => i.id === saved.id)
              return idx >= 0 ? prev.map((i, n) => n === idx ? saved : i) : [saved, ...prev]
            })
          }}
          onDelete={id => setIssues(prev => prev.filter(i => i.id !== id))}
          onClose={() => setEditingIssue(undefined)}
        />
      )}
      {showImport && (
        <CxImportModal
          sites={sites}
          asrs={asrs}
          onImported={() => {
            API.issues.listAll().then(setIssues).catch(() => {})
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
