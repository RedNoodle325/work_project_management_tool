'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  LogOut,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const STATUSES = ['Working', 'Unassigned', 'OFF', 'Travel', 'Vacation', 'Sick', 'Training'] as const
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const TECH_TYPES = ['Air', 'Chiller'] as const
const STORAGE_KEY = 'employeeSchedulerData'
const PANEL_STORAGE_KEY = 'managementPanelCollapsed'

type Status = (typeof STATUSES)[number]
type TechType = (typeof TECH_TYPES)[number]
type ViewMode = 'detailed' | 'compact'

interface Site {
  id: string
  name: string
}

interface Employee {
  id: string
  name: string
  role: string
  techType: TechType
  homeCity: string
  homeSite: string
}

interface Assignment {
  employeeId: string
  date: string
  siteId: string
  siteWasSet: boolean
  status: Status
  notes: string
}

interface SchedulerData {
  sites: Site[]
  employees: Employee[]
  assignments: Record<string, Assignment>
}

const demoData: SchedulerData = {
  sites: [
    { id: 'site-mesa', name: 'Mesa' },
    { id: 'site-llano', name: 'Llano' },
    { id: 'site-tor1a', name: 'TOR1A' },
  ],
  employees: [
    { id: 'emp-1', name: 'Alex Rivera', role: 'Technician', techType: 'Air', homeCity: 'Mesa', homeSite: 'site-mesa' },
    { id: 'emp-2', name: 'Jordan Lee', role: 'Lead Tech', techType: 'Chiller', homeCity: 'Phoenix', homeSite: 'site-llano' },
    { id: 'emp-3', name: 'Sam Patel', role: 'Technician', techType: 'Air', homeCity: 'Toronto', homeSite: 'site-tor1a' },
  ],
  assignments: {},
}

function cloneDemoData(): SchedulerData {
  return {
    sites: demoData.sites.map(site => ({ ...site })),
    employees: demoData.employees.map(employee => ({ ...employee })),
    assignments: {},
  }
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function displayDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}

function addDays(date: Date, amount: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function assignmentKey(empId: string, date: string): string {
  return `${empId}|${date}`
}

function normalizeData(input: Partial<SchedulerData>): SchedulerData {
  const sites = Array.isArray(input.sites) ? input.sites : []
  const employees = Array.isArray(input.employees) ? input.employees : []
  const assignments = input.assignments && typeof input.assignments === 'object' ? input.assignments : {}

  return {
    sites: sites.map(site => ({
      id: String(site.id || uid('site')),
      name: String(site.name || 'Unnamed Site'),
    })),
    employees: employees.map(employee => ({
      id: String(employee.id || uid('emp')),
      name: String(employee.name || 'Unnamed Employee'),
      role: String(employee.role || ''),
      techType: TECH_TYPES.includes(employee.techType as TechType) ? employee.techType as TechType : 'Air',
      homeCity: String(employee.homeCity || ''),
      homeSite: String(employee.homeSite || ''),
    })),
    assignments: Object.fromEntries(
      Object.entries(assignments).map(([key, assignment]) => {
        const source = assignment as Partial<Assignment>
        return [key, {
          employeeId: String(source.employeeId || ''),
          date: String(source.date || ''),
          siteId: String(source.siteId || ''),
          siteWasSet: Boolean(source.siteWasSet),
          status: STATUSES.includes(source.status as Status) ? source.status as Status : 'Working',
          notes: String(source.notes || ''),
        }]
      }),
    ),
  }
}

function loadData(): SchedulerData {
  if (typeof window === 'undefined') return cloneDemoData()
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return cloneDemoData()

  try {
    return normalizeData(JSON.parse(saved) as Partial<SchedulerData>)
  } catch {
    return cloneDemoData()
  }
}

function defaultAssignment(data: SchedulerData, empId: string, date: string): Assignment {
  const employee = data.employees.find(emp => emp.id === empId)
  return {
    employeeId: empId,
    date,
    siteId: employee?.homeSite || '',
    siteWasSet: false,
    status: 'Working',
    notes: '',
  }
}

function getAssignment(data: SchedulerData, empId: string, date: string): Assignment {
  const existing = data.assignments[assignmentKey(empId, date)]
  if (!existing) return defaultAssignment(data, empId, date)

  if (existing.siteWasSet === undefined && !existing.siteId) {
    return { ...existing, siteId: data.employees.find(emp => emp.id === empId)?.homeSite || '', siteWasSet: false }
  }

  return existing
}

function statusClass(status: string): string {
  return `xs-status xs-status-${status.toLowerCase().replace(/\s+/g, '-')}`
}

function siteName(data: SchedulerData, siteId: string): string {
  return data.sites.find(site => site.id === siteId)?.name || ''
}

export function Schedule() {
  const { user, isAuthenticated, login, logout } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hydrated, setHydrated] = useState(false)
  const [data, setData] = useState<SchedulerData>(cloneDemoData)
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()))
  const [currentView, setCurrentView] = useState<ViewMode>('detailed')
  const [siteFilter, setSiteFilter] = useState('')
  const [techTypeFilter, setTechTypeFilter] = useState('')
  const [managementPanelCollapsed, setManagementPanelCollapsed] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [employeeForm, setEmployeeForm] = useState({ name: '', role: '', techType: 'Air' as TechType, homeCity: '', homeSite: '' })
  const [siteFormName, setSiteFormName] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const canEdit = isAuthenticated

  useEffect(() => {
    setData(loadData())
    setManagementPanelCollapsed(window.localStorage.getItem(PANEL_STORAGE_KEY) === 'true')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && canEdit) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [canEdit, data, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(PANEL_STORAGE_KEY, String(managementPanelCollapsed))
  }, [hydrated, managementPanelCollapsed])

  useEffect(() => {
    if (!siteFilter || data.sites.some(site => site.id === siteFilter)) return
    setSiteFilter('')
  }, [data.sites, siteFilter])

  useEffect(() => {
    if (!employeeForm.homeSite && data.sites[0]) {
      setEmployeeForm(prev => ({ ...prev, homeSite: data.sites[0].id }))
    }
  }, [data.sites, employeeForm.homeSite])

  const weekDates = useMemo(() => DAYS.map((_, index) => addDays(currentMonday, index)), [currentMonday])

  function employeeHasVisibleSiteActivity(empId: string, siteId: string): boolean {
    const weekKeys = new Set(weekDates.map(fmt))
    const employee = data.employees.find(emp => emp.id === empId)
    if (employee?.homeSite === siteId) return true

    return Object.values(data.assignments).some(assignment =>
      assignment.employeeId === empId &&
      weekKeys.has(assignment.date) &&
      assignment.siteId === siteId,
    )
  }

  const visibleEmployees = useMemo(() => data.employees.filter(employee => {
    const matchesSite = !siteFilter || employeeHasVisibleSiteActivity(employee.id, siteFilter)
    const matchesType = !techTypeFilter || employee.techType === techTypeFilter
    return matchesSite && matchesType
  }), [data, siteFilter, techTypeFilter, weekDates])

  const todayMetrics = useMemo(() => {
    const todayKey = fmt(new Date())
    const counts: Record<Status | 'OFF', number> = {
      Working: 0,
      Vacation: 0,
      Travel: 0,
      Sick: 0,
      Training: 0,
      OFF: 0,
      Unassigned: 0,
    }

    visibleEmployees.forEach(employee => {
      const assignment = getAssignment(data, employee.id, todayKey)
      let status = assignment.status
      if (siteFilter && assignment.siteId && assignment.siteId !== siteFilter) status = 'Travel'
      counts[status] += 1
    })

    return counts
  }, [data, siteFilter, visibleEmployees])

  const weeklyMetrics = useMemo(() => {
    const metrics = { unassigned: 0, travel: 0, vacation: 0 }
    visibleEmployees.forEach(employee => {
      weekDates.forEach(date => {
        const assignment = getAssignment(data, employee.id, fmt(date))
        let status = assignment.status
        if (siteFilter && assignment.siteId && assignment.siteId !== siteFilter) status = 'Travel'
        if (status === 'Unassigned') metrics.unassigned += 1
        if (status === 'Travel') metrics.travel += 1
        if (status === 'Vacation') metrics.vacation += 1
      })
    })
    return metrics
  }, [data, siteFilter, visibleEmployees, weekDates])

  const selectedSiteName = siteFilter ? siteName(data, siteFilter) || 'Selected Site' : 'All Sites / Master View'
  const compactSiteName = siteFilter ? siteName(data, siteFilter) || 'Selected Site' : 'All Sites'
  const weekEnd = addDays(currentMonday, 6)
  const weekDateLabel = `${currentMonday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: currentMonday.getFullYear() === weekEnd.getFullYear() ? undefined : 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  const todayDateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  function requireEdit(): boolean {
    if (canEdit) return true
    setLoginOpen(true)
    return false
  }

  function updateAssignment(empId: string, date: string, patch: Partial<Assignment>) {
    if (!requireEdit()) return
    setData(prev => {
      const key = assignmentKey(empId, date)
      const current = getAssignment(prev, empId, date)
      return {
        ...prev,
        assignments: {
          ...prev.assignments,
          [key]: {
            ...current,
            ...patch,
            siteWasSet: patch.siteId !== undefined ? true : current.siteWasSet,
          },
        },
      }
    })
  }

  function saveEmployee() {
    if (!requireEdit()) return
    const name = employeeForm.name.trim()
    if (!name) return window.alert('Employee name cannot be blank.')

    const values = {
      name,
      role: employeeForm.role.trim(),
      techType: employeeForm.techType,
      homeCity: employeeForm.homeCity.trim(),
      homeSite: employeeForm.homeSite,
    }

    setData(prev => ({
      ...prev,
      employees: editingEmployeeId
        ? prev.employees.map(employee => employee.id === editingEmployeeId ? { ...employee, ...values } : employee)
        : [...prev.employees, { id: uid('emp'), ...values }],
    }))
    cancelEmployeeEdit()
  }

  function modifyEmployee(employee: Employee) {
    if (!requireEdit()) return
    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      name: employee.name,
      role: employee.role || '',
      techType: employee.techType || 'Air',
      homeCity: employee.homeCity || '',
      homeSite: employee.homeSite || data.sites[0]?.id || '',
    })
  }

  function cancelEmployeeEdit() {
    setEditingEmployeeId(null)
    setEmployeeForm({ name: '', role: '', techType: 'Air', homeCity: '', homeSite: data.sites[0]?.id || '' })
  }

  function removeEmployee(id: string) {
    if (!requireEdit()) return
    setData(prev => ({
      ...prev,
      employees: prev.employees.filter(employee => employee.id !== id),
      assignments: Object.fromEntries(Object.entries(prev.assignments).filter(([, assignment]) => assignment.employeeId !== id)),
    }))
  }

  function saveSite() {
    if (!requireEdit()) return
    const name = siteFormName.trim()
    if (!name) return window.alert('Site name cannot be blank.')

    setData(prev => ({
      ...prev,
      sites: editingSiteId
        ? prev.sites.map(site => site.id === editingSiteId ? { ...site, name } : site)
        : [...prev.sites, { id: uid('site'), name }],
    }))
    cancelSiteEdit()
  }

  function modifySite(site: Site) {
    if (!requireEdit()) return
    setEditingSiteId(site.id)
    setSiteFormName(site.name)
  }

  function cancelSiteEdit() {
    setEditingSiteId(null)
    setSiteFormName('')
  }

  function removeSite(id: string) {
    if (!requireEdit()) return
    setData(prev => ({
      sites: prev.sites.filter(site => site.id !== id),
      employees: prev.employees.map(employee => employee.homeSite === id ? { ...employee, homeSite: '' } : employee),
      assignments: Object.fromEntries(Object.entries(prev.assignments).map(([key, assignment]) => [
        key,
        assignment.siteId === id ? { ...assignment, siteId: '' } : assignment,
      ])),
    }))
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = 'employee-scheduler-data.json'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    if (!requireEdit()) return
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        setData(normalizeData(JSON.parse(String(reader.result)) as Partial<SchedulerData>))
      } catch {
        window.alert('Could not import file. Please use a valid scheduler JSON export.')
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await login(email, password)
      setPassword('')
      setLoginOpen(false)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign in failed')
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <main className="xs-page">
      <header className="xs-header">
        <Link className="xs-brand" href="/">
          <img src="/brand/xnrgy-mark.svg" alt="XNRGY" />
          <span>Zaktrack.pm</span>
        </Link>
        <nav className="xs-tabs" aria-label="Schedule views">
          <button className={currentView === 'detailed' ? 'active' : ''} type="button" onClick={() => setCurrentView('detailed')}>Weekly Schedule</button>
          <button className={currentView === 'compact' ? 'active' : ''} type="button" onClick={() => setCurrentView('compact')}>Compact View</button>
        </nav>
        <div className="xs-controls">
          <div className="xs-week-control">
            <button type="button" onClick={() => setCurrentMonday(prev => addDays(prev, -7))} aria-label="Previous week" title="Previous week"><ChevronLeft size={18} /></button>
            <label>
              <CalendarDays size={15} />
              <input type="date" value={fmt(currentMonday)} onChange={event => setCurrentMonday(getMonday(new Date(event.target.value)))} aria-label="Week starting date" />
            </label>
            <button type="button" onClick={() => setCurrentMonday(prev => addDays(prev, 7))} aria-label="Next week" title="Next week"><ChevronRight size={18} /></button>
          </div>
          <select value={siteFilter} onChange={event => setSiteFilter(event.target.value)} aria-label="Filter by site">
            <option value="">All Sites / Master View</option>
            {data.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <select value={techTypeFilter} onChange={event => setTechTypeFilter(event.target.value)} aria-label="Filter by technician type">
            <option value="">All Tech Types</option>
            {TECH_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <details className="xs-menu">
            <summary aria-label="Utilities">...</summary>
            <div>
              <button type="button" onClick={exportData}><Download size={15} /> Export Data</button>
              <button type="button" disabled={!canEdit} onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Import Data</button>
              <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={importData} />
            </div>
          </details>
          {canEdit ? (
            <button className="xs-auth-button" type="button" onClick={logout} title={user?.email || 'Sign out'}><LogOut size={16} /> Sign Out</button>
          ) : (
            <button className="xs-auth-button" type="button" onClick={() => setLoginOpen(true)}><LogIn size={16} /> Login</button>
          )}
        </div>
      </header>

      {!canEdit && (
        <section className="xs-readonly">
          <LockKeyhole size={17} />
          <strong>Read-only scheduler</strong>
          <span>Sign in to edit assignments, roster, sites, and imports.</span>
          <button type="button" onClick={() => setLoginOpen(true)}>Login</button>
        </section>
      )}

      <section className="xs-summary">
        <div className="xs-summary-group">
          <div className="xs-summary-heading">
            <h2>Today</h2>
            <span>{todayDateLabel}</span>
          </div>
          <div className="xs-today-metrics">
            {(['Working', 'Vacation', 'Travel', 'Sick', 'Training', 'OFF', 'Unassigned'] as const).map(status => (
              <div className="xs-metric" key={status}>
                <span>{status}</span>
                <strong>{todayMetrics[status]}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="xs-divider" />
        <div className="xs-summary-group">
          <div className="xs-summary-heading">
            <h2>Weekly Risk</h2>
            <span>{weekDateLabel}</span>
          </div>
          <div className="xs-weekly-metrics">
            <div className="xs-metric"><span>Employees</span><strong>{visibleEmployees.length}</strong></div>
            <div className="xs-metric"><span>Unassigned Days</span><strong>{weeklyMetrics.unassigned}</strong></div>
            <div className="xs-metric"><span>Travel Days</span><strong>{weeklyMetrics.travel}</strong></div>
            <div className="xs-metric"><span>Vacation Days</span><strong>{weeklyMetrics.vacation}</strong></div>
          </div>
        </div>
      </section>

      {currentView === 'detailed' ? (
        <section className={`xs-grid ${managementPanelCollapsed ? 'management-collapsed' : ''}`}>
          <aside className="xs-panel">
            <div className="xs-panel-head">
              <h2>Roster and Sites</h2>
              <button
                type="button"
                onClick={() => setManagementPanelCollapsed(value => !value)}
                aria-expanded={!managementPanelCollapsed}
                aria-label={managementPanelCollapsed ? 'Expand roster and sites panel' : 'Collapse roster and sites panel'}
                title={managementPanelCollapsed ? 'Expand roster and sites panel' : 'Collapse roster and sites panel'}
              >
                {managementPanelCollapsed ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <div className="xs-panel-body">
              <section>
                <h3>Employees</h3>
                <div className="xs-form">
                  <input disabled={!canEdit} value={employeeForm.name} onChange={event => setEmployeeForm(prev => ({ ...prev, name: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') saveEmployee() }} placeholder="Employee name" />
                  <div className="xs-row">
                    <input disabled={!canEdit} value={employeeForm.role} onChange={event => setEmployeeForm(prev => ({ ...prev, role: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') saveEmployee() }} placeholder="Role / skill" />
                    <select disabled={!canEdit} value={employeeForm.homeSite} onChange={event => setEmployeeForm(prev => ({ ...prev, homeSite: event.target.value }))}>
                      {data.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                    </select>
                  </div>
                  <div className="xs-row">
                    <select disabled={!canEdit} value={employeeForm.techType} onChange={event => setEmployeeForm(prev => ({ ...prev, techType: event.target.value as TechType }))} aria-label="Technician type">
                      {TECH_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <input disabled={!canEdit} value={employeeForm.homeCity} onChange={event => setEmployeeForm(prev => ({ ...prev, homeCity: event.target.value }))} placeholder="Enter city" />
                  </div>
                  <div className="xs-edit-actions">
                    <button type="button" disabled={!canEdit} onClick={saveEmployee}>{editingEmployeeId ? 'Save Employee' : 'Add Employee'}</button>
                    {editingEmployeeId && <button className="secondary" type="button" onClick={cancelEmployeeEdit}>Cancel</button>}
                  </div>
                </div>
                <div className="xs-list">
                  {data.employees.map(employee => (
                    <article className="xs-person" key={employee.id}>
                      <div>
                        <strong>{employee.name}</strong>
                        <span>{siteName(data, employee.homeSite) || 'No site'}</span>
                        <span>{employee.techType}</span>
                        <small>{employee.role || 'No role'}{employee.homeCity ? ` - ${employee.homeCity}` : ''}</small>
                      </div>
                      <div>
                        <button className="secondary" type="button" disabled={!canEdit} onClick={() => modifyEmployee(employee)}>Modify</button>
                        <button className="secondary" type="button" disabled={!canEdit} onClick={() => removeEmployee(employee.id)}>Remove</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>Sites</h3>
                <div className="xs-form">
                  <input disabled={!canEdit} value={siteFormName} onChange={event => setSiteFormName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveSite() }} placeholder="Site name" />
                  <div className="xs-edit-actions">
                    <button type="button" disabled={!canEdit} onClick={saveSite}>{editingSiteId ? 'Save Site' : 'Add Site'}</button>
                    {editingSiteId && <button className="secondary" type="button" onClick={cancelSiteEdit}>Cancel</button>}
                  </div>
                </div>
                <div className="xs-list">
                  {data.sites.map(site => (
                    <article className="xs-person" key={site.id}>
                      <div><strong>{site.name}</strong><small>Site</small></div>
                      <div>
                        <button className="secondary" type="button" disabled={!canEdit} onClick={() => modifySite(site)}>Modify</button>
                        <button className="secondary" type="button" disabled={!canEdit} onClick={() => removeSite(site.id)}>Remove</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </aside>

          <section className="xs-schedule-card">
            {managementPanelCollapsed && (
              <button className="xs-expand-panel" type="button" onClick={() => setManagementPanelCollapsed(false)}>
                <Eye size={16} /> Show Roster
              </button>
            )}
            <div className="xs-schedule-heading">
              <h2>{selectedSiteName}</h2>
              <span>{visibleEmployees.length ? `${visibleEmployees.length} employees visible` : 'No employees visible'}</span>
            </div>
            <div className="xs-table-wrap">
              <table className="xs-table">
                <thead>
                  <tr>
                    <th>{selectedSiteName}</th>
                    {weekDates.map((date, index) => <th key={fmt(date)}>{DAYS[index]}<br />{displayDate(date)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="xs-empty-cell">
                        No employees currently have {selectedSiteName} as their home site or scheduled activity for this week.
                      </td>
                    </tr>
                  ) : visibleEmployees.map(employee => (
                    <tr key={employee.id}>
                      <td>
                        <strong>{employee.name}</strong>
                        <span>{siteName(data, employee.homeSite) || 'No home site'}</span>
                        <span>{employee.techType}</span>
                        <small>{employee.role || ''}</small>
                      </td>
                      {weekDates.map((date, index) => {
                        const dateKey = fmt(date)
                        const assignment = getAssignment(data, employee.id, dateKey)

                        if (siteFilter && assignment.siteId && assignment.siteId !== siteFilter) {
                          return (
                            <td key={dateKey} data-day={`${DAYS[index]} ${displayDate(date)}`}>
                              <div className="xs-cell">
                                <span className={statusClass('Travel')}>Other Site</span>
                                <small>{employee.name} is assigned to {siteName(data, assignment.siteId) || 'another site'} this day.</small>
                              </div>
                            </td>
                          )
                        }

                        if (siteFilter && !assignment.siteId && employee.homeSite !== siteFilter) {
                          return (
                            <td key={dateKey} data-day={`${DAYS[index]} ${displayDate(date)}`}>
                              <div className="xs-cell">
                                <span className={statusClass('Unassigned')}>No {compactSiteName} Activity</span>
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td key={dateKey} data-day={`${DAYS[index]} ${displayDate(date)}`}>
                            <div className="xs-cell">
                              <span className={statusClass(assignment.status)}>{assignment.status}</span>
                              <select disabled={!canEdit} value={assignment.status} onChange={event => updateAssignment(employee.id, dateKey, { status: event.target.value as Status })}>
                                {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                              </select>
                              <select disabled={!canEdit} value={assignment.siteId} onChange={event => updateAssignment(employee.id, dateKey, { siteId: event.target.value })}>
                                <option value="">No site</option>
                                {data.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                              </select>
                              <input disabled={!canEdit} value={assignment.notes || ''} placeholder="Notes" onChange={event => updateAssignment(employee.id, dateKey, { notes: event.target.value })} />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : (
        <section className="xs-compact-card">
          <div className="xs-schedule-heading">
            <h2>Compact Schedule</h2>
            <span>{compactSiteName}</span>
          </div>
          {visibleEmployees.length ? (
            <div className="xs-compact-schedule">
              <div className="xs-compact-row">
                <div className="xs-compact-cell header">{compactSiteName}</div>
                {weekDates.map((date, index) => <div className="xs-compact-cell header" key={fmt(date)}>{DAYS[index]}<br />{displayDate(date)}</div>)}
              </div>
              {visibleEmployees.map(employee => (
                <div className="xs-compact-row data" key={employee.id}>
                  <div className="xs-compact-cell employee">
                    {employee.name}
                    <span>{siteName(data, employee.homeSite) || 'No site'}</span>
                    <span>{employee.techType}</span>
                    <small>{employee.role || ''}</small>
                  </div>
                  {weekDates.map(date => {
                    const assignment = getAssignment(data, employee.id, fmt(date))
                    let status = assignment.status
                    if (siteFilter && assignment.siteId && assignment.siteId !== siteFilter) status = 'Travel'
                    const assignedSite = siteName(data, assignment.siteId)

                    return (
                      <div className="xs-compact-cell" key={fmt(date)}>
                        <span className={statusClass(status)}>{status}</span>
                        {assignedSite && <small>{assignedSite}</small>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="xs-empty-cell">No employees are visible for this site and week.</div>
          )}
        </section>
      )}

      {loginOpen && (
        <div className="xs-login-modal" role="dialog" aria-modal="true" aria-labelledby="scheduler-login-title">
          <form onSubmit={submitLogin}>
            <header>
              <img src="/brand/xnrgy-mark.svg" alt="XNRGY" />
              <button type="button" onClick={() => setLoginOpen(false)} aria-label="Close login">x</button>
            </header>
            <span>Authenticated Access</span>
            <h2 id="scheduler-login-title">Unlock scheduler editing</h2>
            <label>
              <span>Email address</span>
              <input type="email" required autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="you@xnrgy.com" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" />
            </label>
            {loginError && <p>{loginError}</p>}
            <button type="submit" disabled={loginLoading}>{loginLoading ? 'Signing in...' : 'Login'}</button>
          </form>
        </div>
      )}
    </main>
  )
}
