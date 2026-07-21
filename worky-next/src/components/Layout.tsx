'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, type ReactNode } from 'react'
import { BookOpen, Building2, CalendarDays, LayoutDashboard, ListChecks, LogIn, LogOut, Menu, Search, X } from 'lucide-react'

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/sites', label: 'Sites', icon: Building2 },
  { href: '/issues', label: 'Issues', icon: ListChecks },
  { href: '/employee-scheduler', label: 'Employee Scheduler', icon: CalendarDays },
  { href: '/resources', label: 'Resources', icon: BookOpen },
]

export function Layout({ children }: { children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const schedulerOnly = user?.role === 'scheduler'
  const visibleNav = schedulerOnly ? nav.filter(item => item.href === '/employee-scheduler') : nav

  useEffect(() => {
    if (schedulerOnly && path !== '/employee-scheduler') router.replace('/employee-scheduler')
  }, [path, router, schedulerOnly])

  return <div className="x-shell">
    {open && <button className="x-mobile-shade" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`x-sidebar ${open ? 'open' : ''}`}>
      <div className="x-logo"><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><div><strong>Site Intelligence</strong><span>by XNRGY Climate Solutions</span></div><button onClick={() => setOpen(false)}><X size={18} /></button></div>
      <nav><span>{schedulerOnly ? 'Scheduler access' : 'Workspace'}</span>{visibleNav.map(item => { const Icon = item.icon; const active = item.href === '/' ? path === '/' : path.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setOpen(false)}><Icon size={18} /><span>{item.label}</span>{active && <i />}</Link> })}{user && !schedulerOnly && <Link href="/todos" className={path.startsWith('/todos') ? 'active' : ''} onClick={() => setOpen(false)}><ListChecks size={18} /><span>My To-Do List</span>{path.startsWith('/todos') && <i />}</Link>}</nav>
      <footer>{user ? <><div className="x-user-mark">{(user.name || user.email || 'Z').charAt(0).toUpperCase()}</div><div><strong>{user.name || 'Workspace owner'}</strong><span>{user.email}</span></div><button onClick={logout} title="Sign out"><LogOut size={17} /></button></> : <Link href="/login" className="x-public-sign-in"><LogIn size={17} /><span>Sign in to edit</span></Link>}</footer>
    </aside>
    <section className="x-main">
      <header className="x-mobile-head"><button onClick={() => setOpen(true)}><Menu size={20} /></button><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><span>Site Intelligence</span><Search size={18} /></header>
      {children}
    </section>
  </div>
}
