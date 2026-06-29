'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { API } from '../api'
import type { Site, Unit, Contact, Note, Issue, ServiceTicket, JobNumber } from '../types'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { ContactPicker } from '../components/ContactPicker'
import { useToastFn } from '@/app/providers'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

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

function UnitTypeBadge({ type }: { type?: string }) {
  if (!type) return <span style={{ color: 'var(--text3)' }}>—</span>
  const label = UNIT_TYPE_LABELS[type] || type
  const color = UNIT_TYPE_COLORS[type] || '#64748b'
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  )
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

const CONTACT_TYPE_COLOR: Record<string, string> = {
  site_contact: '#3b82f6',
  munters_employee: '#f97316',
  contractor: '#a855f7',
}


const CS_STATUS_COLOR: Record<string, string> = {
  open: 'var(--blue)',
  in_progress: 'var(--yellow)',
  complete: 'var(--green)',
  cancelled: 'var(--text3)',
}

const CS_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

// ── Collapsible Card ──────────────────────────────────────────────────────────
function ColCard({
  title, right, children, defaultOpen = false, className = '',
}: {
  title: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`card ${className}`} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
          ...(open ? { paddingBottom: 12 } : {}),
        }}
        onClick={() => setOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, color: 'var(--text3)', transition: 'transform .2s',
            ...(open ? { transform: 'rotate(90deg)' } : {}),
          }}>▶</span>
          <div className="card-title" style={{ margin: 0 }}>{title}</div>
        </div>
        <div onClick={e => e.stopPropagation()}>{right}</div>
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}

// ── Contact Modal ─────────────────────────────────────────────────────────────
interface ContactModalProps {
  contact: Partial<Contact> | null
  siteId: string
  onClose: () => void
  onSaved: (c: Contact) => void
  onDeleted?: (id: string) => void
}

function toMuntersEmail(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/)
  if (parts.length < 2) return ''
  return `${parts[0]}.${parts[parts.length - 1]}@munters.com`
}

function ContactModal({ contact, siteId, onClose, onSaved, onDeleted }: ContactModalProps) {
  const toast = useToastFn()
  const [name, setName] = useState(contact?.name || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [title, setTitle] = useState(contact?.title || '')
  const [contactType, setContactType] = useState(contact?.contact_type || 'site_contact')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (contactType === 'munters_employee') {
      const generated = toMuntersEmail(name)
      if (generated && (!email || email.endsWith('@munters.com'))) {
        setEmail(generated)
      }
    }
  }, [name, contactType])

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      let saved: Contact
      if (contact?.id) {
        saved = await API.contacts.update(siteId, contact.id, { name, email, phone, title, contact_type: contactType })
      } else {
        saved = await API.contacts.create(siteId, { name, email, phone, title, contact_type: contactType })
      }
      toast(contact?.id ? 'Contact updated' : 'Contact added')
      onSaved(saved)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact?.id || !confirm(`Delete contact "${contact.name}"?`)) return
    try {
      await API.contacts.delete(siteId, contact.id)
      toast('Contact deleted')
      onDeleted?.(contact.id)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <Modal title={contact?.id ? 'Edit Contact' : 'Add Contact'} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Name *</label>
        <ContactPicker value={name} onChange={setName} autoFocus />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Type</label>
        <select value={contactType} onChange={e => setContactType(e.target.value)}>
          <option value="site_contact">Site Contact</option>
          <option value="munters_employee">Munters Employee</option>
          <option value="contractor">Contractor</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Title / Role</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Facilities Manager" />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Phone</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div>
          {contact?.id && (
            <button className="btn btn-sm" onClick={handleDelete}
              style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44' }}>
              Delete
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Note Modal (site) ─────────────────────────────────────────────────────────
interface SiteNoteModalProps {
  note: Partial<Note> | null
  siteId: string
  onClose: () => void
  onSaved: (n: Note) => void
  onDeleted?: (id: string) => void
}

function SiteNoteModal({ note, siteId, onClose, onSaved, onDeleted }: SiteNoteModalProps) {
  const toast = useToastFn()
  const [content, setContent] = useState(note?.content || '')
  const [noteType, setNoteType] = useState(note?.note_type || 'note')
  const [authorName, setAuthorName] = useState(note?.author_name || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      let saved: Note
      const payload = { content, note_type: noteType, author_name: authorName || undefined }
      if (note?.id) {
        saved = await API.notes.update(note.id, payload)
      } else {
        saved = await API.notes.createSite(siteId, payload)
      }
      toast(note?.id ? 'Note updated' : 'Note logged')
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
    <Modal title={note?.id ? 'Edit Note' : 'Log Contact'} onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Type</label>
          <select value={noteType} onChange={e => setNoteType(e.target.value)}>
            <option value="note">Note</option>
            <option value="meeting">Meeting</option>
            <option value="phone_call">Phone Call</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Author</label>
          <ContactPicker value={authorName} onChange={setAuthorName} placeholder="Your name (optional)" />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Content *</label>
        <textarea rows={6} value={content} onChange={e => setContent(e.target.value)} autoFocus />
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

// ── Issue Modal (site) ────────────────────────────────────────────────────────
interface IssueModalProps {
  issue: Partial<Issue> | null
  siteId: string
  onClose: () => void
  onSaved: (i: Issue) => void
  onDeleted?: (id: string) => void
}

function IssueModal({ issue, siteId, onClose, onSaved, onDeleted }: IssueModalProps) {
  const toast = useToastFn()
  const [title, setTitle] = useState(issue?.title || '')
  const [description, setDescription] = useState(issue?.description || '')
  const [unitTag, setUnitTag] = useState(issue?.unit_tag || '')
  const [priority, setPriority] = useState(issue?.priority || 'medium')
  const [status, setStatus] = useState(issue?.status || 'open')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      let saved: Issue
      if (issue?.id) {
        saved = await API.issues.update(issue.id, { title, description, unit_tag: unitTag, priority, status })
      } else {
        saved = await API.issues.create(siteId, { title, description, unit_tag: unitTag, priority, status, site_id: siteId })
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
        <label>Equipment / Unit Tag</label>
        <input value={unitTag} onChange={e => setUnitTag(e.target.value)} placeholder="e.g. COND-001" style={{ fontFamily: 'monospace' }} />
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

// ── CS Ticket Modal ───────────────────────────────────────────────────────────
interface CsTicketModalProps {
  ticket: Partial<ServiceTicket> | null
  siteId: string
  onClose: () => void
  onSaved: (t: ServiceTicket) => void
  onDeleted?: (id: string) => void
}

function CsTicketModal({ ticket, siteId, onClose, onSaved, onDeleted }: CsTicketModalProps) {
  const toast = useToastFn()
  const [title, setTitle] = useState(ticket?.title || '')
  const [description, setDescription] = useState(ticket?.description || '')
  const [status, setStatus] = useState(ticket?.status || 'open')
  const [c2Number, setC2Number] = useState(ticket?.c2_number || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      let saved: ServiceTicket
      if (ticket?.id) {
        saved = await API.serviceTickets.update(ticket.id, {
          title, description, status,
          c2_number: c2Number || undefined,
        })
      } else {
        saved = await API.serviceTickets.create(siteId, {
          title, description, status,
          c2_number: c2Number || undefined,
          parts_ordered: [],
          service_lines: [],
        })
      }
      toast(ticket?.id ? 'Ticket updated' : 'Ticket created')
      onSaved(saved)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!ticket?.id || !confirm('Delete this ticket?')) return
    try {
      await API.serviceTickets.delete(ticket.id)
      toast('Ticket deleted')
      onDeleted?.(ticket.id)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <Modal title={ticket?.id ? 'Edit CS Ticket' : 'New CS Ticket'} onClose={onClose}>
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
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>C2 Number</label>
          <input
            value={c2Number}
            onChange={e => setC2Number(e.target.value)}
            style={{ fontFamily: 'monospace' }}
            placeholder="e.g. C2-12345"
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div>
          {ticket?.id && (
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

// ── Job Number Modal ──────────────────────────────────────────────────────────
interface JobNumberModalProps {
  jobNumber: Partial<JobNumber> | null
  siteId: string
  onClose: () => void
  onSaved: (jn: JobNumber) => void
  onDeleted?: (id: string) => void
}

function JobNumberModal({ jobNumber, siteId, onClose, onSaved, onDeleted }: JobNumberModalProps) {
  const toast = useToastFn()
  const [number, setNumber] = useState(jobNumber?.job_number || '')
  const [description, setDescription] = useState(jobNumber?.description || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!number.trim()) return
    setSaving(true)
    try {
      let saved: JobNumber
      if (jobNumber?.id) {
        saved = await API.jobNumbers.update(siteId, jobNumber.id, { job_number: number, description: description || undefined })
      } else {
        saved = await API.jobNumbers.create(siteId, { job_number: number, description: description || undefined })
      }
      toast(jobNumber?.id ? 'Job number updated' : 'Job number added')
      onSaved(saved)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!jobNumber?.id || !confirm('Delete this job number?')) return
    try {
      await API.jobNumbers.delete(siteId, jobNumber.id)
      toast('Job number deleted')
      onDeleted?.(jobNumber.id)
      onClose()
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <Modal title={jobNumber?.id ? 'Edit Job Number' : 'Add Job Number'} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Job Number *</label>
        <input
          value={number}
          onChange={e => setNumber(e.target.value)}
          style={{ fontFamily: 'monospace' }}
          placeholder="e.g. 22366582"
          autoFocus
        />
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div>
          {jobNumber?.id && (
            <button className="btn btn-sm" onClick={handleDelete}
              style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44' }}>
              Delete
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !number.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function SiteDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToastFn()

  const [site, setSite] = useState<Site | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [serviceTickets, setServiceTickets] = useState<ServiceTicket[]>([])
  const [jobNumbers, setJobNumbers] = useState<JobNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // PM log modal state
  const [pmLogModal, setPmLogModal] = useState(false)
  const [pmLogText, setPmLogText] = useState('')
  const [pmLogWeek, setPmLogWeek] = useState('')
  const [pmLogSaving, setPmLogSaving] = useState(false)

  async function savePmLog() {
    if (!pmLogText.trim() || !id) return
    setPmLogSaving(true)
    try {
      const weekLabel = pmLogWeek
        ? new Date(pmLogWeek + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const content = `Week of ${weekLabel}\n\n${pmLogText.trim()}`
      const saved = await API.notes.createSite(id, { content, note_type: 'pm_log' })
      setNotes(prev => [saved, ...prev])
      setPmLogModal(false)
      setPmLogText('')
      setPmLogWeek('')
      toast('PM log entry added')
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setPmLogSaving(false)
    }
  }

  // Modals
  const [contactModal, setContactModal] = useState<Partial<Contact> | null | false>(false)
  const [noteModal, setNoteModal] = useState<Partial<Note> | null | false>(false)
  const [issueModal, setIssueModal] = useState<Partial<Issue> | null | false>(false)
  const [csTicketModal, setCsTicketModal] = useState<Partial<ServiceTicket> | null | false>(false)
  const [jobNumberModal, setJobNumberModal] = useState<Partial<JobNumber> | null | false>(false)

  useEffect(() => {
    if (!id) { router.push('/'); return }
    const siteId = id
    async function load() {
      try {
        const [siteData, allUnits, siteContacts, siteNotes, siteIssues, siteTickets, siteJobs] = await Promise.all([
          API.sites.get(siteId),
          API.units.list(),
          API.contacts.list(siteId).catch(() => [] as Contact[]),
          API.notes.listSite(siteId).catch(() => [] as Note[]),
          API.issues.listSite(siteId).catch(() => [] as Issue[]),
          API.serviceTickets.listSite(siteId).catch(() => [] as ServiceTicket[]),
          API.jobNumbers.list(siteId).catch(() => [] as JobNumber[]),
        ])
        setSite(siteData)
        setUnits(allUnits.filter(u => u.site_id === id))
        setContacts(siteContacts)
        setNotes(siteNotes)
        setIssues(siteIssues)
        setServiceTickets(siteTickets)
        setJobNumbers(siteJobs)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load site')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading…</div>
  }

  if (error || !site || !id) {
    return <div style={{ color: 'var(--red)', padding: 40 }}>Error: {error || 'Site not found'}</div>
  }

  const addr = [site.address, site.city, site.state, site.zip].filter(Boolean).join(', ')
  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress')
  const closedIssues = issues.filter(i => i.status !== 'open' && i.status !== 'in_progress')
  const openTickets = serviceTickets.filter(t => t.status === 'open' || t.status === 'in_progress')

  // Group contacts by type
  const contactGroups = [
    { key: 'site_contact', label: 'Site Contacts' },
    { key: 'munters_employee', label: 'Munters Employees' },
    { key: 'contractor', label: 'Contractors' },
  ]

  // Note type config
  const NOTE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    meeting: { label: 'Meeting', color: '#7c3aed' },
    phone_call: { label: 'Phone Call', color: '#2563eb' },
    email: { label: 'Email', color: '#0891b2' },
    note: { label: 'Note', color: '#6b7280' },
  }

  return (
    <div className="site-detail-page">
      {/* Header */}
      <div className="page-header site-detail-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" className="btn btn-secondary btn-sm">← Dashboard</Link>
          <div>
            <h1 style={{ margin: 0 }}>{site.name || '—'}</h1>
            <div className="page-subtitle">
              {[site.city, site.state].filter(Boolean).join(', ') || 'No address set'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href={`/sites/${id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="stat-grid site-detail-stats" style={{ marginBottom: 16 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{units.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Units</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: openIssues.length > 0 ? 'var(--red)' : 'var(--green)' }}>
            {openIssues.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Open Issues</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: openTickets.length > 0 ? 'var(--yellow)' : 'var(--text2)' }}>
            {openTickets.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Active CS Tickets</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            {site.status ? <StatusBadge status={site.status} /> : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Site Status</div>
        </div>
      </div>

      {/* Site Info */}
      <div className="card site-detail-info" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">Site Information</div>
          <Link href={`/sites/${id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            <div className="section-title">Address</div>
            <div style={{ color: 'var(--text2)' }}>{addr || '—'}</div>
          </div>
          {site.region && (
            <div>
              <div className="section-title">Region</div>
              <div style={{ color: 'var(--text2)' }}>{site.region}</div>
            </div>
          )}
          {site.owner && (
            <div>
              <div className="section-title">Owner / Customer</div>
              <div style={{ color: 'var(--text2)' }}>{site.owner}</div>
            </div>
          )}
          {site.site_type && (
            <div>
              <div className="section-title">Site Type</div>
              <div style={{ color: 'var(--text2)', textTransform: 'capitalize' }}>
                {site.site_type.replace(/_/g, ' ')}
              </div>
            </div>
          )}
          {site.warranty_status && (
            <div>
              <div className="section-title">Warranty Status</div>
              <div><StatusBadge status={site.warranty_status} /></div>
            </div>
          )}
          {site.astea_site_id && (
            <div>
              <div className="section-title">Astea Site ID</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{site.astea_site_id}</div>
            </div>
          )}
          {site.shipping_name && (
            <div>
              <div className="section-title">Shipping Name</div>
              <div style={{ color: 'var(--text2)' }}>{site.shipping_name}</div>
            </div>
          )}
          {site.shipping_contact && (
            <div>
              <div className="section-title">Shipping Contact</div>
              <div style={{ color: 'var(--text2)' }}>{site.shipping_contact}</div>
            </div>
          )}
          {addr && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="section-title" style={{ marginBottom: 4 }}>Map</div>
              <div className="site-map-frame">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(addr)}&output=embed&z=14`}
                  style={{ width: '100%', height: '100%', border: 0, borderRadius: 6 }}
                  loading="lazy"
                  title="Site map"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Issues */}
      <ColCard
        className="site-detail-issues"
        defaultOpen
        title={
          <>
            Issues <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({issues.length})</span>
            {openIssues.length > 0 && (
              <span style={{
                marginLeft: 8, background: 'var(--red)22', color: 'var(--red)',
                border: '1px solid var(--red)44', borderRadius: 99,
                padding: '1px 8px', fontSize: 11,
              }}>
                {openIssues.filter(i => i.status === 'open').length > 0 && `${issues.filter(i => i.status === 'open').length} open`}
              </span>
            )}
          </>
        }
        right={
          <button className="btn btn-sm btn-primary" onClick={() => setIssueModal(null)}>
            + Add Issue
          </button>
        }
      >
        <div style={{ marginTop: 4 }}>
          {issues.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>
              No issues yet. Add one to start tracking.
            </div>
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
                        <th>Equipment</th>
                        <th>Issue</th>
                        <th>Priority</th>
                        <th>Status</th>
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
                            <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)' }}>
                              {i.unit_tag || '—'}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {i.title || '—'}
                              {i.description && (
                                <div style={{
                                  fontSize: 11, color: 'var(--text3)', marginTop: 1,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320,
                                }}>
                                  {i.description.slice(0, 120)}
                                </div>
                              )}
                            </td>
                            <td style={{ color: pc, fontSize: 11, fontWeight: 600 }}>
                              {i.priority ? i.priority.charAt(0).toUpperCase() + i.priority.slice(1) : '—'}
                            </td>
                            <td>
                              <span style={{
                                background: `${sc}22`, color: sc, border: `1px solid ${sc}44`,
                                borderRadius: 99, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap',
                              }}>{sl}</span>
                            </td>
                            <td>
                              <button className="btn btn-sm btn-secondary" onClick={() => setIssueModal(i)}>
                                Edit
                              </button>
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
                          <th>Equipment</th>
                          <th>Issue</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th style={{ width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedIssues.slice(0, 10).map(i => {
                          const sc = ISSUE_STATUS_COLOR[i.status || ''] || 'var(--text3)'
                          const sl = ISSUE_STATUS_LABEL[i.status || ''] || i.status || '—'
                          const pc = ISSUE_PRIORITY_COLOR[i.priority || ''] || 'var(--text3)'
                          return (
                            <tr key={i.id}>
                              <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)' }}>
                                {i.unit_tag || '—'}
                              </td>
                              <td style={{ fontSize: 12 }}>{i.title || '—'}</td>
                              <td style={{ color: pc, fontSize: 11, fontWeight: 600 }}>
                                {i.priority ? i.priority.charAt(0).toUpperCase() + i.priority.slice(1) : '—'}
                              </td>
                              <td>
                                <span style={{
                                  background: `${sc}22`, color: sc, border: `1px solid ${sc}44`,
                                  borderRadius: 99, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap',
                                }}>{sl}</span>
                              </td>
                              <td>
                                <button className="btn btn-sm btn-secondary" onClick={() => setIssueModal(i)}>
                                  Edit
                                </button>
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
      </ColCard>

      {/* Units */}
      <ColCard
        className="site-detail-units"
        defaultOpen
        title={
          <>Units <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({units.length})</span></>
        }
        right={
          <Link href={`/sites/${id}/units/new`} className="btn btn-sm btn-primary">
            + New Unit
          </Link>
        }
      >
        {units.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No units have been added to this site yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Type</th>
                  <th>Serial Number</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Install Date</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/units/${u.id}`}
                        style={{ fontFamily: 'monospace', fontWeight: 600 }}
                      >
                        {u.tag || u.serial_number || '—'}
                      </Link>
                    </td>
                    <td><UnitTypeBadge type={u.unit_type} /></td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)' }}>{u.serial_number || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{u.model || '—'}</td>
                    <td>{u.status ? <StatusBadge status={u.status} size="sm" /> : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(u.install_date)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/units/${u.id}`} className="btn btn-sm btn-secondary">History</Link>
                      <Link href={`/units/${u.id}/edit`} className="btn btn-sm btn-secondary" style={{ marginLeft: 4 }}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ColCard>

      {/* Contacts */}
      <ColCard
        className="site-detail-contacts"
        defaultOpen
        title={<>Contacts <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({contacts.length})</span></>}
        right={
          <button className="btn btn-sm btn-primary" onClick={() => setContactModal(null)}>
            + Contact
          </button>
        }
      >
        {contacts.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>No contacts added yet.</div>
        ) : (
          <div style={{ marginTop: 4 }}>
            {contactGroups.map(g => {
              const group = contacts.filter(c => (c.contact_type || 'site_contact') === g.key)
              if (!group.length) return null
              const color = CONTACT_TYPE_COLOR[g.key]
              return (
                <div key={g.key} style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color, letterSpacing: '.05em', marginBottom: 4,
                  }}>
                    {g.label}
                  </div>
                  {group.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                        {c.title && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.title}</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                        {c.phone && (
                          <div><a href={`tel:${c.phone}`}>{c.phone}</a></div>
                        )}
                        {c.email && (
                          <div style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <a href={`mailto:${c.email}`}>{c.email}</a>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setContactModal(c)}>Edit</button>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ color: 'var(--red)' }}
                          onClick={async () => {
                            if (!confirm(`Delete contact "${c.name}"?`)) return
                            try {
                              await API.contacts.delete(id, c.id)
                              setContacts(prev => prev.filter(x => x.id !== c.id))
                              toast('Contact deleted')
                            } catch (e) {
                              toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
                            }
                          }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </ColCard>

      {/* CS Tickets */}
      <ColCard
        className="site-detail-parts"
        defaultOpen
        title={
          <>
            Part Order Status <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({serviceTickets.reduce((count, ticket) => count + (Array.isArray(ticket.parts_ordered) ? ticket.parts_ordered.length : 0), 0)} parts)</span>
            {openTickets.length > 0 && (
              <span style={{
                marginLeft: 8, background: 'var(--red)22', color: 'var(--red)',
                border: '1px solid var(--red)44', borderRadius: 99,
                padding: '1px 8px', fontSize: 11,
              }}>
                {openTickets.length} open
              </span>
            )}
          </>
        }
        right={
          <button className="btn btn-sm btn-primary" onClick={() => setCsTicketModal(null)}>
            + Service Ticket
          </button>
        }
      >
        <div style={{ marginTop: 4 }}>
          {serviceTickets.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>
              No part orders yet. Add a service ticket when parts are needed.
            </div>
          ) : (
            [...serviceTickets]
              .sort((a, b) => {
                const ord: Record<string, number> = { open: 0, in_progress: 1, complete: 2, cancelled: 3 }
                return (ord[a.status] ?? 9) - (ord[b.status] ?? 9)
              })
              .map(t => {
                const sc = CS_STATUS_COLOR[t.status] || 'var(--text3)'
                const sl = CS_STATUS_LABEL[t.status] || t.status || '—'
                const parts = Array.isArray(t.parts_ordered) ? t.parts_ordered : []
                const lines = Array.isArray(t.service_lines) ? t.service_lines : []
                const linkedIssues = issues.filter(i => i.service_ticket_id === t.id)
                return (
                  <div key={t.id} style={{
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '12px 14px', marginBottom: 10, background: 'var(--bg3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t.title}</span>
                          <span style={{
                            background: `${sc}22`, color: sc, border: `1px solid ${sc}44`,
                            borderRadius: 99, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap',
                          }}>{sl}</span>
                          {t.c2_number && (
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                              C2: <span style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{t.c2_number}</span>
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{t.description}</div>
                        )}
                      </div>
                      <button className="btn btn-sm btn-secondary" onClick={() => setCsTicketModal(t)}>Edit</button>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                      {lines.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                            Service Lines
                          </span>
                          <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {lines.map((l, i) => (
                              <span key={i} style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>
                                {l.astea_id || '—'}{l.description ? ` — ${l.description}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {parts.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                            Parts Ordered
                          </span>
                          <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {parts.map((p, i) => (
                              <span key={i} style={{ color: 'var(--text2)' }}>
                                {p.description || '—'} × {p.qty || 1}
                                {p.so_number && (
                                  <span style={{ fontFamily: 'monospace', color: 'var(--text3)', marginLeft: 6 }}>
                                    SO# {p.so_number}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {linkedIssues.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                            Linked Issues ({linkedIssues.length})
                          </span>
                          <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {linkedIssues.map(i => (
                              <span key={i.id} style={{
                                background: 'var(--bg2)', border: '1px solid var(--border)',
                                borderRadius: 4, padding: '1px 6px', fontSize: 11, fontFamily: 'monospace',
                              }}>
                                {i.unit_tag || i.title || 'issue'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </ColCard>

      {/* Contact Log / Notes */}
      <ColCard
        className="site-detail-notes"
        defaultOpen
        title={<>Notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({notes.length})</span></>}
        right={
          <button className="btn btn-sm btn-primary" onClick={() => setNoteModal(null)}>
            + Add Note
          </button>
        }
      >
        <div style={{ marginTop: 4 }}>
          {notes.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No contact log yet. Add the first entry.</div>
          ) : (
            notes.map(n => {
              const tc = NOTE_TYPE_CONFIG[n.note_type || 'note'] || NOTE_TYPE_CONFIG.note
              return (
                <div key={n.id} style={{
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${tc.color}`,
                  borderRadius: 8, padding: 12, marginBottom: 8, background: 'var(--bg3)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: tc.color,
                        background: `${tc.color}18`, border: `1px solid ${tc.color}44`,
                        borderRadius: 99, padding: '1px 8px',
                      }}>
                        {tc.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {n.author_name && <strong style={{ color: 'var(--text2)' }}>{n.author_name} · </strong>}
                        {fmt(n.created_at)}
                      </span>
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
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)' }}>
                    {n.content}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ColCard>

      {/* PM Project Log */}
      {(() => {
        const pmEntries = notes.filter(n => n.note_type === 'pm_log')
        return (
          <ColCard
            title={<>PM Project Log <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({pmEntries.length})</span></>}
            right={
              <button className="btn btn-sm btn-primary" onClick={() => setPmLogModal(true)}>
                + Weekly Update
              </button>
            }
          >
            <div style={{ marginTop: 4 }}>
              {pmEntries.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 13 }}>No log entries yet. Add the first weekly update.</div>
              ) : (
                pmEntries.map(n => (
                  <div key={n.id} style={{
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid #2dd4bf',
                    borderRadius: 8, padding: 12, marginBottom: 8, background: 'var(--bg3)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>PM LOG</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(n.created_at)}</span>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }}
                          onClick={async () => {
                            if (!confirm('Delete this log entry?')) return
                            try {
                              await API.notes.delete(n.id)
                              setNotes(prev => prev.filter(x => x.id !== n.id))
                              toast('Entry deleted')
                            } catch (e) {
                              toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
                            }
                          }}
                        >✕</button>
                      </div>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)' }}>
                      {n.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ColCard>
        )
      })()}

      {/* PM Log modal */}
      {pmLogModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setPmLogModal(false)}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: '100%', maxWidth: 520,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>New Weekly PM Log Entry</div>
            <div className="form-grid">
              <div className="form-group full">
                <label>Week Of</label>
                <input type="date" value={pmLogWeek} onChange={e => setPmLogWeek(e.target.value)} />
              </div>
              <div className="form-group full">
                <label>Update / Staffing Notes <span style={{ color: 'var(--red)' }}>*</span></label>
                <textarea
                  rows={6}
                  autoFocus
                  placeholder="Who is on site, what was completed, issues encountered, next steps…"
                  value={pmLogText}
                  onChange={e => setPmLogText(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => { setPmLogModal(false); setPmLogText(''); setPmLogWeek('') }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={savePmLog} disabled={pmLogSaving || !pmLogText.trim()}>
                {pmLogSaving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Numbers */}
      <ColCard
        title={<>Job Numbers <span style={{ fontWeight: 400, color: 'var(--text3)' }}>({jobNumbers.length})</span></>}
        right={
          <button className="btn btn-sm btn-primary" onClick={() => setJobNumberModal(null)}>
            + Add Job #
          </button>
        }
      >
        <div style={{ marginTop: 4 }}>
          {jobNumbers.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No job numbers added yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {jobNumbers.map(j => (
                <div key={j.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '5px 10px',
                }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text)' }}>
                    {j.job_number}
                  </span>
                  {j.description && (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{j.description}</span>
                  )}
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '1px 6px', fontSize: 11 }}
                    onClick={() => setJobNumberModal(j)}
                  >✎</button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '1px 6px', fontSize: 11, color: 'var(--red)' }}
                    onClick={async () => {
                      if (!confirm('Delete this job number?')) return
                      try {
                        await API.jobNumbers.delete(id, j.id)
                        setJobNumbers(prev => prev.filter(x => x.id !== j.id))
                        toast('Job number deleted')
                      } catch (e) {
                        toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
                      }
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ColCard>

      {/* Modals */}
      {contactModal !== false && (
        <ContactModal
          contact={contactModal}
          siteId={id}
          onClose={() => setContactModal(false)}
          onSaved={saved => {
            setContacts(prev => contactModal?.id
              ? prev.map(c => c.id === saved.id ? saved : c)
              : [saved, ...prev]
            )
          }}
          onDeleted={deletedId => setContacts(prev => prev.filter(c => c.id !== deletedId))}
        />
      )}

      {noteModal !== false && (
        <SiteNoteModal
          note={noteModal}
          siteId={id}
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

      {issueModal !== false && (
        <IssueModal
          issue={issueModal}
          siteId={id}
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

      {csTicketModal !== false && (
        <CsTicketModal
          ticket={csTicketModal}
          siteId={id}
          onClose={() => setCsTicketModal(false)}
          onSaved={saved => {
            setServiceTickets(prev => csTicketModal?.id
              ? prev.map(t => t.id === saved.id ? saved : t)
              : [saved, ...prev]
            )
          }}
          onDeleted={deletedId => setServiceTickets(prev => prev.filter(t => t.id !== deletedId))}
        />
      )}

      {jobNumberModal !== false && (
        <JobNumberModal
          jobNumber={jobNumberModal}
          siteId={id}
          onClose={() => setJobNumberModal(false)}
          onSaved={saved => {
            setJobNumbers(prev => jobNumberModal?.id
              ? prev.map(j => j.id === saved.id ? saved : j)
              : [...prev, saved]
            )
          }}
          onDeleted={deletedId => setJobNumbers(prev => prev.filter(j => j.id !== deletedId))}
        />
      )}
    </div>
  )
}
