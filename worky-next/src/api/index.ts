import type {
  Site, Unit, Contact, Contractor, Note, Issue, ServiceTicket, IssueLineLink,
  Ticket, Todo, JobSchedule, Technician, MsowDraft, WarrantyClaim, BomImport,
  BomItem, Campaign, SycoolSystem, User, JobNumber, LoginResponse, ImportResult,
  ResourceLink, DailyTechReport,
} from '../types'

const API_BASE = '/api'

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T
  }

  return res.json()
}

// ── API ───────────────────────────────────────────────────────────────────────

export const API = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => apiFetch<User>('/auth/me'),
    setup: (data: { email: string; password: string; name: string }) =>
      apiFetch<LoginResponse>('/auth/setup', { method: 'POST', body: JSON.stringify(data) }),
    changePassword: (data: { current_password: string; new_password: string }) =>
      apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
    listUsers: () => apiFetch<User[]>('/users'),
  },

  // Sites
  sites: {
    list: () => apiFetch<Site[]>('/sites'),
    get: (id: string) => apiFetch<Site>(`/sites/${id}`),
    create: (data: Partial<Site>) =>
      apiFetch<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Site>) =>
      apiFetch<Site>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/sites/${id}`, { method: 'DELETE' }),
  },

  // Units
  units: {
    list: (params?: { site_id?: string }) =>
      apiFetch<Unit[]>('/units' + (params?.site_id ? `?site_id=${params.site_id}` : '')),
    get: async (id: string) => {
      const units = await apiFetch<Unit[]>(`/units?id=${encodeURIComponent(id)}`)
      const unit = units[0]
      if (!unit) throw new Error('Unit not found')
      return unit
    },
    create: (data: Partial<Unit>) =>
      apiFetch<Unit>('/units', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Unit>) =>
      apiFetch<Unit>(`/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/units/${id}`, { method: 'DELETE' }),
    setOperationalStatus: (id: string, data: { operational_status: string }) =>
      apiFetch(`/units/${id}/operational-status`, { method: 'PUT', body: JSON.stringify(data) }),
    bulkCommission: (siteId: string, data: unknown) =>
      apiFetch(`/sites/${siteId}/units/commission-bulk`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Contacts
  contacts: {
    list: (siteId: string) => apiFetch<Contact[]>(`/sites/${siteId}/contacts`),
    create: (siteId: string, data: Partial<Contact>) =>
      apiFetch<Contact>(`/sites/${siteId}/contacts`, { method: 'POST', body: JSON.stringify(data) }),
    update: (siteId: string, id: string, data: Partial<Contact>) =>
      apiFetch<Contact>(`/sites/${siteId}/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (siteId: string, id: string) =>
      apiFetch(`/sites/${siteId}/contacts/${id}`, { method: 'DELETE' }),
  },

  // Contractors
  contractors: {
    list: () => apiFetch<Contractor[]>('/contractors'),
    get: (id: string) => apiFetch<Contractor>(`/contractors/${id}`),
    create: (data: Partial<Contractor>) =>
      apiFetch<Contractor>('/contractors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Contractor>) =>
      apiFetch<Contractor>(`/contractors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/contractors/${id}`, { method: 'DELETE' }),
  },

  // Notes
  notes: {
    listSite: (siteId: string) => apiFetch<Note[]>(`/sites/${siteId}/notes`),
    listUnit: (unitId: string) => apiFetch<Note[]>(`/units/${unitId}/notes`),
    search: (q: string) => apiFetch<Note[]>(`/notes/search?q=${encodeURIComponent(q)}`),
    create: (data: Partial<Note>) =>
      apiFetch<Note>('/notes', { method: 'POST', body: JSON.stringify(data) }),
    createSite: (siteId: string, data: Partial<Note>) =>
      apiFetch<Note>(`/sites/${siteId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    createUnit: (unitId: string, data: Partial<Note>) =>
      apiFetch<Note>(`/units/${unitId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Note>) =>
      apiFetch<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/notes/${id}`, { method: 'DELETE' }),
  },

  // Issues (commissioning)
  issues: {
    listAll: () => apiFetch<Issue[]>('/issues'),
    listSite: (siteId: string) => apiFetch<Issue[]>(`/sites/${siteId}/issues`),
    listUnit: (unitId: string) => apiFetch<Issue[]>(`/units/${unitId}/issues`),
    create: (siteId: string, data: Partial<Issue>) =>
      apiFetch<Issue>(`/sites/${siteId}/issues`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Issue>) =>
      apiFetch<Issue>(`/issues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/issues/${id}`, { method: 'DELETE' }),
    importCxAlloy: (siteId: string, issues: object[]) =>
      apiFetch<{ imported: number; skipped: number }>(`/sites/${siteId}/issues/import-cxalloy`, {
        method: 'POST',
        body: JSON.stringify({ issues }),
      }),
  },

  // ASRs (stored in the service_tickets table for backward compatibility)
  serviceTickets: {
    listAll: () => apiFetch<ServiceTicket[]>('/service-tickets'),
    listSite: (siteId: string) => apiFetch<ServiceTicket[]>(`/sites/${siteId}/service-tickets`),
    get: (id: string) => apiFetch<ServiceTicket>(`/service-tickets/${id}`),
    create: (siteId: string, data: Partial<ServiceTicket>) =>
      apiFetch<ServiceTicket>(`/sites/${siteId}/service-tickets`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ServiceTicket>) =>
      apiFetch<ServiceTicket>(`/service-tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/service-tickets/${id}`, { method: 'DELETE' }),
    importXml: async (file: File): Promise<ImportResult> => {
      const token = getToken()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/service-tickets/import-xml`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  },

  // Issue ↔ service-line links
  issueLineLinks: {
    listAll: () => apiFetch<IssueLineLink[]>('/issue-line-links'),
    listTicket: (ticketId: string) => apiFetch<IssueLineLink[]>(`/service-tickets/${ticketId}/line-links`),
    create: (ticketId: string, data: { issue_id: string; order_id: string }) =>
      apiFetch<IssueLineLink>(`/service-tickets/${ticketId}/line-links`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (ticketId: string, linkId: string) =>
      apiFetch(`/service-tickets/${ticketId}/line-links/${linkId}`, { method: 'DELETE' }),
  },

  // Tickets (CxAlloy / commissioning punch list)
  tickets: {
    list: () => apiFetch<Ticket[]>('/tickets'),
    get: (id: string) => apiFetch<Ticket>(`/tickets/${id}`),
    create: (data: Partial<Ticket>) =>
      apiFetch<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Ticket>) =>
      apiFetch<Ticket>(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/tickets/${id}`, { method: 'DELETE' }),
  },

  // Todos
  todos: {
    list: (params: Record<string, string> = {}) =>
      apiFetch<Todo[]>('/todos?' + new URLSearchParams(params)),
    create: (data: Partial<Todo>) =>
      apiFetch<Todo>('/todos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Todo>) =>
      apiFetch<Todo>(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/todos/${id}`, { method: 'DELETE' }),
  },

  // Schedule / Operations
  schedule: {
    listJobs: (params: Record<string, string> = {}) =>
      apiFetch<JobSchedule[]>('/job-schedule?' + new URLSearchParams(params)),
    createJob: (data: Partial<JobSchedule>) =>
      apiFetch<JobSchedule>('/job-schedule', { method: 'POST', body: JSON.stringify(data) }),
    updateJob: (id: string, data: Partial<JobSchedule>) =>
      apiFetch<JobSchedule>(`/job-schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteJob: (id: string) =>
      apiFetch(`/job-schedule/${id}`, { method: 'DELETE' }),
    listJobTechs: (jobId: string) =>
      apiFetch<Technician[]>(`/job-schedule/${jobId}/techs`),
    assignTech: (jobId: string, technicianId: string) =>
      apiFetch(`/job-schedule/${jobId}/techs`, { method: 'POST', body: JSON.stringify({ technician_id: technicianId }) }),
    removeTech: (jobId: string, techId: string) =>
      apiFetch(`/job-schedule/${jobId}/techs/${techId}`, { method: 'DELETE' }),
    listTechs: () => apiFetch<Technician[]>('/technicians'),
    createTech: (data: Partial<Technician>) =>
      apiFetch<Technician>('/technicians', { method: 'POST', body: JSON.stringify(data) }),
    updateTech: (id: string, data: Partial<Technician>) =>
      apiFetch<Technician>(`/technicians/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTech: (id: string) =>
      apiFetch(`/technicians/${id}`, { method: 'DELETE' }),
    getTechsForSite: (siteId: string) =>
      apiFetch<Technician[]>(`/dispatch/techs-for-site/${siteId}`),
  },

  // MSOW drafts
  msow: {
    list: (params: Record<string, string> = {}) =>
      apiFetch<MsowDraft[]>('/msow-drafts?' + new URLSearchParams(params)),
    get: (id: string) => apiFetch<MsowDraft>(`/msow-drafts/${id}`),
    create: (data: Partial<MsowDraft>) =>
      apiFetch<MsowDraft>('/msow-drafts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<MsowDraft>) =>
      apiFetch<MsowDraft>(`/msow-drafts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/msow-drafts/${id}`, { method: 'DELETE' }),
  },

  // Warranty
  warranty: {
    list: () => apiFetch<WarrantyClaim[]>('/warranty'),
    get: (id: string) => apiFetch<WarrantyClaim>(`/warranty/${id}`),
    create: (data: Partial<WarrantyClaim>) =>
      apiFetch<WarrantyClaim>('/warranty', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<WarrantyClaim>) =>
      apiFetch<WarrantyClaim>(`/warranty/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/warranty/${id}`, { method: 'DELETE' }),
  },

  // BOM
  bom: {
    list: () => apiFetch<BomImport[]>('/bom'),
    getItems: (id: string) => apiFetch<BomItem[]>(`/bom/${id}/items`),
    searchParts: (q: string) => apiFetch<BomItem[]>(`/parts/search?q=${encodeURIComponent(q)}`),
    import: async (file: File, siteIds: string[] = []): Promise<{ id: string }> => {
      const token = getToken()
      const form = new FormData()
      form.append('file', file)
      if (siteIds.length) form.append('site_ids', JSON.stringify(siteIds))
      const res = await fetch(`${API_BASE}/bom/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  },

  // Campaigns
  campaigns: {
    list: (siteId: string) => apiFetch<Campaign[]>(`/sites/${siteId}/campaigns`),
    create: (siteId: string, data: Partial<Campaign>) =>
      apiFetch<Campaign>(`/sites/${siteId}/campaigns`, { method: 'POST', body: JSON.stringify(data) }),
    update: (siteId: string, id: string, data: Partial<Campaign>) =>
      apiFetch<Campaign>(`/sites/${siteId}/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (siteId: string, id: string) =>
      apiFetch(`/sites/${siteId}/campaigns/${id}`, { method: 'DELETE' }),
  },

  // Job numbers
  jobNumbers: {
    list: (siteId: string) => apiFetch<JobNumber[]>(`/sites/${siteId}/job-numbers`),
    create: (siteId: string, data: Partial<JobNumber>) =>
      apiFetch<JobNumber>(`/sites/${siteId}/job-numbers`, { method: 'POST', body: JSON.stringify(data) }),
    update: (siteId: string, id: string, data: Partial<JobNumber>) =>
      apiFetch<JobNumber>(`/sites/${siteId}/job-numbers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (siteId: string, id: string) =>
      apiFetch(`/sites/${siteId}/job-numbers/${id}`, { method: 'DELETE' }),
  },

  // Resource links (trackers, forms, references)
  resourceLinks: {
    list: () => apiFetch<ResourceLink[]>('/resource-links'),
    create: (data: Partial<ResourceLink>) =>
      apiFetch<ResourceLink>('/resource-links', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ResourceLink>) =>
      apiFetch<ResourceLink>(`/resource-links/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/resource-links/${id}`, { method: 'DELETE' }),
  },

  // Daily Tech Reports
  dailyTechReports: {
    list: (params: Record<string, string> = {}) =>
      apiFetch<DailyTechReport[]>('/daily-tech-reports?' + new URLSearchParams(params)),
    create: (data: Partial<DailyTechReport>) =>
      apiFetch<DailyTechReport>('/daily-tech-reports', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<DailyTechReport>) =>
      apiFetch<DailyTechReport>(`/daily-tech-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/daily-tech-reports/${id}`, { method: 'DELETE' }),
    uploadPhoto: async (file: File): Promise<string> => {
      const token = getToken()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/daily-tech-reports/photos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      return data.url as string
    },
  },

  // SyCool systems
  systems: {
    list: (siteId: string) => apiFetch<SycoolSystem[]>(`/sites/${siteId}/systems`),
    get: (id: string) => apiFetch<SycoolSystem>(`/systems/${id}`),
    create: (siteId: string, data: Partial<SycoolSystem>) =>
      apiFetch<SycoolSystem>(`/sites/${siteId}/systems`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<SycoolSystem>) =>
      apiFetch<SycoolSystem>(`/systems/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/systems/${id}`, { method: 'DELETE' }),
  },
}

export default API
