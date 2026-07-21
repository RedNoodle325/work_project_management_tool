'use client'

import { useEffect, useState } from 'react'
import { Clock3, Mail, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react'
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

  const totalUsers = users.length
  const privilegedUsers = users.filter(account => ['administrator', 'owner'].includes(account.access_role)).length
  const activeUsers = users.filter(account => account.last_login).length

  return <main className="x-page x-users-page">
    <header className="x-users-hero">
      <div><span className="x-kicker">Workspace settings</span><h1>Users <em>&amp;</em> permissions</h1><p>Give your team the right level of access to keep every site moving.</p></div>
      <div className="x-users-hero-mark" aria-hidden="true"><ShieldCheck size={28} /><span>Access<br />control</span></div>
    </header>
    {error && <p className="x-error">{error}</p>}
    <section className="x-users-overview" aria-label="User account summary">
      <article><span><UsersRound size={18} /></span><div><strong>{loading ? '—' : totalUsers}</strong><small>Team members</small></div></article>
      <article><span><ShieldCheck size={18} /></span><div><strong>{loading ? '—' : privilegedUsers}</strong><small>Elevated access</small></div></article>
      <article><span><Clock3 size={18} /></span><div><strong>{loading ? '—' : activeUsers}</strong><small>Signed in</small></div></article>
    </section>
    <section className="x-users-invite">
      <div className="x-users-invite-copy"><span><UserPlus size={18} /></span><div><h2>Invite a team member</h2><p>They’ll receive access with the role you choose below.</p></div></div>
      <form onSubmit={addUser} className="x-users-form">
        <label><span>Full name</span><input required placeholder="e.g. Jordan Lee" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
        <label><span>Work email</span><input required type="email" placeholder="name@xnrgy.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label><span>Temporary password</span><input required minLength={8} type="password" placeholder="8 characters minimum" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        <label><span>Initial role</span><select value={form.access_role} onChange={e => setForm({ ...form, access_role: e.target.value as Role })}>{ROLES.filter(role => role !== 'owner').map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        <button type="submit"><UserPlus size={16} />Add user</button>
      </form>
    </section>
    <section className="x-users-directory">
      <header><div><span className="x-kicker">Directory</span><h2>Your team</h2></div><p>{loading ? 'Loading accounts…' : `${totalUsers} ${totalUsers === 1 ? 'member' : 'members'} in this workspace`}</p></header>
      <div className="x-users-table">
        <div className="x-users-table-head"><span>Team member</span><span>Access role</span><span>Last signed in</span><span className="x-users-actions-label">Actions</span></div>
        <div className="x-users-table-body">
          {loading ? <div className="x-users-loading">Loading accounts…</div> : users.map(account => {
            const name = account.display_name || account.name || 'Unnamed user'
            const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
            return <article key={account.id} className="x-user-row">
              <div className="x-user-identity"><span className="x-user-avatar">{initials}</span><div><strong>{name}</strong><small><Mail size={12} />{account.email}</small></div></div>
              <div className="x-user-role"><select disabled={account.access_role === 'owner'} value={account.access_role} onChange={e => void changeRole(account.id, e.target.value as Role)}>{ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>{account.access_role === 'owner' && <small>Workspace owner</small>}</div>
              <div className="x-user-last-login"><Clock3 size={15} /><span>{account.last_login ? new Date(account.last_login).toLocaleDateString() : 'Never signed in'}</span></div>
              <div className="x-user-actions">{account.access_role !== 'owner' && <button type="button" onClick={() => void remove(account.id, name)} aria-label={`Remove ${name}`}><Trash2 size={15} /><span>Remove</span></button>}</div>
            </article>
          })}
        </div>
      </div>
    </section>
    <aside className="x-users-role-guide"><ShieldCheck size={18} /><p><strong>Role guide</strong> Viewer: read-only · Technician: daily tech reports · Project manager: project records · Scheduler: employee scheduling · Administrator: operational access · Owner: administrator access plus user management.</p></aside>
  </main>
}
