export type SiteHealth = 'planning' | 'active' | 'attention' | 'critical' | 'offline' | 'complete' | 'inactive'

export interface CustomerV2 {
  id: string
  name: string
  code?: string
  status: string
  location_count?: number
  site_count?: number
}

export interface LocationV2 {
  id: string
  customer_id: string
  campus_code: string
  name?: string
  city: string
  state: string
  status: string
  site_count?: number
  sites?: SiteSummaryV2[]
}

export interface SiteSummaryV2 {
  id: string
  location_id: string
  name: string
  site_code?: string
  building?: string
  status: SiteHealth
  lifecycle_phase: string
  status_summary?: string
  last_update_at?: string
  unit_count: number
  open_issue_count: number
  active_asr_count: number
  pending_part_order_count: number
  latest_update?: string
}

export interface HierarchyCustomerV2 extends CustomerV2 {
  locations: LocationV2[]
}

export interface ProjectV2 {
  id: string
  site_id: string
  project_number: string
  name: string
  status: string
  is_primary: boolean
}

export interface UnitV2 {
  id: string
  site_id: string
  project_id?: string
  tag: string
  serial_number?: string
  manufacturer?: string
  model?: string
  unit_type?: string
  location_in_site?: string
  status: string
}

export interface AsrV2 {
  id: string
  site_id: string
  project_id: string
  asr_number: string
  title: string
  description?: string
  status: string
  project_number?: string
  issue_count?: number
}

export interface IssueV2 {
  id: string
  site_id: string
  unit_id?: string
  asr_id: string
  title: string
  description?: string
  priority: string
  status: string
  asr_number?: string
  unit_tag?: string
  reported_at: string
}

export interface ContactV2 {
  id: string
  name: string
  company?: string
  title?: string
  email?: string
  phone?: string
  role?: string
  is_primary?: boolean
}

export interface SiteUpdateV2 {
  id: string
  site_id: string
  status?: SiteHealth
  summary: string
  details?: string
  author_name?: string
  created_at: string
  title?: string
  update_type?: 'general' | 'status' | 'service' | 'parts' | 'commercial' | 'milestone'
  is_pinned?: boolean
  attachment_count?: number
}

export interface AttachmentV2 {
  id: string
  site_id: string
  update_id?: string
  category: 'po' | 'quote' | 'invoice' | 'submittal' | 'email' | 'photo' | 'report' | 'other'
  file_name: string
  mime_type?: string
  size_bytes: number
  description?: string
  uploaded_by_name?: string
  update_summary?: string
  created_at: string
}

export interface SiteWorkspaceV2 {
  site: SiteSummaryV2 & { customer_id: string; customer_name: string; location_id: string; campus_code: string; city: string; state: string }
  projects: ProjectV2[]
  units: UnitV2[]
  contacts: ContactV2[]
  updates: SiteUpdateV2[]
  asrs: AsrV2[]
  issues: IssueV2[]
  part_orders: Array<Record<string, unknown>>
  service_visits: Array<Record<string, unknown>>
  attachments: AttachmentV2[]
}
