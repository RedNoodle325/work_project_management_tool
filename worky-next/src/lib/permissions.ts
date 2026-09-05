export const ROLES = ['owner', 'admin', 'service_ops', 'project_manager', 'sales', 'technician', 'scheduler', 'viewer'] as const

export type Role = (typeof ROLES)[number]
export type Permission = 'workspace:read' | 'workspace:write' | 'reports:write' | 'scheduler:manage' | 'users:manage' | 'service_requests:submit' | 'service_requests:review'

const permissions: Record<Role, readonly Permission[]> = {
  owner: ['workspace:read', 'workspace:write', 'reports:write', 'scheduler:manage', 'users:manage', 'service_requests:submit', 'service_requests:review'],
  admin: ['workspace:read', 'workspace:write', 'reports:write', 'scheduler:manage', 'service_requests:submit', 'service_requests:review'],
  service_ops: ['workspace:read', 'workspace:write', 'reports:write', 'scheduler:manage', 'service_requests:submit', 'service_requests:review'],
  project_manager: ['workspace:read', 'workspace:write', 'reports:write', 'service_requests:submit'],
  sales: ['workspace:read', 'service_requests:submit'],
  technician: ['workspace:read', 'reports:write'],
  scheduler: ['workspace:read', 'scheduler:manage'],
  viewer: ['workspace:read'],
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role)
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissions[role].includes(permission)
}

/** Maps the app's existing route groups to the permission they require to change data. */
export function permissionForRequest(pathname: string, method: string): Permission {
  if (pathname.startsWith('/api/service-requests')) {
    if (method === 'POST') return 'service_requests:submit'
    if (method === 'PATCH') return 'service_requests:review'
  }
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'workspace:read'
  if (pathname.startsWith('/api/users') || pathname.startsWith('/api/auth/scheduler-user')) return 'users:manage'
  if (
    pathname.startsWith('/api/job-schedule') ||
    pathname.startsWith('/api/dispatch') ||
    pathname.startsWith('/api/technicians')
  ) return 'scheduler:manage'
  if (pathname.startsWith('/api/daily-tech-reports')) return 'reports:write'
  return 'workspace:write'
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  service_ops: 'Service operations',
  project_manager: 'Project manager',
  sales: 'Sales',
  technician: 'Technician',
  scheduler: 'Scheduler',
  viewer: 'Viewer',
}
