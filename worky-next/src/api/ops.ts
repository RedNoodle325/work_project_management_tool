import { getToken } from './index'
import type { JobSchedule, PartsOrder, Technician } from '@/types/ops'

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
  technicians: {
    list: () => request<Technician[]>('/api/technicians'),
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
    update: (id: string, data: Record<string, unknown>) => request<JobSchedule>(`/api/job-schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/job-schedule/${id}`, { method: 'DELETE' }),
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
    commissionBulk: (siteId: string, updates: Array<{ unit_id: string; commission_level: string }>) =>
      request<{ updated: number }>(`/api/sites/${siteId}/units/commission-bulk`, { method: 'PUT', body: JSON.stringify({ updates }) }),
  },
}
