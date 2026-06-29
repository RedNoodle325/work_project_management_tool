'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { API } from '../api'
import type { Unit, Site, Note, Issue } from '../types'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { ContactPicker } from '../components/ContactPicker'
import { useToastFn } from '@/app/providers'

const UNIT_TYPE_LABELS: Record<string, string> = {
  condenser: 'Condenser',
  evaporator: 'Evaporator',
  chiller: 'Chiller',
  air_handler: 'Air Handler',
  indirect_cooling: 'Indirect Cooling',
  indirect_evaporative: 'Indirect Evaporative',
  sycool: 'SyCool',
}

const UNIT_TYPE_COLORS: Record<string, string> = {
  condenser: '#f97316',
  evaporator: '#3b82f6',
  chiller: '#06b6d4',
  air_handler: '#8b5cf6',
  indirect_cooling: '#10b981',
  indirect_evaporative: '#10b981',
  sycool: '#6366f1',
}

const ISSUE_STATUS_COLOR: Record<string, string> = {
  open: 'var(--red)',
  in_progress: 'var(--yellow)',
  closed: 'var(--text3)',
  work_complete: 'var(--green)',
  ready_to_inspect: 'var(--accent)',
}

const ISSUE_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
  work_complete: 'Work Complete',
  ready_to_inspect: 'Ready to Inspect',
}

const ISSUE_PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--orange)',
  medium: 'var(--yellow)',
  low: 'var(--text3)',
}

function UnitTypeBadge({ type }: { type?: string }) {
  if (!type) return <span style={{ color: 'var(--text3)' }}>—</span>
  const label = UNIT_TYPE_LABELS[type] || type
  const color = UNIT_TYPE_COLORS[type] || '#64748b'
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  )
}

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// ── Note Modal ────────────────────────────────────────────────────────────────
interface NoteModalProps {
  note: Partial<Note> | null
  unitId: string
  onClose: () => void
  onSaved: (note: Note) => void
  onDeleted?: (id: string) => void
}

function NoteModal({ note, unitId, onClose, onSaved, onDeleted }: NoteModalProps) {
  const toast = useToastFn()
  const [content, setContent] = useState(note?.content || '')
  const [authorName, setAuthorName] = useState(note?.author_name || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      let saved: Note
      if (note?.id) {
        saved = await API.notes.update(note.id, { content, author_name: authorName || undefined })
      } else {
        saved = await API.notes.createUnit(unitId, { content, author_name: authorName || undefined })
      }
      toast(note?.id ? 'Note updated' : 'Note added')
      onSaved(saved)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!note?.id || !confirm('Delete this note?')) return
    try {
      await API.notes.delete(note.id)
      toast('Note deleted')
      onDeleted?.(note.id)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <Modal title={note?.id ? 'Edit Note' : 'Add Note'} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Author</label>
        <ContactPicker
          value={authorName}
          onChange={setAuthorName}
          placeholder="Your name (optional)"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Note *</label>
        <textarea
          rows={5}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a note…"
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div>
          {note?.id && (
            <button className="btn btn-sm" onClick={handleDelete}
              style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44' }}>
              Delete
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !content.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Issue Modal ────────────────────────────────────────────────────────────────
interface IssueModalProps {
  issue: Partial<Issue> | null
  unitId: string
  siteId?: string
  onClose: () => void
  onSaved: (issue: Issue) => void
  onDeleted?: (id: string) => void
}

function IssueModal({ issue, unitId, siteId, onClose, onSaved, onDeleted }: IssueModalProps) {
  const toast = useToastFn()
  const [title, setTitle] = useState(issue?.title || '')
  const [description, setDescription] = useState(issue?.description || '')
  const [priority, setPriority] = useState(issue?.priority || 'medium')
  const [status, setStatus] = useState(issue?.status || 'open')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      let saved: Issue
      if (issue?.id) {
        saved = await API.issues.update(issue.id, { title, description, priority, status })
      } else if (siteId) {
        saved = await API.issues.create(siteId, {
          title, description, priority, status,
          unit_id: unitId, site_id: siteId,
        })
      } else {
        toast('No site ID available', 'error')
        return
      }
      toast(issue?.id ? 'Issue updated' : 'Issue created')
      onSaved(saved)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!issue?.id || !confirm('Delete this issue?')) return
    try {
      await API.issues.delete(issue.id)
      toast('Issue deleted')
      onDeleted?.(issue.id)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <Modal title={issue?.id ? 'Edit Issue' : 'Add Issue'} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Description</label>
        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="work_complete">Work Complete</option>
            <option value="ready_to_inspect">Ready to Inspect</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div>
          {issue?.id && (
            <button className="btn btn-sm" onClick={handleDelete}
              style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44' }}>
              Delete
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function UnitDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToastFn()

  const [unit, setUnit] = useState<Unit | null>(null)
  const [site, setSite] = useState<Site | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [noteModal, setNoteModal] = useState<Partial<Note> | null | false>(false)
  const [issueModal, setIssueModal] = useState<Partial<Issue> | null | false>(false)

  useEffect(() => {
    if (!id) { router.push('/'); return }
    const unitId = id
    async function load() {
      try {
        const [unitData, unitNotes, unitIssues, allSites] = await Promise.all([
          API.units.get(unitId),
          API.notes.listUnit(unitId).catch(() => [] as Note[]),
          API.issues.listUnit(unitId).catch(() => [] as Issue[]),
          API.sites.list().catch(() => [] as Site[]),
        ])
        setUnit(unitData)
        setNotes(unitNotes)
        setIssues(unitIssues)
        setSite(allSites.find(s => s.id === unitData.site_id) || null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load unit')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading…</div>
  }

  if (error || !unit) {
    return <div style={{ color: 'var(--red)', padding: 40 }}>Error: {error || 'Unit not found'}</div>
  }

  const backHref = site ? `/sites/${site.id}` : '/'

  // Warranty status
  const today = new Date()
  let warStatus = '—'
  let warColor = 'var(--text3)'
  if (unit.warranty_expiry) {
    const warEnd = new Date(unit.warranty_expiry)
    const daysLeft = Math.round((warEnd.getTime() - today.getTime()) / 86400000)
    if (daysLeft < 0) { warStatus = 'Expired'; warColor = 'var(--red)' }
    else if (daysLeft < 30) { warStatus = `${daysLeft} days left`; warColor = 'var(--yellow)' }
    else { warStatus = fmt(unit.warranty_expiry) + ' (Active)'; warColor = 'var(--green)' }
  }

  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress')
  const closedIssues = issues.filter(i => i.status !== 'open' && i.status !== 'in_progress')

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={backHref} className="btn btn-secondary btn-sm">
            ← {site ? site.name : 'Back'}
          </Link>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'monospace' }}>{unit.tag || unit.serial_number || '—'}</h1>
            <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <UnitTypeBadge type={unit.unit_type} />
              {unit.model && <span style={{ color: 'var(--text2)' }}>{unit.model}</span>}
              {site && (
                <span style={{ color: 'var(--text3)' }}>
                  @{' '}
                  <Link href={`/sites/${site.id}`} style={{ color: 'var(--text3)' }}>{site.name}</Link>
                </span>
              )}
            </div>
          </div>
        </div>
        <Link href={`/units/${id}/edit`} className="btn btn-secondary btn-sm">Edit Unit</Link>
      </div>

      {/* Top row: Unit Info + Status */}
      <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>

        {/* Unit Info Card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Unit Information</div>
          <div className="grid-2" style={{ gap: 8 }}>
            <div>
              <div className="section-title">Tag / ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16 }}>{unit.tag || '—'}</div>
            </div>
            <div>
              <div className="section-title">Serial Number</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{unit.serial_number || '—'}</div>
            </div>
            <div>
              <div className="section-title">Type</div>
              <div><UnitTypeBadge type={unit.unit_type} /></div>
            </div>
            <div>
              <div className="section-title">Manufacturer</div>
              <div style={{ color: 'var(--text2)' }}>{unit.manufacturer || '—'}</div>
            </div>
            <div>
              <div className="section-title">Model</div>
              <div style={{ color: 'var(--text2)' }}>{unit.model || '—'}</div>
            </div>
            <div>
              <div className="section-title">Capacity</div>
              <div style={{ color: 'var(--text2)' }}>
                {unit.capacity_kw != null ? `${unit.capacity_kw} kW` : '—'}
              </div>
            </div>
            <div>
              <div className="section-title">Location</div>
              <div style={{ color: 'var(--text2)' }}>{unit.location || '—'}</div>
            </div>
            <div>
              <div className="section-title">Floor</div>
              <div style={{ color: 'var(--text2)' }}>{unit.floor || '—'}</div>
            </div>
            <div>
              <div className="section-title">Status</div>
              <div>{unit.status ? <StatusBadge status={unit.status} /> : '—'}</div>
            </div>
            <div>
              <div className="section-title">Install Date</div>
              <div style={{ color: 'var(--text2)' }}>{fmt(unit.install_date)}</div>
            </div>
            <div>
              <div className="section-title">Warranty Expiry</div>
              <div style={{ color: warColor, fontWeight: 600 }}>{warStatus}</div>
            </div>
            {unit.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="section-title">Notes</div>
                <div style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap', fontSize: 12 }}>{unit.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Stats card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Summary</div>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{
                fontSize: 28, fontWeight: 700,
                color: openIssues.length > 0 ? 'var(--red)' : 'var(--green)',
              }}>
                {openIssues.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Open Issues</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text2)' }}>
                {issues.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Total Issues</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text2)' }}>
                {notes.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Notes</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>
                {unit.status ? (
                  <StatusBadge status={unit.status} />
                ) : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Unit Status</div>
            </div>
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">
            Work History · Issues
            {openIssues.length > 0 && (
              <span style={{
                marginLeft: 8,
                background: 'var(--red)22', color: 'var(--red)',
                border: '1px solid var(--red)44', borderRadius: 99,
                padding: '1px 8px', fontSize: 11,
              }}>
                {openIssues.length} open
              </span>
            )}
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setIssueModal(null)}>
            + Add Issue
          </button>
        </div>

        {issues.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No issues linked to this unit yet.</div>
        ) : (
          <>
            {openIssues.length === 0 ? (
              <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: closedIssues.length ? 12 : 0 }}>
                ✓ No open or in-progress issues
              </div>
            ) : (
              <div className="table-wrap" style={{ marginBottom: closedIssues.length ? 16 : 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openIssues.map(i => {
                      const sc = ISSUE_STATUS_COLOR[i.status || ''] || 'var(--text3)'
                      const sl = ISSUE_STATUS_LABEL[i.status || ''] || i.status || '—'
                      const pc = ISSUE_PRIORITY_COLOR[i.priority || ''] || 'var(--text3)'
                      return (
                        <tr key={i.id}>
                          <td style={{ fontSize: 12 }}>{i.title || '—'}</td>
                          <td style={{ color: pc, fontSize: 11, fontWeight: 600 }}>
                            {i.priority ? i.priority.charAt(0).toUpperCase() + i.priority.slice(1) : '—'}
                          </td>
                          <td>
                            <span style={{
                              background: `${sc}22`, color: sc, border: `1px solid ${sc}44`,
                              borderRadius: 99, padding: '1px 6px', fontSize: 10, whiteSpace: 'nowrap',
                            }}>{sl}</span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text3)' }}>{i.cx_issue_type || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(i.reported_date || i.created_at)}</td>
                          <td>
                            <button className="btn btn-sm btn-secondary" onClick={() => setIssueModal(i)}>Edit</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {closedIssues.length > 0 && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text3)', userSelect: 'none' }}>
                  {closedIssues.length} resolved / closed issue{closedIssues.length !== 1 ? 's' : ''}
                </summary>
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Issue</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedIssues.map(i => {
                        const sc = ISSUE_STATUS_COLOR[i.status || ''] || 'var(--text3)'
                        const sl = ISSUE_STATUS_LABEL[i.status || ''] || i.status || '—'
                        const pc = ISSUE_PRIORITY_COLOR[i.priority || ''] || 'var(--text3)'
                        return (
                          <tr key={i.id}>
                            <td style={{ fontSize: 12 }}>{i.title || '—'}</td>
                            <td style={{ color: pc, fontSize: 11, fontWeight: 600 }}>
                              {i.priority ? i.priority.charAt(0).toUpperCase() + i.priority.slice(1) : '—'}
                            </td>
                            <td>
                              <span style={{
                                background: `${sc}22`, color: sc, border: `1px solid ${sc}44`,
                                borderRadius: 99, padding: '1px 6px', fontSize: 10, whiteSpace: 'nowrap',
                              }}>{sl}</span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(i.reported_date || i.created_at)}</td>
                            <td>
                              <button className="btn btn-sm btn-secondary" onClick={() => setIssueModal(i)}>Edit</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {/* Notes */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">
            Work History · Notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({notes.length})</span>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setNoteModal(null)}>
            + Add Note
          </button>
        </div>

        {notes.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No notes yet. Add the first one.</div>
        ) : (
          notes.map(n => (
            <div key={n.id} style={{
              border: '1px solid var(--border)', borderRadius: 8,
              padding: 12, marginBottom: 8, background: 'var(--bg3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {n.author_name && (
                    <strong style={{ color: 'var(--text2)' }}>{n.author_name} · </strong>
                  )}
                  {fmt(n.created_at)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => setNoteModal(n)}>Edit</button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ color: 'var(--red)' }}
                    onClick={async () => {
                      if (!confirm('Delete this note?')) return
                      try {
                        await API.notes.delete(n.id)
                        setNotes(prev => prev.filter(x => x.id !== n.id))
                        toast('Note deleted')
                      } catch (e) {
                        toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
                      }
                    }}
                  >✕</button>
                </div>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)' }}>{n.content}</div>
            </div>
          ))
        )}
      </div>

      {/* Note Modal */}
      {noteModal !== false && id && (
        <NoteModal
          note={noteModal}
          unitId={id}
          onClose={() => setNoteModal(false)}
          onSaved={saved => {
            setNotes(prev => noteModal?.id
              ? prev.map(n => n.id === saved.id ? saved : n)
              : [saved, ...prev]
            )
          }}
          onDeleted={deletedId => setNotes(prev => prev.filter(n => n.id !== deletedId))}
        />
      )}

      {/* Issue Modal */}
      {issueModal !== false && id && (
        <IssueModal
          issue={issueModal}
          unitId={id}
          siteId={unit.site_id}
          onClose={() => setIssueModal(false)}
          onSaved={saved => {
            setIssues(prev => issueModal?.id
              ? prev.map(i => i.id === saved.id ? saved : i)
              : [saved, ...prev]
            )
          }}
          onDeleted={deletedId => setIssues(prev => prev.filter(i => i.id !== deletedId))}
        />
      )}
    </div>
  )
}
