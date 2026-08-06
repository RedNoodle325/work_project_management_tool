'use client'

import { useState, useEffect, useMemo } from 'react'
import { API } from '../api'
import type { JobSchedule as ScheduleJob, Site, Technician, User } from '../types'
import { Modal } from '../components/Modal'
import { useToastFn } from '@/app/providers'

// ── Config ─────────────────────────────────────────────────────────────────────

const PRI_CONFIG: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: 'CRITICAL', bg: '#dc2626', color: '#fff' },
  2: { label: 'HIGH',     bg: '#ea580c', color: '#fff' },
  3: { label: 'MEDIUM',   bg: '#2563eb', color: '#fff' },
  4: { label: 'LOW',      bg: '#6b7280', color: '#fff' },
  5: { label: 'BACKLOG',  bg: '#374151', color: '#9ca3af' },
}

const TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  'PM Warranty':          { bg: '#dcfce7', color: '#16a34a' },
  'EXT Warranty':         { bg: '#bbf7d0', color: '#15803d' },
  'Startup':              { bg: '#dbeafe', color: '#1d4ed8' },
  'Startup and Warranty': { bg: '#ede9fe', color: '#7c3aed' },
  'Billable':             { bg: '#fef9c3', color: '#a16207' },
  'Special Project':      { bg: '#fce7f3', color: '#be185d' },
  'Sales Concession':     { bg: '#ffedd5', color: '#c2410c' },
  'Training':             { bg: '#e0f2fe', color: '#0369a1' },
  'Pre-startup':          { bg: '#f0fdf4', color: '#166534' },
  'Weekend Support':      { bg: '#fdf4ff', color: '#7e22ce' },
}

const JOB_TYPES = Object.keys(TYPE_CONFIG)

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Scheduled',   color: '#2563eb' },
  in_progress: { label: 'In Progress', color: '#d97706' },
  complete:    { label: 'Complete',    color: '#16a34a' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280' },
}

type FilterKey = 'all' | 'this_week' | 'next_week' | 'upcoming'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWeekBounds(offsetWeeks = 0): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7) + offsetWeeks * 7)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { start: mon, end: sun }
}

function fmtDateShort(dt?: string) {
  if (!dt) return '—'
  return new Date(dt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pmInitials(userId: string, users: User[]): string {
  const u = users.find(u => u.id === userId)
  if (!u) return '?'
  const parts = (u.name || u.email || '?').split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (u.name || u.email || '?').slice(0, 2).toUpperCase()
}

// ── Extended job type (API may return extra fields) ────────────────────────────

interface Job extends ScheduleJob {
  title?: string
  name?: string
  description?: string
  _techCount?: number
}

// ── Job Card ───────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: Job
  site?: Site
  users: User[]
  selected: boolean
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
}

function JobCard({ job, site, users, selected, onSelect, onEdit }: JobCardProps) {
  const pri = PRI_CONFIG[job.priority ?? 5] ?? PRI_CONFIG[5]
  const typeCfg = job.job_type ? (TYPE_CONFIG[job.job_type] ?? { bg: '#e5e7eb', color: '#374151' }) : null
  const statusCfg = STATUS_CONFIG[job.status ?? 'scheduled'] ?? STATUS_CONFIG.scheduled
  const techCount = job._techCount ?? 0

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        transition: 'background .12s', borderLeft: `3px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        background: selected ? 'var(--accent)11' : undefined,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg3)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ background: pri.bg, color: pri.color, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}>
          {pri.label}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {job.name || job.title || 'Untitled Job'}
        </span>
        <span
          onClick={onEdit}
          style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
          title="Edit job"
        >✏</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {site?.name ?? <span style={{ color: 'var(--text3)' }}>Unknown Site</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)' }}>
        {typeCfg && job.job_type && (
          <span style={{ background: typeCfg.bg, color: typeCfg.color, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
            {job.job_type}
          </span>
        )}
        <span style={{ background: `${statusCfg.color}22`, color: statusCfg.color, border: `1px solid ${statusCfg.color}44`, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
          {statusCfg.label}
        </span>
        <span style={{ flex: 1 }} />
        {job.start_date && (
          <span>{fmtDateShort(job.start_date)}{job.end_date ? ` → ${fmtDateShort(job.end_date)}` : ''}</span>
        )}
        {job.pm_user_id && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
            fontSize: 9, fontWeight: 800, flexShrink: 0,
          }} title="PM">
            {pmInitials(job.pm_user_id, users)}
          </span>
        )}
        {techCount > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{techCount} tech{techCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  )
}

// ── Job Modal ──────────────────────────────────────────────────────────────────

interface JobModalProps {
  job: Job | null
  sites: Site[]
  users: User[]
  onSave: (j: Job) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function JobModal({ job, sites, users, onSave, onDelete, onClose }: JobModalProps) {
  const toast = useToastFn()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(job?.name ?? job?.title ?? '')
  const [siteId, setSiteId] = useState(job?.site_id ?? '')
  const [jobType, setJobType] = useState(job?.job_type ?? '')
  const [priority, setPriority] = useState(String(job?.priority ?? '3'))
  const [status, setStatus] = useState(job?.status ?? 'scheduled')
  const [contractNumber, setContractNumber] = useState(job?.contract_number ?? '')
  const [pmUserId, setPmUserId] = useState(job?.pm_user_id ?? '')
  const [startDate, setStartDate] = useState(job?.start_date ?? '')
  const [endDate, setEndDate] = useState(job?.end_date ?? '')
  const [notes, setNotes] = useState(job?.notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast('Job name is required', 'error')
    setSaving(true)
    const data: Partial<Job> = {
      title: name.trim(),
      name: name.trim(),
      site_id: siteId || undefined,
      job_type: jobType || undefined,
      priority: priority ? parseInt(priority) : undefined,
      status,
      contract_number: contractNumber || undefined,
      pm_user_id: pmUserId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      description: notes || undefined,
    }
    try {
      let result: Job
      if (job) {
        result = await API.schedule.updateJob(job.id, data) as Job
        toast('Job updated')
      } else {
        result = await API.schedule.createJob(data) as Job
        toast('Job created')
      }
      onSave(result)
      onClose()
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!job) return
    if (!confirm('Delete this job? This cannot be undone.')) return
    try {
      await API.schedule.deleteJob(job.id)
      onDelete(job.id)
      toast('Job deleted')
      onClose()
    } catch (err: unknown) {
      toast('Error: ' + (err as Error).message, 'error')
    }
  }

  return (
    <Modal title={job ? 'Edit Job' : 'New Job'} onClose={onClose} maxWidth={560}>
      <form onSubmit={handleSubmit} style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Job Name *</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Enter job name" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Site</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)}>
              <option value="">—</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Job Type</label>
            <select value={jobType} onChange={e => setJobType(e.target.value)}>
              <option value="">—</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="">—</option>
              {[[1,'1 — Critical'],[2,'2 — High'],[3,'3 — Medium'],[4,'4 — Low'],[5,'5 — Backlog']].map(([v,l]) => (
                <option key={v} value={String(v)}>{String(l)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Contract Number</label>
          <input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="e.g. C-12345" />
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>PM</label>
          <select value={pmUserId} onChange={e => setPmUserId(e.target.value)}>
            <option value="">—</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Notes</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, gap: 8 }}>
          {job ? (
            <button type="button" className="btn btn-sm" onClick={handleDelete} style={{ color: 'var(--red)', borderColor: 'var(--red)', background: 'transparent' }}>Delete Job</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{job ? 'Save Changes' : 'Create Job'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Technician Manager Modal ───────────────────────────────────────────────────

interface TechManagerProps {
  techs: Technician[]
  onSave: (updated: Technician[]) => void
  onClose: () => void
}

function TechManagerModal({ techs, onSave, onClose }: TechManagerProps) {
  const toast = useToastFn()
  const [list, setList] = useState<Technician[]>(techs)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRegion, setNewRegion] = useState('')

  async function handleAdd() {
    if (!newName.trim()) return toast('Name required', 'error')
    try {
      const created = await API.schedule.createTech({ name: newName.trim(), email: newEmail || undefined, region: newRegion || undefined })
      const updated = [created, ...list]
      setList(updated)
      onSave(updated)
      setAdding(false)
      setNewName(''); setNewEmail(''); setNewRegion('')
      toast('Technician added')
    } catch (err: unknown) { toast('Error: ' + (err as Error).message, 'error') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this technician?')) return
    try {
      await API.schedule.deleteTech(id)
      const updated = list.filter(t => t.id !== id)
      setList(updated)
      onSave(updated)
      toast('Technician removed')
    } catch (err: unknown) { toast('Error: ' + (err as Error).message, 'error') }
  }

  return (
    <Modal title="Manage Technicians" onClose={onClose} maxWidth={500}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: 12 }}>
        {list.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
              {(t.email || t.region) && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{[t.email, t.region].filter(Boolean).join(' · ')}</div>}
            </div>
            <button className="btn btn-sm" onClick={() => handleDelete(t.id)} style={{ color: 'var(--red)', borderColor: 'var(--red)', background: 'transparent' }}>Remove</button>
          </div>
        ))}
        {list.length === 0 && <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 24 }}>No technicians yet</div>}
      </div>
      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12, background: 'var(--bg3)', borderRadius: 8 }}>
          <input placeholder="Name *" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            <input placeholder="Region" value={newRegion} onChange={e => setNewRegion(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ marginBottom: 12 }}>+ Add Technician</button>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

// ── Assignment Panel ───────────────────────────────────────────────────────────

interface AssignPanelProps {
  job: Job
  site?: Site
  allTechs: Technician[]
  techsForSite: Technician[]
  assignedTechs: Technician[]
  onAssign: (techId: string) => void
  onRemove: (techId: string) => void
  onEdit: () => void
}

function AssignPanel({ job, site, allTechs: _allTechs, assignedTechs, techsForSite, onAssign, onRemove, onEdit }: AssignPanelProps) {
  const [techSearch, setTechSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)

  const assignedIds = new Set(assignedTechs.map(t => t.id))
  let available = techsForSite.filter(t => !assignedIds.has(t.id))
  if (techSearch) {
    const q = techSearch.toLowerCase()
    available = available.filter(t => (t.name || '').toLowerCase().includes(q) || (t.region || '').toLowerCase().includes(q))
  }
  const visible = available.slice(0, visibleCount)
  const hasMore = available.length > visibleCount

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 16 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{job.name || job.title || 'Job'}</div>
          {site && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{site.name}</div>}
        </div>
        <button className="btn btn-sm btn-secondary" onClick={onEdit} style={{ fontSize: 11 }}>✏ Edit</button>
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', padding: '12px 16px 6px' }}>
        Assigned Techs ({assignedTechs.length})
      </div>
      <div style={{ minHeight: 40 }}>
        {assignedTechs.length === 0 ? (
          <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No technicians assigned yet</div>
        ) : assignedTechs.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{t.name || '—'}</div>
              {t.region && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{t.region}</div>}
            </div>
            <button
              className="btn btn-sm"
              onClick={() => onRemove(t.id)}
              style={{ color: 'var(--red)', borderColor: 'var(--red)', background: 'transparent', padding: '2px 8px', fontSize: 11 }}
            >×</button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', padding: '16px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Available Technicians</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{available.length} found</span>
      </div>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        <input
          placeholder="Search by name or location…"
          value={techSearch}
          onChange={e => { setTechSearch(e.target.value); setVisibleCount(20) }}
          style={{ width: '100%', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }}
        />
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 420 }}>
        {visible.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No available technicians found</div>
        ) : visible.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{t.name || '—'}</div>
              {t.region && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{t.region}</div>}
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => onAssign(t.id)} style={{ padding: '3px 10px', fontSize: 11 }}>+ Assign</button>
          </div>
        ))}
        {hasMore && (
          <div style={{ padding: 10, textAlign: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setVisibleCount(v => v + 20)} style={{ fontSize: 11 }}>
              Load {Math.min(20, available.length - visibleCount)} more…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function Schedule() {
  const toast = useToastFn()

  const [jobs, setJobs] = useState<Job[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [techs, setTechs] = useState<Technician[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [assignedTechs, setAssignedTechs] = useState<Technician[]>([])
  const [techsForSite, setTechsForSite] = useState<Technician[]>([])

  const [editingJob, setEditingJob] = useState<Job | null | undefined>(undefined)
  const [showTechManager, setShowTechManager] = useState(false)

  useEffect(() => {
    Promise.all([
      API.sites.list().catch(() => [] as Site[]),
      API.schedule.listTechs().catch(() => [] as Technician[]),
      API.auth.listUsers().catch(() => [] as User[]),
    ]).then(([s, t, u]) => {
      setSites(s)
      setTechs(t)
      setUsers(u)
    }).finally(() => {
      loadJobs()
    })
  }, [])

  async function loadJobs() {
    try {
      const loaded = await API.schedule.listJobs()
      setJobs(loaded as Job[])
    } catch (err: unknown) {
      toast('Failed to load jobs: ' + (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const siteMap = useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites])

  const filteredJobs = useMemo(() => {
    let list = jobs
    if (activeFilter !== 'all') {
      if (activeFilter === 'this_week') {
        const { start, end } = getWeekBounds(0)
        list = list.filter(j => { const d = j.start_date ? new Date(j.start_date) : null; return d && d >= start && d <= end })
      } else if (activeFilter === 'next_week') {
        const { start, end } = getWeekBounds(1)
        list = list.filter(j => { const d = j.start_date ? new Date(j.start_date) : null; return d && d >= start && d <= end })
      } else if (activeFilter === 'upcoming') {
        const { end } = getWeekBounds(1)
        list = list.filter(j => { const d = j.start_date ? new Date(j.start_date) : null; return d && d > end })
      }
    }
    return [...list].sort((a, b) => {
      const pa = (a as Job).priority ?? 5, pb = (b as Job).priority ?? 5
      if (pa !== pb) return pa - pb
      const da = a.start_date ?? '', db = b.start_date ?? ''
      return da < db ? -1 : da > db ? 1 : 0
    })
  }, [jobs, activeFilter])

  async function selectJob(jobId: string) {
    setSelectedJobId(jobId)
    const job = jobs.find(j => j.id === jobId) as Job | undefined
    try {
      const siteT = job?.site_id ? await API.schedule.getTechsForSite(job.site_id).catch(() => techs) : techs
      setTechsForSite(siteT)
      // Use technician_ids from job if available
      const ids = job?.technician_ids ?? []
      setAssignedTechs(techs.filter(t => ids.includes(t.id)))
    } catch {
      setTechsForSite(techs)
      setAssignedTechs([])
    }
  }

  async function handleAssign(techId: string) {
    if (!selectedJobId) return
    const job = jobs.find(j => j.id === selectedJobId) as Job | undefined
    if (!job) return
    const newIds = [...(job.technician_ids ?? []), techId]
    try {
      const updated = await API.schedule.updateJob(selectedJobId, { technician_ids: newIds }) as Job
      setJobs(prev => prev.map(j => j.id === selectedJobId ? { ...j, ...updated, _techCount: newIds.length } : j))
      setAssignedTechs(prev => [...prev, techs.find(t => t.id === techId)!].filter(Boolean))
      toast('Technician assigned')
    } catch (err: unknown) { toast('Error: ' + (err as Error).message, 'error') }
  }

  async function handleRemove(techId: string) {
    if (!selectedJobId) return
    const job = jobs.find(j => j.id === selectedJobId) as Job | undefined
    if (!job) return
    const newIds = (job.technician_ids ?? []).filter(id => id !== techId)
    try {
      const updated = await API.schedule.updateJob(selectedJobId, { technician_ids: newIds }) as Job
      setJobs(prev => prev.map(j => j.id === selectedJobId ? { ...j, ...updated, _techCount: newIds.length } : j))
      setAssignedTechs(prev => prev.filter(t => t.id !== techId))
      toast('Technician removed')
    } catch (err: unknown) { toast('Error: ' + (err as Error).message, 'error') }
  }

  const selectedJob = selectedJobId ? (jobs.find(j => j.id === selectedJobId) as Job) : null

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40, textAlign: 'center' }}>Loading…</div>

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'this_week', label: 'This Week' },
    { key: 'next_week', label: 'Next Week' },
    { key: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Schedule</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Dispatch &amp; Job Assignment</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowTechManager(true)}>Manage Techs</button>
          <button className="btn btn-primary" onClick={() => setEditingJob(null)}>+ New Job</button>
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'clamp(300px, 380px, 40%) 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Job Queue */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Job Queue</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 16px', background: 'var(--bg)' }}>
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                style={{
                  padding: '8px 12px', fontSize: 11, fontWeight: 600,
                  color: activeFilter === tab.key ? 'var(--accent)' : 'var(--text3)',
                  cursor: 'pointer', border: 'none', background: 'none',
                  borderBottom: `2px solid ${activeFilter === tab.key ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: -1, transition: 'color .15s, border-color .15s', whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            {filteredJobs.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No jobs{activeFilter !== 'all' ? ' in this period' : ''}</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>Add a job with the "+ New Job" button</div>
              </div>
            ) : filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job as Job}
                site={job.site_id ? siteMap[job.site_id] : undefined}
                users={users}
                selected={job.id === selectedJobId}
                onSelect={() => selectJob(job.id)}
                onEdit={e => { e.stopPropagation(); setEditingJob(job as Job) }}
              />
            ))}
          </div>
        </div>

        {/* Right: Assignment Panel */}
        {selectedJob ? (
          <AssignPanel
            job={selectedJob}
            site={selectedJob.site_id ? siteMap[selectedJob.site_id] : undefined}
            allTechs={techs}
            techsForSite={techsForSite}
            assignedTechs={assignedTechs}
            onAssign={handleAssign}
            onRemove={handleRemove}
            onEdit={() => setEditingJob(selectedJob)}
          />
        ) : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Select a job to assign technicians</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>Click any job in the queue to manage assignments</div>
            </div>
          </div>
        )}
      </div>

      {/* Job Modal */}
      {editingJob !== undefined && (
        <JobModal
          job={editingJob}
          sites={sites}
          users={users}
          onSave={saved => {
            setJobs(prev => {
              const idx = prev.findIndex(j => j.id === saved.id)
              return idx >= 0 ? prev.map((j, i) => i === idx ? saved : j) : [...prev, saved]
            })
          }}
          onDelete={id => {
            setJobs(prev => prev.filter(j => j.id !== id))
            if (selectedJobId === id) { setSelectedJobId(null); setAssignedTechs([]) }
          }}
          onClose={() => setEditingJob(undefined)}
        />
      )}

      {/* Tech Manager */}
      {showTechManager && (
        <TechManagerModal
          techs={techs}
          onSave={setTechs}
          onClose={() => setShowTechManager(false)}
        />
      )}
    </div>
  )
}
