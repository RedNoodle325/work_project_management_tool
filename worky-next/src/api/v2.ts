import { getToken } from './index'
import type { AttachmentV2, HierarchyCustomerV2, SiteWorkspaceV2 } from '@/types/v2'

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
  sites: {
    get: (id: string) => request<SiteWorkspaceV2>(`/sites/${id}`),
    createRelated: (id: string, data: Record<string, unknown>) => request(`/sites/${id}`, { method: 'POST', body: JSON.stringify(data) }),
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
  },
}
