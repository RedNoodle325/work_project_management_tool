'use client'

import { useEffect, useState } from 'react'
import { API } from '@/api'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS, ROLES, type Role } from '@/lib/permissions'
import type { User } from '@/types'

type ManagedUser = User & { access_role: Role; display_name?: string; last_login?: string }

export function UserManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ display_name: '', email: '', password: '', access_role: 'viewer' as Role })

  const load = async () => {
    setLoading(true)
    try { setUsers(await API.auth.listUsers() as ManagedUser[]); setError('') }
    catch { setError('Unable to load user accounts.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (user?.role === 'owner') void load(); else setLoading(false) }, [user?.role])

  if (user?.role !== 'owner') return <main className="x-page"><h1>Access denied</h1><p>Only the workspace owner can manage user accounts and roles.</p></main>

  const addUser = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await API.auth.createUser(form)
      setForm({ display_name: '', email: '', password: '', access_role: 'viewer' })
      await load()
    } catch { setError('Could not create the account. Check the details and try again.') }
  }
  const changeRole = async (id: string, access_role: Role) => {
    try { await API.auth.updateUser(id, { access_role }); await load() }
    catch { setError('Could not update that role.') }
  }
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s access?`)) return
    try { await API.auth.deleteUser(id); await load() }
    catch { setError('Could not remove that account.') }
  }

  return <main className="x-page" style={{ maxWidth: 980 }}>
    <div className="x-page-title"><div><span className="x-kicker">Workspace settings</span><h1>Users & permissions</h1><p>Roles are checked by the API on every request, so changing a role takes effect immediately.</p></div></div>
    {error && <p className="x-error">{error}</p>}
    <section className="x-card" style={{ padding: 24, marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Add a user</h2>
      <form onSubmit={addUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 12, alignItems: 'end' }}>
        <label><span>Name</span><input required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
        <label><span>Email</span><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label><span>Temporary password</span><input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        <label><span>Role</span><select value={form.access_role} onChange={e => setForm({ ...form, access_role: e.target.value as Role })}>{ROLES.filter(role => role !== 'owner').map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        <button className="btn btn-primary">Add user</button>
      </form>
    </section>
    <section className="x-card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">User</th><th align="left">Role</th><th align="left">Last signed in</th><th /></tr></thead>
        <tbody>{loading ? <tr><td colSpan={4} style={{ padding: 18 }}>Loading accounts…</td></tr> : users.map(account => <tr key={account.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: 14 }}><strong>{account.display_name || account.name || 'Unnamed user'}</strong><br /><small>{account.email}</small></td><td><select disabled={account.access_role === 'owner'} value={account.access_role} onChange={e => void changeRole(account.id, e.target.value as Role)}>{ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></td><td><small>{account.last_login ? new Date(account.last_login).toLocaleDateString() : 'Never'}</small></td><td align="right">{account.access_role !== 'owner' && <button className="btn btn-secondary" onClick={() => void remove(account.id, account.display_name || account.email)}>Remove</button>}</td></tr>)}</tbody>
      </table>
    </section>
    <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 16 }}>Viewer: read-only. Technician: can submit daily tech reports. Project manager: can manage project records. Scheduler: can manage the employee scheduler. Administrator: all operational access. Owner: administrators plus user management.</p>
  </main>
}
