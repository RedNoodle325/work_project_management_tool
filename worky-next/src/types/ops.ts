export interface Technician {
  id: string
  name: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  home_zip?: string
  location_city?: string
  location_state?: string
  latitude?: number
  longitude?: number
  distance_miles?: number | string | null
  distance_kind?: 'driving' | 'straight_line'
  color?: string
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export type JobStatus = 'scheduled' | 'in_progress' | 'on_hold' | 'complete' | 'cancelled'

export interface JobSchedule {
  id: string
  site_id: string
  site_name: string
  site_city?: string
  site_state?: string
  pm_id?: string
  job_name: string
  job_type: string
  contract_number?: string
  priority: number
  start_date?: string
  end_date?: string
  status: JobStatus
  notes?: string
  scope?: string
  techs_needed: number
  technicians: Array<{ id: string; name: string; color?: string }>
  created_at: string
  updated_at: string
}

export type PartsOrderStatus = 'needed' | 'ordered' | 'shipped' | 'received' | 'installed' | 'cancelled'

export interface PartsOrder {
  id: string
  site_id: string
  site_name: string
  job_id?: string
  job_name?: string
  part_number?: string
  description: string
  quantity: string | number
  status: PartsOrderStatus
  supplier?: string
  order_number?: string
  requested_by?: string
  ordered_at?: string
  expected_at?: string
  received_at?: string
  notes?: string
  created_at: string
  updated_at: string
}
