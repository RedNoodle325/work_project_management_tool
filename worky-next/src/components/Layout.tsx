'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useState, type ReactNode } from 'react'
import { BookOpen, Building2, CalendarDays, ClipboardCheck, LayoutDashboard, ListChecks, LogOut, Menu, Package, Search, Settings, X } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/sites', label: 'Sites', icon: Building2 },
  { href: '/issues', label: 'Issues', icon: ListChecks },
  { href: '/scheduler', label: 'Scheduler', icon: CalendarDays },
  { href: '/parts-orders', label: 'Part Orders', icon: Package },
  { href: '/commissioning', label: 'Commissioning', icon: ClipboardCheck },
  { href: '/resources', label: 'Resources', icon: BookOpen },
]

export function Layout({ children }: { children: ReactNode }) {
  const path = usePathname()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return <div className="x-shell">
    {open && <button className="x-mobile-shade" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`x-sidebar ${open ? 'open' : ''}`}>
      <div className="x-logo"><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><div><strong>Site Intelligence</strong><span>by XNRGY Climate Solutions</span></div><button onClick={() => setOpen(false)}><X size={18} /></button></div>
      <nav><span>Workspace</span>{nav.map(item => { const Icon = item.icon; const active = path === item.href || path.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setOpen(false)}><Icon size={18} /><span>{item.label}</span>{active && <i />}</Link> })}{user && <Link href="/todos" className={path.startsWith('/todos') ? 'active' : ''} onClick={() => setOpen(false)}><ListChecks size={18} /><span>My To-Do List</span>{path.startsWith('/todos') && <i />}</Link>}{user?.role === 'owner' && <Link href="/settings/users" className={path.startsWith('/settings/users') ? 'active' : ''} onClick={() => setOpen(false)}><Settings size={18} /><span>Users & permissions</span>{path.startsWith('/settings/users') && <i />}</Link>}</nav>
      <footer>{user && <><div className="x-user-mark">{(user.name || user.email || 'Z').charAt(0).toUpperCase()}</div><div><strong>{user.name || 'Workspace owner'}</strong><span>{user.email}</span></div><button onClick={logout} title="Sign out"><LogOut size={17} /></button></>}</footer>
    </aside>
    <section className="x-main">
      <header className="x-mobile-head"><button onClick={() => setOpen(true)}><Menu size={20} /></button><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><span>Site Intelligence</span><Search size={18} /></header>
      {children}
    </section>
  </div>
}
