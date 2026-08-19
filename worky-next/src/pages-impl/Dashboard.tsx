'use client'

import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { API } from '../api'
import { V2 } from '../api/v2'
import { Modal } from '../components/Modal'
import { useToastFn } from '@/app/providers'
import type { Site, Issue, ServiceTicket, Todo, ResourceLink, Contact } from '../types'
import type { SiteScheduleEventV2 } from '@/types/v2'
import { BookOpen, CalendarDays, ExternalLink, Pencil, Plus, UserPlus } from 'lucide-react'

type DashboardScheduleEvent = SiteScheduleEventV2 & { site_name?: string }

const STATUS_COLOR: Record<string, string> = {
  open: '#dc2626',
  techs_scheduled: '#2563eb',
  parts_on_order: '#ea580c',
  in_progress: '#d97706',
  complete: '#16a34a',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  techs_scheduled: 'Techs Scheduled',
  parts_on_order: 'Parts on Order',
  in_progress: 'In Progress',
  complete: 'Complete',
}

const ISSUE_PRIORITY_OPTIONS = ['critical', 'high', 'low']
const ISSUE_STATUS_OPTIONS = ['open', 'techs_scheduled', 'parts_on_order', 'in_progress', 'complete']
const SCHEDULE_STATUS_OPTIONS = ['planned', 'delayed', 'in_progress', 'complete', 'cancelled']

const cardStyle: CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  overflow: 'hidden',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
}

const sectionTitleStyle: CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.04,
  color: 'var(--text)',
}

const smallButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  minHeight: 28,
  padding: '0 9px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text2)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const primaryButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  borderColor: 'var(--accent)',
  background: 'var(--accent)',
  color: '#fff',
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const fullFieldStyle: CSSProperties = {
  ...fieldStyle,
  gridColumn: '1 / -1',
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: 0.06,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 38,
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 0,
}

function formatDate(value?: string) {
  if (!value) return 'Not set'
  const [datePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toDateInput(value?: string) {
  return value ? value.slice(0, 10) : ''
}

function workdayFinish(start?: string, days = 1, weekendsAreWorkdays = false) {
  if (!start) return ''
  const [year, month, day] = start.split('-').map(Number)
  if (!year || !month || !day) return start
  const date = new Date(year, month - 1, day)
  let counted = 1
  while (counted < Math.max(days, 1)) {
    date.setDate(date.getDate() + 1)
    const dow = date.getDay()
    if (weekendsAreWorkdays || (dow !== 0 && dow !== 6)) counted += 1
  }
  return date.toISOString().slice(0, 10)
}

function priorityWeight(priority?: string) {
  return ({ critical: 0, high: 1, low: 3 } as Record<string, number>)[priority ?? ''] ?? 2
}

function statusLabel(status?: string) {
  return STATUS_LABEL[status ?? ''] || (status ?? 'open').replace(/_/g, ' ')
}

function scheduleStatusLabel(status?: string) {
  return (status ?? 'planned').replace(/_/g, ' ')
}

function isActiveIssue(status?: string) {
  return (status ?? 'open') !== 'complete'
}

function ScoreDigit({ value, label, color, onClick }: {
  value: number
  label: string
  color: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        padding: '8px 24px',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 36,
        lineHeight: 1,
        fontWeight: 700,
        color,
        letterSpacing: 0,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1,
        color: 'var(--text3)',
        textTransform: 'uppercase',
        marginTop: 3,
      }}>
        {label}
      </div>
    </div>
  )
}

function DashboardIssueModal({ issue, siteName, onClose, onSave }: {
  issue: Issue
  siteName?: string
  onClose: () => void
  onSave: (issue: Issue) => void
}) {
  const toast = useToastFn()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(issue.title ?? '')
  const [description, setDescription] = useState(issue.description ?? '')
  const [unitTag, setUnitTag] = useState(issue.unit_tag ?? '')
  const [priority, setPriority] = useState(issue.priority ?? 'low')
  const [status, setStatus] = useState(issue.status ?? 'open')
  const [resolutionNotes, setResolutionNotes] = useState(issue.resolution_notes ?? '')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return toast('Issue title is required', 'error')
    setSaving(true)
    try {
      const saved = await API.issues.update(issue.id, {
        title: title.trim(),
        description: description.trim(),
        unit_tag: unitTag.trim(),
        priority,
        status,
        resolution_notes: resolutionNotes.trim(),
      })
      onSave(saved)
      toast('Issue saved')
      onClose()
    } catch (error) {
      toast('Failed to save issue: ' + (error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Issue" onClose={onClose} maxWidth={620}>
      <form onSubmit={submit}>
        <div style={formGridStyle}>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Site</span>
            <input style={inputStyle} value={siteName || 'Unassigned'} disabled />
          </label>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Title</span>
            <input style={inputStyle} value={title} onChange={event => setTitle(event.target.value)} required />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Equipment</span>
            <input style={inputStyle} value={unitTag} onChange={event => setUnitTag(event.target.value)} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Priority</span>
            <select style={inputStyle} value={priority} onChange={event => setPriority(event.target.value)}>
              {ISSUE_PRIORITY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Status</span>
            <select style={inputStyle} value={status} onChange={event => setStatus(event.target.value)}>
              {ISSUE_STATUS_OPTIONS.map(option => <option key={option} value={option}>{statusLabel(option)}</option>)}
            </select>
          </label>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Description</span>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={description} onChange={event => setDescription(event.target.value)} />
          </label>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Resolution / Comments</span>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={resolutionNotes} onChange={event => setResolutionNotes(event.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" style={smallButtonStyle} onClick={onClose}>Cancel</button>
          <button type="submit" style={primaryButtonStyle} disabled={saving}>
            {saving ? 'Saving...' : 'Save Issue'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DashboardContactModal({ sites, initialSiteId, onClose }: {
  sites: Site[]
  initialSiteId?: string
  onClose: () => void
}) {
  const toast = useToastFn()
  const [saving, setSaving] = useState(false)
  const [siteId, setSiteId] = useState(initialSiteId ?? sites[0]?.id ?? '')
  const [name, setName] = useState('')
  const [contactType, setContactType] = useState('customer')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!siteId) return toast('Select a site first', 'error')
    if (!name.trim()) return toast('Contact name is required', 'error')
    setSaving(true)
    try {
      const data: Partial<Contact> & { role?: string; notes?: string } = {
        name: name.trim(),
        contact_type: contactType,
        role: role.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
      }
      await API.contacts.create(siteId, data)
      toast('Contact added')
      onClose()
    } catch (error) {
      toast('Failed to add contact: ' + (error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Contact" onClose={onClose} maxWidth={560}>
      <form onSubmit={submit}>
        <div style={formGridStyle}>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Site</span>
            <select style={inputStyle} value={siteId} onChange={event => setSiteId(event.target.value)} required>
              <option value="">Select site</option>
              {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Name</span>
            <input style={inputStyle} value={name} onChange={event => setName(event.target.value)} required />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Type</span>
            <select style={inputStyle} value={contactType} onChange={event => setContactType(event.target.value)}>
              <option value="customer">Customer</option>
              <option value="site">Site</option>
              <option value="contractor">Contractor</option>
              <option value="vendor">Vendor</option>
              <option value="internal">Internal</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Role</span>
            <input style={inputStyle} value={role} onChange={event => setRole(event.target.value)} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Phone</span>
            <input style={inputStyle} value={phone} onChange={event => setPhone(event.target.value)} />
          </label>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Email</span>
            <input style={inputStyle} type="email" value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Notes</span>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" style={smallButtonStyle} onClick={onClose}>Cancel</button>
          <button type="submit" style={primaryButtonStyle} disabled={saving}>
            {saving ? 'Adding...' : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DashboardScheduleModal({ sites, event, initialSiteId, onClose, onSave }: {
  sites: Site[]
  event?: DashboardScheduleEvent
  initialSiteId?: string
  onClose: () => void
  onSave: (event: DashboardScheduleEvent) => void
}) {
  const toast = useToastFn()
  const [saving, setSaving] = useState(false)
  const [siteId, setSiteId] = useState(event?.site_id ?? initialSiteId ?? sites[0]?.id ?? '')
  const [title, setTitle] = useState(event?.title ?? '')
  const [plannedStart, setPlannedStart] = useState(toDateInput(event?.planned_start))
  const [plannedWorkingDays, setPlannedWorkingDays] = useState(String(event?.planned_working_days ?? 1))
  const [currentStart, setCurrentStart] = useState(toDateInput(event?.current_start))
  const [currentWorkingDays, setCurrentWorkingDays] = useState(String(event?.current_working_days ?? event?.planned_working_days ?? 1))
  const [weekendsAreWorkdays, setWeekendsAreWorkdays] = useState(Boolean(event?.weekends_are_workdays))
  const [actualStart, setActualStart] = useState(toDateInput(event?.actual_start))
  const [actualComplete, setActualComplete] = useState(toDateInput(event?.actual_complete))
  const [status, setStatus] = useState(event?.status ?? 'planned')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [changeNote, setChangeNote] = useState('')

  async function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    if (!siteId) return toast('Select a site first', 'error')
    if (!title.trim()) return toast('Schedule title is required', 'error')

    const site = sites.find(item => item.id === siteId)
    setSaving(true)
    try {
      if (event) {
        const saved = await V2.sites.schedule.update(siteId, event.id, {
          title: title.trim(),
          current_start: currentStart,
          current_working_days: Number(currentWorkingDays),
          weekends_are_workdays: weekendsAreWorkdays,
          actual_start: actualStart || null,
          actual_complete: actualComplete || null,
          status,
          notes: notes.trim(),
          change_note: changeNote.trim(),
        })
        onSave({ ...saved, site_name: site?.name ?? event.site_name })
        toast('Schedule event saved')
      } else {
        const saved = await V2.sites.schedule.create(siteId, {
          title: title.trim(),
          planned_start: plannedStart,
          planned_working_days: Number(plannedWorkingDays),
          weekends_are_workdays: weekendsAreWorkdays,
          notes: notes.trim(),
        })
        onSave({ ...saved, site_name: site?.name })
        toast('Schedule event added')
      }
      onClose()
    } catch (error) {
      toast('Failed to save schedule: ' + (error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={event ? 'Edit Schedule Event' : 'Add Schedule Event'} onClose={onClose} maxWidth={640}>
      <form onSubmit={submit}>
        <div style={formGridStyle}>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Site</span>
            <select style={inputStyle} value={siteId} onChange={change => setSiteId(change.target.value)} disabled={Boolean(event)} required>
              <option value="">Select site</option>
              {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Event</span>
            <input style={inputStyle} value={title} onChange={change => setTitle(change.target.value)} required />
          </label>
          {!event && (
            <>
              <label style={fieldStyle}>
                <span style={labelStyle}>Planned Start</span>
                <input
                  style={inputStyle}
                  type="date"
                  value={plannedStart}
                  onChange={change => {
                    setPlannedStart(change.target.value)
                    setCurrentStart(change.target.value)
                  }}
                  required
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Planned Workdays</span>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  value={plannedWorkingDays}
                  onChange={change => {
                    setPlannedWorkingDays(change.target.value)
                    setCurrentWorkingDays(change.target.value)
                  }}
                  required
                />
              </label>
            </>
          )}
          <label style={fieldStyle}>
            <span style={labelStyle}>Current Start</span>
            <input style={inputStyle} type="date" value={currentStart || plannedStart} onChange={change => setCurrentStart(change.target.value)} required />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Current Workdays</span>
            <input style={inputStyle} type="number" min="1" value={currentWorkingDays} onChange={change => setCurrentWorkingDays(change.target.value)} required />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Status</span>
            <select style={inputStyle} value={status} onChange={change => setStatus(change.target.value as SiteScheduleEventV2['status'])}>
              {SCHEDULE_STATUS_OPTIONS.map(option => <option key={option} value={option}>{scheduleStatusLabel(option)}</option>)}
            </select>
          </label>
          <label style={{ ...fieldStyle, alignContent: 'end' }}>
            <span style={labelStyle}>Workdays</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 38, fontSize: 12, color: 'var(--text2)' }}>
              <input type="checkbox" checked={weekendsAreWorkdays} onChange={change => setWeekendsAreWorkdays(change.target.checked)} />
              Include weekends
            </span>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Actual Start</span>
            <input style={inputStyle} type="date" value={actualStart} onChange={change => setActualStart(change.target.value)} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Actual Complete</span>
            <input style={inputStyle} type="date" value={actualComplete} onChange={change => setActualComplete(change.target.value)} />
          </label>
          {event && (
            <label style={fullFieldStyle}>
              <span style={labelStyle}>Change Note</span>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={changeNote} onChange={change => setChangeNote(change.target.value)} />
            </label>
          )}
          <label style={fullFieldStyle}>
            <span style={labelStyle}>Event Notes</span>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={notes} onChange={change => setNotes(change.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" style={smallButtonStyle} onClick={onClose}>Cancel</button>
          <button type="submit" style={primaryButtonStyle} disabled={saving}>
            {saving ? 'Saving...' : event ? 'Save Event' : 'Add Event'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Dashboard() {
  const toast = useToastFn()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<Site[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [serviceTickets, setServiceTickets] = useState<ServiceTicket[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [quickLinks, setQuickLinks] = useState<ResourceLink[]>([])
  const [scheduleEvents, setScheduleEvents] = useState<DashboardScheduleEvent[]>([])
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null)
  const [contactSiteId, setContactSiteId] = useState<string | null>(null)
  const [scheduleModal, setScheduleModal] = useState<{ event?: DashboardScheduleEvent; siteId?: string } | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      const [siteRows, issueRows, ticketRows, todosOpen, todosInProgress, resourceRows] = await Promise.all([
        API.sites.list(),
        API.issues.listAll().catch(() => [] as Issue[]),
        API.serviceTickets.listAll().catch(() => [] as ServiceTicket[]),
        API.todos.list({ status: 'todo' }).catch(() => [] as Todo[]),
        API.todos.list({ status: 'in_progress' }).catch(() => [] as Todo[]),
        API.resourceLinks.list().catch(() => [] as ResourceLink[]),
      ])

      const mergedTodos = [...todosInProgress, ...todosOpen].sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
        return (order[a.priority ?? 'normal'] ?? 2) - (order[b.priority ?? 'normal'] ?? 2)
      })

      const scheduleRows = (await Promise.all(siteRows.map(site =>
        V2.sites.schedule.list(site.id)
          .then(data => data.events.map(event => ({ ...event, site_name: site.name })))
          .catch(() => [] as DashboardScheduleEvent[])
      ))).flat()

      setSites(siteRows)
      setIssues(issueRows)
      setServiceTickets(ticketRows)
      setTodos(mergedTodos)
      setQuickLinks(resourceRows)
      setScheduleEvents(scheduleRows)
    } catch (error) {
      toast('Failed to load dashboard: ' + (error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const siteMap = useMemo(() => Object.fromEntries(sites.map(site => [site.id, site.name])), [sites])
  const activeIssues = useMemo(() => {
    return issues
      .filter(issue => isActiveIssue(issue.status))
      .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  }, [issues])
  const upcomingSchedule = useMemo(() => {
    return [...scheduleEvents]
      .filter(event => event.status !== 'cancelled')
      .sort((a, b) => String(a.current_start).localeCompare(String(b.current_start)))
  }, [scheduleEvents])

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading...</div>
  }

  const openIssues = activeIssues.length
  const openTickets = serviceTickets.filter(ticket => ticket.status === 'open' || ticket.status === 'in_progress').length
  const emergencyCount = sites.filter(site => {
    const siteIssues = activeIssues.filter(issue => issue.site_id === site.id)
    return siteIssues.some(issue => issue.priority === 'critical')
  }).length

  const siteIssueStats = sites.map(site => {
    const siteIssues = activeIssues.filter(issue => issue.site_id === site.id)
    const critical = siteIssues.filter(issue => issue.priority === 'critical').length
    const high = siteIssues.filter(issue => issue.priority === 'high').length
    const total = siteIssues.length
    const status = critical > 0 ? 'emergency' : high > 0 ? 'problem' : 'operational'
    return { site, total, critical, high, status }
  }).filter(stat => stat.total > 0)
    .sort((a, b) => {
      const order: Record<string, number> = { emergency: 0, problem: 1, operational: 2 }
      return order[a.status] - order[b.status] || b.critical - a.critical || b.total - a.total
    })

  function saveIssue(saved: Issue) {
    setIssues(prev => prev.map(issue => issue.id === saved.id ? saved : issue))
  }

  function saveSchedule(saved: DashboardScheduleEvent) {
    setScheduleEvents(prev => {
      const exists = prev.some(event => event.id === saved.id)
      const next = exists ? prev.map(event => event.id === saved.id ? saved : event) : [...prev, saved]
      return next.sort((a, b) => String(a.current_start).localeCompare(String(b.current_start)))
    })
  }

  return (
    <div>
      <div style={{
        ...cardStyle,
        marginBottom: 16,
        position: 'relative',
      }}>
        <div style={{ height: 3, background: 'var(--accent)' }} />

        <div className="dash-header-inner">
          <div className="dash-branding">
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 0,
              color: 'var(--text)',
            }}>
              Project Overview Dashboard
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Field Ops - {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <div className="dash-stats">
            <ScoreDigit value={sites.length} label="Sites" color="var(--cyan)" />
            <ScoreDigit
              value={openIssues}
              label="Issues"
              color={openIssues > 0 ? 'var(--yellow)' : 'var(--text3)'}
              onClick={() => router.push('/issues')}
            />
            {emergencyCount > 0 && (
              <ScoreDigit
                value={emergencyCount}
                label="Emergency"
                color="var(--red)"
                onClick={() => router.push('/issues')}
              />
            )}
          </div>

          <div className="dash-clock">
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text2)',
              lineHeight: 1,
            }}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
              Local time
            </div>
          </div>
        </div>
      </div>

      <div style={{
        ...cardStyle,
        marginBottom: 16,
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: 'var(--text3)', fontWeight: 600 }}>{openTickets}</span>
          active tickets
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={primaryButtonStyle} onClick={() => setContactSiteId('')}>
            <UserPlus size={14} />
            Add Contact
          </button>
          <button style={primaryButtonStyle} onClick={() => setScheduleModal({})}>
            <CalendarDays size={14} />
            Add Schedule
          </button>
        </div>
      </div>

      <div className="dash-two-col">
        <div style={cardStyle}>
          <div style={{ height: 3, background: 'var(--yellow)' }} />
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Site Issues</span>
            <Link href="/issues" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              View all
            </Link>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 40px 40px 40px',
            padding: '4px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            {['SITE', 'TTL', 'CRIT', 'HIGH'].map(header => (
              <span key={header} style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.06, color: 'var(--text3)', textAlign: header !== 'SITE' ? 'center' : 'left' }}>
                {header}
              </span>
            ))}
          </div>

          {siteIssueStats.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
              All clear - no open issues
            </div>
          ) : siteIssueStats.map(({ site, total, critical, high, status }) => {
            const statusColorHex = status === 'emergency' ? '#EF4444' : status === 'problem' ? '#F97316' : '#10B981'
            return (
              <div
                key={site.id}
                onClick={() => router.push(`/sites/${site.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 40px 40px 40px',
                  alignItems: 'center',
                  padding: '7px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: status === 'emergency' ? 'rgba(239,68,68,0.06)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColorHex, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {site.name}
                  </span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{total}</div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: critical > 0 ? 'var(--red)' : 'var(--border)' }}>{critical || '-'}</div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: high > 0 ? 'var(--orange)' : 'var(--border)' }}>{high || '-'}</div>
              </div>
            )
          })}
        </div>

        <div style={cardStyle}>
          <div style={{ height: 3, background: 'var(--accent)' }} />
          <div style={{ padding: 14 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8,
            }}>
              <span style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
              }}>
                My To-Do
              </span>
              <Link href="/todos" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                View all
              </Link>
            </div>

            {todos.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>
                Nothing on the list
              </div>
            ) : (
              <>
                {todos.slice(0, 8).map(todo => {
                  const due = todo.due_date ? new Date(todo.due_date.includes('T') ? todo.due_date : todo.due_date + 'T00:00:00') : null
                  const overdue = due && due < new Date() && todo.status !== 'done'
                  const priorityColor: Record<string, string> = { urgent: '#dc2626', high: '#ea580c', normal: '#2563eb', low: '#6b7280' }
                  return (
                    <div key={todo.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: priorityColor[todo.priority ?? 'normal'], marginTop: 5 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.title}</div>
                        {todo.site_id && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{siteMap[todo.site_id] || ''}</div>}
                      </div>
                      {overdue ? (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>Overdue</span>
                      ) : due ? (
                        <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
                {todos.length > 8 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 6, textAlign: 'center' }}>+ {todos.length - 8} more</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="dash-two-col" style={{ marginTop: 16 }}>
        <div style={cardStyle}>
          <div style={{ height: 3, background: '#F97316' }} />
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Active Issue Editor</span>
            <Link href="/issues" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              Full list
            </Link>
          </div>
          {activeIssues.length === 0 ? (
            <div style={{ padding: 18, color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>No active issues</div>
          ) : activeIssues.slice(0, 8).map(issue => {
            const priorityColor = issue.priority === 'critical' ? 'var(--red)' : issue.priority === 'high' ? 'var(--orange)' : 'var(--text3)'
            return (
              <div key={issue.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />
                    <strong style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {issue.title || issue.unit_tag || 'Untitled issue'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'var(--text3)' }}>
                    <span>{issue.site_id ? siteMap[issue.site_id] || 'Site' : 'No site'}</span>
                    {issue.unit_tag && <span>{issue.unit_tag}</span>}
                    <span style={{ color: STATUS_COLOR[issue.status ?? 'open'] || 'var(--text3)', fontWeight: 700 }}>{statusLabel(issue.status)}</span>
                  </div>
                </div>
                <button style={smallButtonStyle} onClick={() => setEditingIssue(issue)}>
                  <Pencil size={13} />
                  Edit
                </button>
              </div>
            )
          })}
        </div>

        <div style={cardStyle}>
          <div style={{ height: 3, background: '#3b82f6' }} />
          <div style={sectionHeaderStyle}>
            <span style={{ ...sectionTitleStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <CalendarDays size={13} />
              Site Schedule
            </span>
            <button style={smallButtonStyle} onClick={() => setScheduleModal({})}>
              <Plus size={13} />
              Add
            </button>
          </div>
          {upcomingSchedule.length === 0 ? (
            <div style={{ padding: 18, color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>No schedule events</div>
          ) : upcomingSchedule.slice(0, 8).map(event => {
            const finish = workdayFinish(event.current_start, event.current_working_days, event.weekends_are_workdays)
            const statusColor = event.status === 'complete' ? 'var(--green)' : event.status === 'delayed' ? 'var(--orange)' : event.status === 'cancelled' ? 'var(--text3)' : 'var(--accent)'
            return (
              <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                    <strong style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.title}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'var(--text3)' }}>
                    <span>{event.site_name || siteMap[event.site_id] || 'Site'}</span>
                    <span>{formatDate(event.current_start)} to {formatDate(finish)}</span>
                    <span style={{ color: statusColor, fontWeight: 700 }}>{scheduleStatusLabel(event.status)}</span>
                  </div>
                </div>
                <button style={smallButtonStyle} onClick={() => setScheduleModal({ event })}>
                  <Pencil size={13} />
                  Edit
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {quickLinks.length > 0 && (
        <div style={{
          ...cardStyle,
          marginTop: 16,
          marginBottom: 16,
        }}>
          <div style={{ height: 3, background: '#3b82f6' }} />
          <div style={sectionHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BookOpen size={13} color="#3b82f6" />
              <span style={sectionTitleStyle}>Quick Links</span>
            </div>
            <Link href="/resources" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              Manage
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px' }}>
            {quickLinks.map(link => link.url ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={11} />
                {link.name}
              </a>
            ) : (
              <span
                key={link.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text3)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '5px 10px',
                }}
              >
                {link.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {sites.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, marginTop: quickLinks.length > 0 ? 0 : 16 }}>
          {sites.map(site => {
            const siteIssues = activeIssues.filter(issue => issue.site_id === site.id)
            const hasCritical = siteIssues.some(issue => issue.priority === 'critical')
            const hasHigh = siteIssues.some(issue => issue.priority === 'high')
            const siteStatus = hasCritical
              ? { label: 'Emergency', colorHex: '#EF4444' }
              : hasHigh
                ? { label: 'Attention', colorHex: '#F97316' }
                : { label: 'Operational', colorHex: '#10B981' }

            return (
              <div
                key={site.id}
                onClick={() => router.push(`/sites/${site.id}`)}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  minHeight: 96,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ height: 3, background: siteStatus.colorHex }} />
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: siteStatus.colorHex, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: 0.04,
                      color: siteStatus.colorHex,
                    }}>
                      {siteStatus.label}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  } as CSSProperties}>
                    {site.name}
                  </div>
                  <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    {siteIssues.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: siteStatus.colorHex, lineHeight: 1 }}>
                          {siteIssues.length}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>open</span>
                      </div>
                    ) : <span />}
                    <button
                      title="Add contact"
                      style={{ ...smallButtonStyle, minWidth: 28, padding: 0 }}
                      onClick={event => {
                        event.stopPropagation()
                        setContactSiteId(site.id)
                      }}
                    >
                      <UserPlus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingIssue && (
        <DashboardIssueModal
          issue={editingIssue}
          siteName={editingIssue.site_id ? siteMap[editingIssue.site_id] : undefined}
          onSave={saveIssue}
          onClose={() => setEditingIssue(null)}
        />
      )}

      {contactSiteId !== null && (
        <DashboardContactModal
          sites={sites}
          initialSiteId={contactSiteId || undefined}
          onClose={() => setContactSiteId(null)}
        />
      )}

      {scheduleModal && (
        <DashboardScheduleModal
          sites={sites}
          event={scheduleModal.event}
          initialSiteId={scheduleModal.siteId}
          onSave={saveSchedule}
          onClose={() => setScheduleModal(null)}
        />
      )}
    </div>
  )
}
