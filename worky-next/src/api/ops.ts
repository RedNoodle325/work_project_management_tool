import { getToken } from './index'
import type { JobAssignmentLine, JobSchedule, PartsOrder, Technician, TechnicianCalendarEvent } from '@/types/ops'
import type { SiteSummaryV2, UnitV2 } from '@/types/v2'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const Ops = {
  jobSites: {
    create: (projectNumber: string, siteId?: string, siteZip?: string) => request<{ site: SiteSummaryV2; created_site: boolean; added_project: boolean }>('/api/job-sites', {
      method: 'POST',
      body: JSON.stringify({ project_number: projectNumber, site_id: siteId || undefined, site_zip: siteZip || undefined }),
    }),
  },
  technicianEvents: {
    list: () => request<TechnicianCalendarEvent[]>('/api/technician-events'),
    create: (data: Record<string, unknown>) => request<TechnicianCalendarEvent>('/api/technician-events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) => request<TechnicianCalendarEvent>(`/api/technician-events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/technician-events/${id}`, { method: 'DELETE' }),
  },
  technicians: {
    list: () => request<Technician[]>('/api/technicians'),
    forSite: (siteId: string) => request<Technician[]>(`/api/dispatch/techs-for-site/${siteId}`),
    create: (data: Record<string, unknown>) => request<Technician>('/api/technicians', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) => request<Technician>(`/api/technicians/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/technicians/${id}`, { method: 'DELETE' }),
  },
  jobSchedule: {
    list: (params?: { weekStart?: string; siteId?: string; technicianId?: string }) => {
      const query = new URLSearchParams()
      if (params?.weekStart) query.set('week_start', params.weekStart)
      if (params?.siteId) query.set('site_id', params.siteId)
      if (params?.technicianId) query.set('technician_id', params.technicianId)
      const qs = query.toString()
      return request<JobSchedule[]>(`/api/job-schedule${qs ? `?${qs}` : ''}`)
    },
    create: (data: Record<string, unknown>) => request<JobSchedule>('/api/job-schedule', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<JobSchedule>(`/api/job-schedule/${id}`),
    update: (id: string, data: Record<string, unknown>) => request<JobSchedule>(`/api/job-schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/job-schedule/${id}`, { method: 'DELETE' }),
    createLine: (id: string, data: Record<string, unknown>) => request<JobAssignmentLine>(`/api/job-schedule/${id}/lines`, { method: 'POST', body: JSON.stringify(data) }),
    updateLine: (id: string, lineId: string, data: Record<string, unknown>) => request<JobAssignmentLine>(`/api/job-schedule/${id}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLine: (id: string, lineId: string) => request<void>(`/api/job-schedule/${id}/lines/${lineId}`, { method: 'DELETE' }),
  },
  partsOrders: {
    list: (params?: { siteId?: string; status?: string }) => {
      const query = new URLSearchParams()
      if (params?.siteId) query.set('site_id', params.siteId)
      if (params?.status) query.set('status', params.status)
      const qs = query.toString()
      return request<PartsOrder[]>(`/api/parts-orders${qs ? `?${qs}` : ''}`)
    },
    create: (data: Record<string, unknown>) => request<PartsOrder>('/api/parts-orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) => request<PartsOrder>(`/api/parts-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/parts-orders/${id}`, { method: 'DELETE' }),
  },
  units: {
    forSite: (siteId: string) => request<UnitV2[]>(`/api/units?site_id=${encodeURIComponent(siteId)}`),
    updateBuildStage: (siteId: string, updates: Array<{
      unit_id: string; build_stage: string; ship_to?: string | null
      warranty_start_date?: string | null; warranty_end_date?: string | null; commissioning_status?: string
    }>) =>
      request<{ updated: number }>(`/api/sites/${siteId}/units/commission-bulk`, { method: 'PUT', body: JSON.stringify({ updates }) }),
  },
}
