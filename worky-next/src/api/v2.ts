import { getToken } from './index'
import type { AttachmentV2, HierarchyCustomerV2, LeanIssueV2, SiteScheduleChangeV2, SiteScheduleEventV2, SiteWorkspaceV2 } from '@/types/v2'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`/api/v2${path}`, {
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
  return response.json()
}

export const V2 = {
  dashboard: {
    get: () => request<Record<string, unknown>>('/dashboard'),
  },
  hierarchy: {
    list: () => request<HierarchyCustomerV2[]>('/hierarchy'),
    create: (data: Record<string, unknown>) => request('/hierarchy', { method: 'POST', body: JSON.stringify(data) }),
  },
  issues: {
    list: (siteId?: string) => request<LeanIssueV2[]>(`/issues${siteId ? `?site_id=${encodeURIComponent(siteId)}` : ''}`),
    create: (data: Record<string, unknown>) => request('/issues', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) => request<LeanIssueV2>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateNotes: (id: string, internal_notes: string) => request(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify({ internal_notes }) }),
    delete: (id: string) => request<void>(`/issues/${id}`, { method: 'DELETE' }),
    importCxAlloy: async (projectJobId: string, file: File) => {
      const token = getToken()
      const form = new FormData()
      form.set('project_job_id', projectJobId)
      form.set('file', file)
      const response = await fetch('/api/v2/issues/import', {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || `Import failed (${response.status})`)
      return payload as { imported: number; created: number; updated: number; serialColumnFound: boolean }
    },
  },
  sites: {
    get: (id: string) => request<SiteWorkspaceV2>(`/sites/${id}`),
    update: (id: string, data: Record<string, unknown>) => request(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/sites/${id}`, { method: 'DELETE' }),
    createRelated: (id: string, data: Record<string, unknown>) => request(`/sites/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    importEquipment: async (id: string, file: File) => {
      const token = getToken()
      const form = new FormData()
      form.set('file', file)
      const response = await fetch(`/api/v2/sites/${id}/units/import`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || `Import failed (${response.status})`)
      return payload as { created: number; updated: number; processed: number }
    },
    schedule: {
      list: (id: string) => request<{ events: SiteScheduleEventV2[]; changes: SiteScheduleChangeV2[] }>(`/sites/${id}/schedule`),
      create: (id: string, data: Record<string, unknown>) => request<SiteScheduleEventV2>(`/sites/${id}/schedule`, { method: 'POST', body: JSON.stringify(data) }),
      update: (siteId: string, eventId: string, data: Record<string, unknown>) => request<SiteScheduleEventV2>(`/sites/${siteId}/schedule/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    attachments: (id: string) => request<AttachmentV2[]>(`/sites/${id}/attachments`),
    upload: async (id: string, form: FormData) => {
      const token = getToken()
      const response = await fetch(`/api/v2/sites/${id}/attachments`, {
        method: 'POST', body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || `Upload failed (${response.status})`)
      return payload as AttachmentV2
    },
  },
  attachments: {
    open: async (id: string) => {
      const result = await request<{ url: string }>(`/attachments/${id}`)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    },
  },
  units: {
    get: (id: string) => request<Record<string, unknown>>(`/units/${id}`),
    update: (id: string, data: Record<string, unknown>) => request(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/units/${id}`, { method: 'DELETE' }),
  },
}
