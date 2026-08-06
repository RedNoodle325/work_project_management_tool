export const ROLES = ['owner', 'admin', 'project_manager', 'technician', 'scheduler', 'viewer'] as const

export type Role = (typeof ROLES)[number]
export type Permission = 'workspace:read' | 'workspace:write' | 'reports:write' | 'scheduler:manage' | 'users:manage'

const permissions: Record<Role, readonly Permission[]> = {
  owner: ['workspace:read', 'workspace:write', 'reports:write', 'scheduler:manage', 'users:manage'],
  admin: ['workspace:read', 'workspace:write', 'reports:write', 'scheduler:manage'],
  project_manager: ['workspace:read', 'workspace:write', 'reports:write'],
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
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'workspace:read'
  if (pathname.startsWith('/api/users') || pathname.startsWith('/api/auth/scheduler-user')) return 'users:manage'
  if (
    pathname.startsWith('/api/employee-scheduler') ||
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
  project_manager: 'Project manager',
  technician: 'Technician',
  scheduler: 'Scheduler',
  viewer: 'Viewer',
}
