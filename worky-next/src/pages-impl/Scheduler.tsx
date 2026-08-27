'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutDashboard, ListChecks, LockKeyhole, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { V2 } from '@/api/v2'
import { Ops } from '@/api/ops'
import type { JobSchedule, JobStatus, Technician } from '@/types/ops'
import type { SiteSummaryV2 } from '@/types/v2'

const JOB_TYPES = ['Warranty', 'Service', 'Install', 'Commissioning', 'PM', 'Emergency', 'Other']
const STATUSES: JobStatus[] = ['scheduled', 'in_progress', 'on_hold', 'complete', 'cancelled']
const STATUS_LABELS: Record<JobStatus, string> = { scheduled: 'Scheduled', in_progress: 'In progress', on_hold: 'On hold', complete: 'Complete', cancelled: 'Cancelled' }
const TECH_COLORS = ['#622c90', '#009a66', '#28b6ea', '#c77b16', '#b93b4d', '#2d8caa', '#4d9b69', '#8a4fb0']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toISODate(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function startOfWeek(date: Date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; return addDays(d, -day) }
function jobActiveOn(job: JobSchedule, date: Date) {
  const iso = toISODate(date)
  if (job.start_date && iso < job.start_date) return false
  if (job.end_date && iso > job.end_date) return false
  if (!job.start_date && !job.end_date) return false
  return true
}
function techColor(tech: { id: string; color?: string } | undefined, technicians: Technician[]) {
  if (tech?.color) return tech.color
  const idx = technicians.findIndex(t => t.id === tech?.id)
  return TECH_COLORS[idx >= 0 ? idx % TECH_COLORS.length : 0]
}

export function Scheduler() {
  const { user } = useAuth()
  const canEdit = !!user
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [jobs, setJobs] = useState<JobSchedule[]>([])
  const [sites, setSites] = useState<SiteSummaryV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'calendar' | 'orders'>('calendar')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showTechs, setShowTechs] = useState(false)
  const [editJob, setEditJob] = useState<JobSchedule | 'new' | null>(null)
  const [orderFilter, setOrderFilter] = useState<{ status: string; siteId: string }>({ status: '', siteId: '' })

  function load() {
    Promise.all([Ops.technicians.list(), Ops.jobSchedule.list(), V2.hierarchy.list()])
      .then(([techRows, jobRows, hierarchy]) => {
        setTechnicians(techRows)
        setJobs(jobRows)
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

  const activeTechs = useMemo(() => technicians.filter(t => t.is_active), [technicians])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekJobs = useMemo(() => jobs.filter(job => weekDays.some(day => jobActiveOn(job, day))), [jobs, weekDays])
  const unassigned = useMemo(() => weekJobs.filter(job => job.technicians.length < job.techs_needed), [weekJobs])

  const filteredOrders = useMemo(() => jobs.filter(job =>
    (!orderFilter.siteId || job.site_id === orderFilter.siteId) &&
    (!orderFilter.status || job.status === orderFilter.status)
  ), [jobs, orderFilter])

  return <div className="x-page x-scheduler-ops-page">
    <div className="x-scheduler-standalone-bar">
      <img src="/brand/xnrgy-mark.svg" alt="XNRGY" />
      {user
        ? <Link href="/dashboard"><LayoutDashboard size={14} /> Back to dashboard</Link>
        : <Link href="/login?next=/scheduler"><LockKeyhole size={14} /> Login to manage everything</Link>}
    </div>
    <header className="x-directory-head">
      <div><span className="x-kicker">Scheduler &amp; work orders</span><h1>Scheduler</h1><p>Assign technicians to sites by week, and manage every work order in one place.</p></div>
      {canEdit && <div className="x-issue-actions">
        <button onClick={() => setShowTechs(true)}><Users size={16} /> Technicians</button>
        <button className="primary" onClick={() => setEditJob('new')}><Plus size={16} /> New work order</button>
      </div>}
    </header>

    <div className="x-tabs" style={{ position: 'static', margin: 0 }}>
      <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}><CalendarDays size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Calendar</button>
      <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ListChecks size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Work orders<span>{jobs.length}</span></button>
    </div>

    {error && <div className="x-load-panel"><strong>Couldn&apos;t load the scheduler</strong><p>{error}</p></div>}
    {!error && loading && <div className="x-state"><h1>Loading scheduler</h1><p>Gathering technicians and work orders…</p></div>}

    {!error && !loading && tab === 'calendar' && <div className="x-sched-calendar-wrap">
      <div className="x-sched-toolbar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={16} /></button>
        <strong>Week of {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={16} /></button>
        <button className="x-sched-today" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
      </div>

      {activeTechs.length === 0 && <div className="x-resource-empty"><Users size={30} /><strong>No technicians yet</strong><p>Add your technicians so you can assign them to sites.</p>{canEdit && <button onClick={() => setShowTechs(true)}><Plus size={15} /> Add technicians</button>}</div>}

      {activeTechs.length > 0 && <div className="x-sched-grid" style={{ gridTemplateColumns: `180px repeat(7, 1fr)` }}>
        <div className="x-sched-corner" />
        {weekDays.map(day => <div className="x-sched-daylabel" key={toISODate(day)}>{DAY_NAMES[(day.getDay() + 6) % 7]}<span>{day.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span></div>)}
        {activeTechs.map(tech => <div className="x-sched-row" key={tech.id}>
          <div className="x-sched-tech"><i style={{ background: techColor(tech, technicians) }} />{tech.name}<small>{[tech.location_city, tech.location_state].filter(Boolean).join(', ') || 'No home base set'}</small></div>
          {weekDays.map(day => {
            const dayJobs = weekJobs.filter(job => job.technicians.some(t => t.id === tech.id) && jobActiveOn(job, day))
            return <div className="x-sched-cell" key={toISODate(day)}>
              {dayJobs.map(job => <button key={job.id} className="x-sched-chip" style={{ borderLeftColor: techColor(tech, technicians) }} onClick={() => canEdit && setEditJob(job)} title={job.job_name}>
                <strong>{job.site_name}</strong><small>{job.job_type}</small>
              </button>)}
            </div>
          })}
        </div>)}
      </div>}

      {unassigned.length > 0 && <div className="x-sched-unassigned">
        <h2>Needs a technician this week</h2>
        {unassigned.map(job => <button key={job.id} className="x-sched-unassigned-row" onClick={() => canEdit && setEditJob(job)}>
          <strong>{job.job_name}</strong><span>{job.site_name} · {job.job_type}</span>
          <em>{job.technicians.length}/{job.techs_needed} assigned</em>
        </button>)}
      </div>}
    </div>}

    {!error && !loading && tab === 'orders' && <div className="x-sched-orders">
      <div className="x-issue-toolbar">
        <select value={orderFilter.siteId} onChange={e => setOrderFilter(f => ({ ...f, siteId: e.target.value }))}><option value="">All sites</option>{sites.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select>
        <select value={orderFilter.status} onChange={e => setOrderFilter(f => ({ ...f, status: e.target.value }))}><option value="">All statuses</option>{STATUSES.map(s => <option value={s} key={s}>{STATUS_LABELS[s]}</option>)}</select>
        <span>{filteredOrders.length} work orders</span>
      </div>
      <div className="x-lean-issues x-work-orders">
        <div className="x-work-order-head"><span>Work order</span><span>Site</span><span>Dates</span><span>Techs</span><span>Status</span><span /></div>
        {filteredOrders.map(job => <div className="x-work-order-row" key={job.id}>
          <span><strong>{job.job_name}</strong><small>{job.job_type}{job.contract_number ? ` · ${job.contract_number}` : ''}</small></span>
          <span>{job.site_name}<small>{[job.site_city, job.site_state].filter(Boolean).join(', ')}</small></span>
          <span>{job.start_date ? new Date(job.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}{job.end_date ? ` – ${new Date(job.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</span>
          <span className="x-work-order-techs">{job.technicians.length ? job.technicians.map(t => <b key={t.id} style={{ background: techColor(t, technicians) }} title={t.name}>{t.name.split(' ').map(p => p[0]).join('').slice(0, 2)}</b>) : <em>Unassigned</em>}</span>
          <span><em className={`x-wo-status is-${job.status}`}>{STATUS_LABELS[job.status]}</em></span>
          <span>{canEdit && <button className="x-issue-icon-action" onClick={() => setEditJob(job)} title="Edit"><Pencil size={14} /></button>}</span>
        </div>)}
        {!filteredOrders.length && <div className="x-resource-empty"><ListChecks size={30} /><strong>No work orders found</strong><p>Create one to start tracking site work.</p>{canEdit && <button onClick={() => setEditJob('new')}><Plus size={15} /> New work order</button>}</div>}
      </div>
    </div>}

    {showTechs && <TechniciansModal technicians={technicians} close={() => setShowTechs(false)} changed={load} />}
    {editJob && <JobModal job={editJob === 'new' ? null : editJob} sites={sites} technicians={activeTechs} close={() => setEditJob(null)} saved={() => { setEditJob(null); load() }} />}
  </div>
}

function TechniciansModal({ technicians, close, changed }: { technicians: Technician[]; close: () => void; changed: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Technician | null>(null)
  const [error, setError] = useState('')

  async function toggleActive(tech: Technician) {
    try { await Ops.technicians.update(tech.id, { is_active: !tech.is_active }); changed() }
    catch (err) { setError((err as Error).message) }
  }
  async function remove(tech: Technician) {
    if (!confirm(`Remove ${tech.name} from the technician roster?`)) return
    try { await Ops.technicians.delete(tech.id); changed() }
    catch (err) { setError((err as Error).message) }
  }

  return <div className="x-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <div className="x-modal x-modal-wide">
      <header><div><span className="x-kicker">Field team</span><h2>Technicians</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
      {error && <p className="x-error">{error}</p>}
      <div className="x-tech-list">
        {technicians.map(tech => <div className="x-tech-row" key={tech.id}>
          <div><strong>{tech.name}</strong><small>{[tech.location_city, tech.location_state].filter(Boolean).join(', ') || 'No home base set'}{tech.phone ? ` · ${tech.phone}` : ''}</small></div>
          <div className="x-tech-row-actions">
            <button onClick={() => toggleActive(tech)}>{tech.is_active ? 'Deactivate' : 'Reactivate'}</button>
            <button onClick={() => setEditing(tech)}><Pencil size={13} /></button>
            <button onClick={() => remove(tech)}><Trash2 size={13} /></button>
          </div>
        </div>)}
        {!technicians.length && <p className="x-import-intro">No technicians yet — add your first one below.</p>}
      </div>
      {!adding && !editing && <button className="x-resource-add" onClick={() => setAdding(true)}><Plus size={15} /> Add technician</button>}
      {(adding || editing) && <TechnicianForm technician={editing} cancel={() => { setAdding(false); setEditing(null) }} saved={() => { setAdding(false); setEditing(null); changed() }} />}
    </div>
  </div>
}

function TechnicianForm({ technician, cancel, saved }: { technician: Technician | null; cancel: () => void; saved: () => void }) {
  const [form, setForm] = useState({
    name: technician?.name || '', phone: technician?.phone || '', email: technician?.email || '',
    location_city: technician?.location_city || '', location_state: technician?.location_state || '', notes: technician?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [field]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (technician) await Ops.technicians.update(technician.id, form)
      else await Ops.technicians.create(form)
      saved()
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  return <form className="x-tech-form" onSubmit={submit}>
    <div className="x-form-row"><label className="x-field"><span>Name</span><input value={form.name} onChange={e => set('name')(e.target.value)} required /></label><label className="x-field"><span>Phone</span><input value={form.phone} onChange={e => set('phone')(e.target.value)} /></label></div>
    <div className="x-form-row"><label className="x-field"><span>Home city</span><input value={form.location_city} onChange={e => set('location_city')(e.target.value)} /></label><label className="x-field"><span>Home state</span><input value={form.location_state} onChange={e => set('location_state')(e.target.value)} maxLength={2} /></label></div>
    <label className="x-field"><span>Email</span><input type="email" value={form.email} onChange={e => set('email')(e.target.value)} /></label>
    <label className="x-field"><span>Notes</span><textarea rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>
    {error && <p className="x-error">{error}</p>}
    <footer><button type="button" onClick={cancel}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : technician ? 'Save changes' : 'Add technician'}</button></footer>
  </form>
}

function JobModal({ job, sites, technicians, close, saved }: { job: JobSchedule | null; sites: SiteSummaryV2[]; technicians: Technician[]; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({
    site_id: job?.site_id || '', job_name: job?.job_name || '', job_type: job?.job_type || 'Warranty',
    contract_number: job?.contract_number || '', priority: job?.priority ?? 3, start_date: job?.start_date || '', end_date: job?.end_date || '',
    status: job?.status || 'scheduled', scope: job?.scope || '', notes: job?.notes || '', techs_needed: job?.techs_needed ?? 1,
  })
  const [technicianIds, setTechnicianIds] = useState<string[]>(job?.technicians.map(t => t.id) || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(field: K) => (value: typeof form[K]) => setForm(current => ({ ...current, [field]: value }))

  function toggleTech(id: string) {
    setTechnicianIds(current => current.includes(id) ? current.filter(t => t !== id) : [...current, id])
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, technician_ids: technicianIds }
      if (job) await Ops.jobSchedule.update(job.id, payload)
      else await Ops.jobSchedule.create(payload)
      saved()
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  async function remove() {
    if (!job || !confirm('Delete this work order? This cannot be undone.')) return
    setSaving(true)
    try { await Ops.jobSchedule.delete(job.id); saved() }
    catch (err) { setError((err as Error).message); setSaving(false) }
  }

  return <div className="x-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <form className="x-modal x-modal-wide" onSubmit={submit}>
      <header><div><span className="x-kicker">{job ? 'Edit' : 'New'} work order</span><h2>{job ? job.job_name : 'New work order'}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
      <label className="x-field"><span>Site</span><select value={form.site_id} onChange={e => set('site_id')(e.target.value)} required><option value="">Choose a site</option>{sites.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
      <label className="x-field"><span>Job name</span><input value={form.job_name} onChange={e => set('job_name')(e.target.value)} required placeholder="e.g. Q3 PM visit, RTU-4 warranty repair" /></label>
      <div className="x-form-row">
        <label className="x-field"><span>Type</span><select value={form.job_type} onChange={e => set('job_type')(e.target.value)}>{JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label className="x-field"><span>Priority (1 highest–5 lowest)</span><input type="number" min={1} max={5} value={form.priority} onChange={e => set('priority')(Number(e.target.value))} /></label>
      </div>
      <div className="x-form-row">
        <label className="x-field"><span>Start date</span><input type="date" value={form.start_date} onChange={e => set('start_date')(e.target.value)} /></label>
        <label className="x-field"><span>End date</span><input type="date" value={form.end_date} onChange={e => set('end_date')(e.target.value)} /></label>
      </div>
      <div className="x-form-row">
        <label className="x-field"><span>Status</span><select value={form.status} onChange={e => set('status')(e.target.value as JobStatus)}>{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <label className="x-field"><span>Technicians needed</span><input type="number" min={1} value={form.techs_needed} onChange={e => set('techs_needed')(Number(e.target.value))} /></label>
      </div>
      <label className="x-field"><span>Contract / PO number</span><input value={form.contract_number} onChange={e => set('contract_number')(e.target.value)} /></label>
      <label className="x-field"><span>Scope of work</span><textarea rows={3} value={form.scope} onChange={e => set('scope')(e.target.value)} /></label>
      <label className="x-field"><span>Notes</span><textarea rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>
      <label className="x-field"><span>Assign technicians</span>
        <div className="x-tech-picker">{technicians.map(tech => <label key={tech.id} className={technicianIds.includes(tech.id) ? 'is-picked' : ''}>
          <input type="checkbox" checked={technicianIds.includes(tech.id)} onChange={() => toggleTech(tech.id)} />{tech.name}
        </label>)}{!technicians.length && <small>No active technicians yet.</small>}</div>
      </label>
      {error && <p className="x-error">{error}</p>}
      <footer>
        {job && <button type="button" onClick={remove} className="x-danger-text"><Trash2 size={13} /> Delete</button>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={close}>Cancel</button>
        <button className="primary" disabled={saving}>{saving ? 'Saving…' : job ? 'Save changes' : 'Create work order'}</button>
      </footer>
    </form>
  </div>
}
