'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ListChecks, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { V2 } from '@/api/v2'
import { Ops } from '@/api/ops'
import type { JobAssignmentLine, JobSchedule, JobStatus, Technician, TechnicianCalendarEvent, TechnicianEventType } from '@/types/ops'
import type { SiteSummaryV2 } from '@/types/v2'

const JOB_TYPES = ['Warranty', 'Billable service', 'Billable startup', 'Other']
const STATUSES: JobStatus[] = ['scheduled', 'in_progress', 'on_hold', 'closed', 'cancelled']
const STATUS_LABELS: Record<JobStatus, string> = { scheduled: 'Scheduled', in_progress: 'In progress', on_hold: 'On hold', closed: 'Closed', cancelled: 'Cancelled' }
const TECH_COLORS = ['#622c90', '#009a66', '#28b6ea', '#c77b16', '#b93b4d', '#2d8caa', '#4d9b69', '#8a4fb0']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EVENT_LABELS: Record<TechnicianEventType, string> = { day_off: 'Day off', travel: 'Travel', holiday: 'Holiday', pto: 'PTO' }

function toISODate(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function startOfWeek(date: Date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; return addDays(d, -day) }
function lineActiveOn(line: JobAssignmentLine, date: Date) {
  const iso = toISODate(date)
  return iso >= line.start_date && iso <= line.end_date
}
function eventActiveOn(event: TechnicianCalendarEvent, date: Date) {
  const iso = toISODate(date)
  return iso >= event.start_date && iso <= event.end_date
}
function techColor(tech: { id: string; color?: string } | undefined, technicians: Technician[]) {
  if (tech?.color) return tech.color
  const idx = technicians.findIndex(t => t.id === tech?.id)
  return TECH_COLORS[idx >= 0 ? idx % TECH_COLORS.length : 0]
}
function technicianName(tech: Pick<Technician, 'name' | 'first_name' | 'last_name'>) {
  return [tech.first_name, tech.last_name].filter(Boolean).join(' ') || tech.name
}

export function Scheduler() {
  const canEdit = true
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [jobs, setJobs] = useState<JobSchedule[]>([])
  const [events, setEvents] = useState<TechnicianCalendarEvent[]>([])
  const [sites, setSites] = useState<SiteSummaryV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'calendar' | 'orders'>('calendar')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showTechs, setShowTechs] = useState(false)
  const [editJob, setEditJob] = useState<JobSchedule | 'new' | null>(null)
  const [editEvent, setEditEvent] = useState<TechnicianCalendarEvent | 'new' | null>(null)
  const [orderFilter, setOrderFilter] = useState<{ status: string; siteId: string }>({ status: '', siteId: '' })

  function load() {
    Promise.all([Ops.technicians.list(), Ops.jobSchedule.list(), Ops.technicianEvents.list(), V2.hierarchy.list()])
      .then(([techRows, jobRows, eventRows, hierarchy]) => {
        setTechnicians(techRows)
        setJobs(jobRows)
        setEvents(eventRows)
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
  const weekAssignments = useMemo(() => jobs.flatMap(job => job.assignment_lines.map(line => ({ job, line }))).filter(({ line }) => weekDays.some(day => lineActiveOn(line, day))), [jobs, weekDays])
  const unassigned = useMemo(() => weekAssignments.filter(({ line }) => line.technicians.length < line.techs_needed), [weekAssignments])

  const filteredOrders = useMemo(() => jobs.filter(job =>
    (!orderFilter.siteId || job.site_id === orderFilter.siteId) &&
    (!orderFilter.status || job.status === orderFilter.status)
  ), [jobs, orderFilter])

  return <div className="x-page x-scheduler-ops-page">
    <header className="x-directory-head">
      <div><span className="x-kicker">Scheduler &amp; work orders</span><h1>Scheduler</h1><p>Assign technicians to sites by week, and manage every work order in one place.</p></div>
      {canEdit && <div className="x-issue-actions">
        <button onClick={() => setShowTechs(true)}><Users size={16} /> Technicians</button>
        <button onClick={() => setEditEvent('new')}><CalendarPlus size={16} /> Time off / travel</button>
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
          <div className="x-sched-tech"><i style={{ background: techColor(tech, technicians) }} />{technicianName(tech)}<small>{tech.home_zip ? `Home ZIP ${tech.home_zip}` : [tech.location_city, tech.location_state].filter(Boolean).join(', ') || 'No home ZIP set'}</small></div>
          {weekDays.map(day => {
            const dayAssignments = weekAssignments.filter(({ line }) => line.technicians.some(t => t.id === tech.id) && lineActiveOn(line, day))
            const dayEvents = events.filter(event => (!event.technician_id || event.technician_id === tech.id) && eventActiveOn(event, day))
            return <div className="x-sched-cell" key={toISODate(day)}>
              {dayEvents.map(event => <button key={event.id} className={`x-sched-event is-${event.event_type}`} onClick={() => setEditEvent(event)} title={`${EVENT_LABELS[event.event_type]}${event.title ? `: ${event.title}` : ''}`}><strong>{event.title || EVENT_LABELS[event.event_type]}</strong></button>)}
              {dayAssignments.map(({ job, line }) => <button key={line.id} className="x-sched-chip" style={{ borderLeftColor: techColor(tech, technicians) }} onClick={() => canEdit && setEditJob(job)} title={`${job.work_order_number} · Line ${line.line_number} · ${job.job_name}`}>
                <strong>{job.site_name}</strong><small>{job.work_order_number} · L{line.line_number}</small>
              </button>)}
            </div>
          })}
        </div>)}
      </div>}

      {unassigned.length > 0 && <div className="x-sched-unassigned">
        <h2>Needs a technician this week</h2>
        {unassigned.map(({ job, line }) => <button key={line.id} className="x-sched-unassigned-row" onClick={() => canEdit && setEditJob(job)}>
          <strong>{job.work_order_number} · Line {line.line_number}</strong><span>{job.site_name} · {job.job_name}</span>
          <em>{line.technicians.length}/{line.techs_needed} assigned</em>
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
          <span><strong>{job.work_order_number}</strong><small>{job.job_name} · {job.job_type}{job.contract_number ? ` · ${job.contract_number}` : ''}</small></span>
          <span>{job.site_name}<small>{[job.site_city, job.site_state].filter(Boolean).join(', ')}</small></span>
          <span>{job.start_date ? new Date(`${job.start_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No visits yet'}{job.end_date ? ` – ${new Date(`${job.end_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}<small>{job.assignment_lines.length} assignment {job.assignment_lines.length === 1 ? 'line' : 'lines'}</small></span>
          <span className="x-work-order-techs">{job.technicians.length ? job.technicians.map(t => <b key={t.id} style={{ background: techColor(t, technicians) }} title={t.name}>{t.name.split(' ').map(p => p[0]).join('').slice(0, 2)}</b>) : <em>Unassigned</em>}</span>
          <span><em className={`x-wo-status is-${job.status}`}>{STATUS_LABELS[job.status]}</em></span>
          <span>{canEdit && <button className="x-issue-icon-action" onClick={() => setEditJob(job)} title="Edit"><Pencil size={14} /></button>}</span>
        </div>)}
        {!filteredOrders.length && <div className="x-resource-empty"><ListChecks size={30} /><strong>No work orders found</strong><p>Create one to start tracking site work.</p>{canEdit && <button onClick={() => setEditJob('new')}><Plus size={15} /> New work order</button>}</div>}
      </div>
    </div>}

    {showTechs && <TechniciansModal technicians={technicians} close={() => setShowTechs(false)} changed={load} />}
    {editJob && <JobModal job={editJob === 'new' ? null : editJob} sites={sites} technicians={activeTechs} events={events} close={() => { setEditJob(null); load() }} changed={load} />}
    {editEvent && <TechnicianEventModal event={editEvent === 'new' ? null : editEvent} technicians={activeTechs} close={() => setEditEvent(null)} saved={() => { setEditEvent(null); load() }} />}
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
    if (!confirm(`Remove ${technicianName(tech)} from the technician roster?`)) return
    try { await Ops.technicians.delete(tech.id); changed() }
    catch (err) { setError((err as Error).message) }
  }

  return <div className="x-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <div className="x-modal x-modal-wide">
      <header><div><span className="x-kicker">Field team</span><h2>Technicians</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
      {error && <p className="x-error">{error}</p>}
      <div className="x-tech-list">
        {technicians.map(tech => <div className="x-tech-row" key={tech.id}>
          <div><strong>{technicianName(tech)}</strong><small>{tech.home_zip ? `Home ZIP ${tech.home_zip}` : 'No home ZIP set'}{[tech.location_city, tech.location_state].filter(Boolean).length ? ` · ${[tech.location_city, tech.location_state].filter(Boolean).join(', ')}` : ''}{tech.phone ? ` · ${tech.phone}` : ''}</small></div>
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
  const legacyParts = (technician?.name || '').trim().split(/\s+/)
  const [form, setForm] = useState({
    first_name: technician?.first_name || legacyParts[0] || '', last_name: technician?.last_name || legacyParts.slice(1).join(' '),
    phone: technician?.phone || '', email: technician?.email || '', home_zip: technician?.home_zip || '', notes: technician?.notes || '',
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
    <div className="x-form-row"><label className="x-field"><span>First name</span><input value={form.first_name} onChange={e => set('first_name')(e.target.value)} required /></label><label className="x-field"><span>Last name</span><input value={form.last_name} onChange={e => set('last_name')(e.target.value)} required /></label></div>
    <div className="x-form-row"><label className="x-field"><span>Home ZIP</span><input inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" value={form.home_zip} onChange={e => set('home_zip')(e.target.value)} placeholder="e.g. 21201" required /></label><label className="x-field"><span>Phone</span><input value={form.phone} onChange={e => set('phone')(e.target.value)} /></label></div>
    <label className="x-field"><span>Email</span><input type="email" value={form.email} onChange={e => set('email')(e.target.value)} /></label>
    <label className="x-field"><span>Notes</span><textarea rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>
    {error && <p className="x-error">{error}</p>}
    <footer><button type="button" onClick={cancel}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : technician ? 'Save changes' : 'Add technician'}</button></footer>
  </form>
}

function LegacyJobModal({ job, sites, technicians, events, close, saved }: { job: JobSchedule | null; sites: SiteSummaryV2[]; technicians: Technician[]; events: TechnicianCalendarEvent[]; close: () => void; saved: () => void }) {
  const [siteOptions, setSiteOptions] = useState(sites)
  const [form, setForm] = useState({
    site_id: job?.site_id || '', job_name: job?.job_name || '', job_type: job?.job_type || 'Warranty',
    contract_number: job?.contract_number || '', priority: job?.priority ?? 3, start_date: job?.start_date || '', end_date: job?.end_date || '',
    status: job?.status || 'scheduled', scope: job?.scope || '', notes: job?.notes || '', techs_needed: job?.techs_needed ?? 1,
  })
  const [technicianIds, setTechnicianIds] = useState<string[]>(job?.technicians.map(t => t.id) || [])
  const [siteTechnicians, setSiteTechnicians] = useState<{ siteId: string; rows: Technician[] } | null>(null)
  const [showSiteCreator, setShowSiteCreator] = useState(false)
  const [projectNumber, setProjectNumber] = useState('')
  const [siteZip, setSiteZip] = useState('')
  const [creatingSite, setCreatingSite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(field: K) => (value: typeof form[K]) => setForm(current => ({ ...current, [field]: value }))

  useEffect(() => {
    if (!form.site_id) return
    let current = true
    Ops.technicians.forSite(form.site_id)
      .then(rows => { if (current) setSiteTechnicians({ siteId: form.site_id, rows }) })
      .catch(() => undefined)
    return () => { current = false }
  }, [form.site_id])

  const assignmentTechs = siteTechnicians?.siteId === form.site_id ? siteTechnicians.rows : technicians

  function conflictFor(technicianId: string) {
    if (!form.start_date) return null
    const end = form.end_date || form.start_date
    return events.find(event => (!event.technician_id || event.technician_id === technicianId) && event.start_date <= end && event.end_date >= form.start_date)
  }

  function toggleTech(id: string) {
    setTechnicianIds(current => current.includes(id) ? current.filter(t => t !== id) : [...current, id])
  }

  async function createJobSite(attachToSelected: boolean) {
    const number = projectNumber.trim()
    if (!number) return setError('Project number is required to make a job site.')
    setCreatingSite(true); setError('')
    try {
      const result = await Ops.jobSites.create(number, attachToSelected ? form.site_id : undefined, siteZip.trim())
      setSiteOptions(current => current.some(site => site.id === result.site.id)
        ? current.map(site => site.id === result.site.id
          ? { ...site, project_numbers: Array.from(new Set([...(site.project_numbers || (site.project_number ? [site.project_number] : [])), number])) }
          : site)
        : [...current, { ...result.site, project_numbers: [number] }].sort((a, b) => a.name.localeCompare(b.name)))
      set('site_id')(result.site.id)
      setProjectNumber('')
      setSiteZip('')
      setShowSiteCreator(false)
    } catch (err) { setError((err as Error).message) } finally { setCreatingSite(false) }
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
      <div className="x-job-site-field">
        <label className="x-field"><span>Job site</span><select value={form.site_id} onChange={e => set('site_id')(e.target.value)} required><option value="">Choose a site</option>{siteOptions.map(s => <option value={s.id} key={s.id}>{s.name}{(s.project_numbers?.length || s.project_number) ? ` · Project ${(s.project_numbers?.length ? s.project_numbers : [s.project_number]).filter(Boolean).join(', ')}` : ''}</option>)}</select></label>
        <button type="button" className="x-inline-create" onClick={() => setShowSiteCreator(value => !value)}><Plus size={14} /> {showSiteCreator ? 'Cancel' : 'Create job site'}</button>
      </div>
      {showSiteCreator && <div className="x-job-site-create">
        <div className="x-form-row"><label className="x-field"><span>Project number</span><input autoFocus value={projectNumber} onChange={event => setProjectNumber(event.target.value)} placeholder="e.g. 10024" /></label><label className="x-field"><span>Site ZIP (optional)</span><input inputMode="numeric" value={siteZip} onChange={event => setSiteZip(event.target.value)} placeholder="Enables mileage" /></label></div>
        <p>Only the project number is required. A site ZIP lets the scheduler calculate technician mileage immediately; everything else can be completed later.</p>
        <div>
          {form.site_id && <button type="button" disabled={creatingSite || !projectNumber.trim()} onClick={() => void createJobSite(true)}>Add number to selected site</button>}
          <button type="button" className="primary" disabled={creatingSite || !projectNumber.trim()} onClick={() => void createJobSite(false)}>{creatingSite ? 'Creating…' : 'Create and use new site'}</button>
        </div>
      </div>}
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
        <div className="x-tech-picker">{assignmentTechs.map(tech => { const conflict = conflictFor(tech.id); return <label key={tech.id} className={`${technicianIds.includes(tech.id) ? 'is-picked' : ''} ${conflict ? 'has-conflict' : ''}`}>
          <input type="checkbox" checked={technicianIds.includes(tech.id)} onChange={() => toggleTech(tech.id)} /><span>{technicianName(tech)}<small>{conflict ? `${EVENT_LABELS[conflict.event_type]} ${conflict.start_date}${conflict.end_date !== conflict.start_date ? `–${conflict.end_date}` : ''}` : tech.distance_miles == null ? (tech.home_zip ? 'Site ZIP needed for mileage' : 'Home ZIP needed') : `${tech.distance_kind === 'driving' ? 'Approx.' : 'Est.'} ${Math.round(Number(tech.distance_miles))} mi from site`}</small></span>
        </label>})}{!assignmentTechs.length && <small>No active technicians yet.</small>}</div>
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

void LegacyJobModal

function JobModal({ job, sites, technicians, events, close, changed }: { job: JobSchedule | null; sites: SiteSummaryV2[]; technicians: Technician[]; events: TechnicianCalendarEvent[]; close: () => void; changed: () => void }) {
  const [currentJob, setCurrentJob] = useState<JobSchedule | null>(job)
  const [siteOptions, setSiteOptions] = useState(sites)
  const [form, setForm] = useState({
    site_id: job?.site_id || '', job_name: job?.job_name || '', job_type: job?.job_type || 'Warranty',
    contract_number: job?.contract_number || '', priority: job?.priority ?? 3,
    status: job?.status || 'scheduled' as JobStatus, notes: job?.notes || '',
  })
  const [editLine, setEditLine] = useState<JobAssignmentLine | 'new' | null>(null)
  const [showSiteCreator, setShowSiteCreator] = useState(false)
  const [projectNumber, setProjectNumber] = useState('')
  const [siteZip, setSiteZip] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(field: K) => (value: typeof form[K]) => setForm(current => ({ ...current, [field]: value }))

  async function createSite(attach: boolean) {
    if (!projectNumber.trim()) return setError('Project number is required to make a job site.')
    setSaving(true); setError('')
    try {
      const result = await Ops.jobSites.create(projectNumber.trim(), attach ? form.site_id : undefined, siteZip.trim())
      setSiteOptions(current => current.some(site => site.id === result.site.id) ? current : [...current, result.site].sort((a, b) => a.name.localeCompare(b.name)))
      set('site_id')(result.site.id); setShowSiteCreator(false); setProjectNumber(''); setSiteZip('')
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const result = currentJob ? await Ops.jobSchedule.update(currentJob.id, form) : await Ops.jobSchedule.create(form)
      setCurrentJob(result); changed()
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }
  async function refresh() {
    if (!currentJob) return
    try { setCurrentJob(await Ops.jobSchedule.get(currentJob.id)); setEditLine(null); changed() }
    catch (err) { setError((err as Error).message) }
  }
  async function remove() {
    if (!currentJob || !confirm('Delete this work order? This cannot be undone.')) return
    setSaving(true)
    try { await Ops.jobSchedule.delete(currentJob.id); close() }
    catch (err) { setError((err as Error).message); setSaving(false) }
  }
  const isClosed = currentJob?.status === 'closed' || currentJob?.status === 'cancelled'

  return <><div className="x-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="x-modal x-modal-wide x-work-order-modal">
    <form onSubmit={submit}>
      <header><div><span className="x-kicker">{currentJob?.work_order_number || 'New work order'}</span><h2>{currentJob?.job_name || 'Create work order'}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
      <div className="x-job-site-field"><label className="x-field"><span>Job site</span><select value={form.site_id} onChange={e => set('site_id')(e.target.value)} required disabled={!!currentJob}><option value="">Choose a site</option>{siteOptions.map(site => <option value={site.id} key={site.id}>{site.name}{site.project_number ? ` · Project ${site.project_number}` : ''}</option>)}</select></label>{!currentJob && <button type="button" className="x-inline-create" onClick={() => setShowSiteCreator(value => !value)}><Plus size={14} /> {showSiteCreator ? 'Cancel' : 'Create job site'}</button>}</div>
      {showSiteCreator && <div className="x-job-site-create"><div className="x-form-row"><label className="x-field"><span>Project number</span><input value={projectNumber} onChange={e => setProjectNumber(e.target.value)} required /></label><label className="x-field"><span>Site ZIP (optional)</span><input value={siteZip} onChange={e => setSiteZip(e.target.value)} /></label></div><p>Only the project number is required. The ZIP enables technician mileage.</p><div>{form.site_id && <button type="button" onClick={() => void createSite(true)}>Add number to selected site</button>}<button type="button" className="primary" onClick={() => void createSite(false)}>Create and use site</button></div></div>}
      <label className="x-field"><span>Job name</span><input value={form.job_name} onChange={e => set('job_name')(e.target.value)} required placeholder="e.g. RTU-4 warranty repair" /></label>
      <div className="x-form-row"><label className="x-field"><span>Type</span><select value={form.job_type} onChange={e => set('job_type')(e.target.value)} disabled={!!currentJob}>{JOB_TYPES.map(type => <option key={type}>{type}</option>)}</select></label><label className="x-field"><span>Priority (1 highest–5 lowest)</span><input type="number" min={1} max={5} value={form.priority} onChange={e => set('priority')(Number(e.target.value))} /></label></div>
      <div className="x-form-row"><label className="x-field"><span>Status</span><select value={form.status} onChange={e => set('status')(e.target.value as JobStatus)}>{STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label><label className="x-field"><span>Contract / PO number</span><input value={form.contract_number} onChange={e => set('contract_number')(e.target.value)} /></label></div>
      <label className="x-field"><span>Work-order notes</span><textarea rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>
      {error && <p className="x-error">{error}</p>}
      <footer>{currentJob && <button type="button" onClick={remove} className="x-danger-text"><Trash2 size={13} /> Delete</button>}<span style={{ flex: 1 }} /><button type="button" onClick={close}>{currentJob ? 'Done' : 'Cancel'}</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : currentJob ? 'Save work order' : 'Create work order'}</button></footer>
    </form>
    {currentJob ? <section className="x-assignment-lines"><div className="x-assignment-lines-head"><div><span className="x-kicker">Scheduled visits</span><h3>Assignment lines</h3></div>{!isClosed && <button type="button" className="primary" onClick={() => setEditLine('new')}><Plus size={14} /> Add assignment</button>}</div>
      {isClosed && <p className="x-assignment-locked">Reopen this work order to add or change technician assignments.</p>}
      {currentJob.assignment_lines.map(line => <button type="button" className="x-assignment-line" key={line.id} disabled={isClosed} onClick={() => setEditLine(line)}><b>Line {line.line_number}</b><span>{new Date(`${line.start_date}T12:00:00`).toLocaleDateString()} – {new Date(`${line.end_date}T12:00:00`).toLocaleDateString()}</span><span>{line.technicians.length ? line.technicians.map(tech => tech.name).join(', ') : 'Unassigned'}</span><em>{line.technicians.length}/{line.techs_needed} techs</em></button>)}
      {!currentJob.assignment_lines.length && <div className="x-assignment-empty"><strong>No visits scheduled yet</strong><p>Add an assignment line to choose dates and technicians.</p></div>}
    </section> : <p className="x-work-order-next">Create the work order first. Then add one or more dated technician assignment lines.</p>}
  </div></div>
  {currentJob && editLine && <AssignmentLineModal job={currentJob} line={editLine === 'new' ? null : editLine} technicians={technicians} events={events} close={() => setEditLine(null)} saved={refresh} />}</>
}

function AssignmentLineModal({ job, line, technicians, events, close, saved }: { job: JobSchedule; line: JobAssignmentLine | null; technicians: Technician[]; events: TechnicianCalendarEvent[]; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ start_date: line?.start_date || toISODate(new Date()), end_date: line?.end_date || toISODate(new Date()), techs_needed: line?.techs_needed || 1, scope: line?.scope || '', notes: line?.notes || '' })
  const [technicianIds, setTechnicianIds] = useState(line?.technicians.map(tech => tech.id) || [])
  const [siteTechs, setSiteTechs] = useState<Technician[]>(technicians)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(field: K) => (value: typeof form[K]) => setForm(current => ({ ...current, [field]: value }))
  useEffect(() => { Ops.technicians.forSite(job.site_id).then(setSiteTechs).catch(() => undefined) }, [job.site_id])
  const toggle = (id: string) => setTechnicianIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const conflictFor = (id: string) => events.find(event => (!event.technician_id || event.technician_id === id) && event.start_date <= form.end_date && event.end_date >= form.start_date)
  async function submit(e: FormEvent) { e.preventDefault(); setSaving(true); setError(''); try { const payload = { ...form, technician_ids: technicianIds }; if (line) await Ops.jobSchedule.updateLine(job.id, line.id, payload); else await Ops.jobSchedule.createLine(job.id, payload); saved() } catch (err) { setError((err as Error).message); setSaving(false) } }
  async function remove() { if (!line || !confirm(`Delete assignment line ${line.line_number}?`)) return; setSaving(true); try { await Ops.jobSchedule.deleteLine(job.id, line.id); saved() } catch (err) { setError((err as Error).message); setSaving(false) } }
  return <div className="x-modal-backdrop x-modal-backdrop-front" onMouseDown={e => e.target === e.currentTarget && close()}><form className="x-modal" onSubmit={submit}>
    <header><div><span className="x-kicker">{job.work_order_number}</span><h2>{line ? `Edit line ${line.line_number}` : 'Add assignment'}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    <div className="x-form-row"><label className="x-field"><span>Start date</span><input type="date" value={form.start_date} onChange={e => set('start_date')(e.target.value)} required /></label><label className="x-field"><span>End date</span><input type="date" min={form.start_date} value={form.end_date} onChange={e => set('end_date')(e.target.value)} required /></label></div>
    <label className="x-field"><span>Technicians needed</span><input type="number" min={1} value={form.techs_needed} onChange={e => set('techs_needed')(Number(e.target.value))} /></label><label className="x-field"><span>Scope for this visit</span><textarea rows={3} value={form.scope} onChange={e => set('scope')(e.target.value)} /></label>
    <label className="x-field"><span>Assign technicians</span><div className="x-tech-picker">{siteTechs.map(tech => { const conflict = conflictFor(tech.id); return <label key={tech.id} className={`${technicianIds.includes(tech.id) ? 'is-picked' : ''} ${conflict ? 'has-conflict' : ''}`}><input type="checkbox" checked={technicianIds.includes(tech.id)} onChange={() => toggle(tech.id)} /><span>{technicianName(tech)}<small>{conflict ? `${EVENT_LABELS[conflict.event_type]} during these dates` : tech.distance_miles == null ? (tech.home_zip ? 'Site ZIP needed for mileage' : 'Home ZIP needed') : `${tech.distance_kind === 'driving' ? 'Approx.' : 'Est.'} ${Math.round(Number(tech.distance_miles))} mi from site`}</small></span></label>})}</div></label>
    <label className="x-field"><span>Assignment notes</span><textarea rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>{error && <p className="x-error">{error}</p>}
    <footer>{line && <button type="button" onClick={remove} className="x-danger-text"><Trash2 size={13} /> Delete line</button>}<span style={{ flex: 1 }} /><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : line ? 'Save assignment' : 'Add assignment'}</button></footer>
  </form></div>
}

function TechnicianEventModal({ event, technicians, close, saved }: { event: TechnicianCalendarEvent | null; technicians: Technician[]; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({
    event_type: event?.event_type || 'pto' as TechnicianEventType,
    technician_id: event?.technician_id || '', title: event?.title || '',
    start_date: event?.start_date || toISODate(new Date()), end_date: event?.end_date || toISODate(new Date()), notes: event?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(field: K) => (value: typeof form[K]) => setForm(current => ({ ...current, [field]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, technician_id: form.event_type === 'holiday' ? null : form.technician_id }
      if (event) await Ops.technicianEvents.update(event.id, payload)
      else await Ops.technicianEvents.create(payload)
      saved()
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  async function remove() {
    if (!event || !confirm('Delete this calendar event?')) return
    setSaving(true)
    try { await Ops.technicianEvents.delete(event.id); saved() }
    catch (err) { setError((err as Error).message); setSaving(false) }
  }

  return <div className="x-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <form className="x-modal" onSubmit={submit}>
      <header><div><span className="x-kicker">Availability</span><h2>{event ? 'Edit calendar event' : 'Add calendar event'}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
      <label className="x-field"><span>Type</span><select value={form.event_type} onChange={e => set('event_type')(e.target.value as TechnicianEventType)}>{Object.entries(EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {form.event_type === 'holiday' ? <p className="x-import-intro">Holidays apply to every active technician.</p> : <label className="x-field"><span>Technician</span><select value={form.technician_id} onChange={e => set('technician_id')(e.target.value)} required><option value="">Choose a technician</option>{technicians.map(tech => <option value={tech.id} key={tech.id}>{technicianName(tech)}</option>)}</select></label>}
      <label className="x-field"><span>Label (optional)</span><input value={form.title} onChange={e => set('title')(e.target.value)} placeholder={EVENT_LABELS[form.event_type]} /></label>
      <div className="x-form-row"><label className="x-field"><span>Start</span><input type="date" value={form.start_date} onChange={e => set('start_date')(e.target.value)} required /></label><label className="x-field"><span>End</span><input type="date" min={form.start_date} value={form.end_date} onChange={e => set('end_date')(e.target.value)} required /></label></div>
      <label className="x-field"><span>Notes</span><textarea rows={3} value={form.notes} onChange={e => set('notes')(e.target.value)} /></label>
      {error && <p className="x-error">{error}</p>}
      <footer>{event && <button type="button" className="x-danger-text" onClick={remove}><Trash2 size={13} /> Delete</button>}<span style={{ flex: 1 }} /><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : event ? 'Save event' : 'Add to calendar'}</button></footer>
    </form>
  </div>
}
