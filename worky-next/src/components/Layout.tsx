'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useState, type ReactNode } from 'react'
import { Building2, ChevronRight, Files, LayoutDashboard, LogOut, Menu, Search, X } from 'lucide-react'

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/sites', label: 'Sites', icon: Building2 },
]

export function Layout({ children }: { children: ReactNode }) {
  const path = usePathname()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  return <div className="x-shell">
    {open && <button className="x-mobile-shade" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`x-sidebar ${open ? 'open' : ''}`}>
      <div className="x-logo"><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><div><strong>XNRGY</strong><span>Site intelligence</span></div><button onClick={() => setOpen(false)}><X size={18} /></button></div>
      <nav><span>Workspace</span>{nav.map(item => { const Icon = item.icon; const active = item.href === '/' ? path === '/' : path.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setOpen(false)}><Icon size={18} /><span>{item.label}</span>{active && <i />}</Link> })}</nav>
      <div className="x-sidebar-prompt"><Files size={18} /><strong>Keep the paper trail close.</strong><p>Attach POs, quotes, reports, and email PDFs directly to a site update.</p><Link href="/sites">Open sites <ChevronRight size={14} /></Link></div>
      <footer>{user && <><div className="x-user-mark">{(user.name || user.email || 'Z').charAt(0).toUpperCase()}</div><div><strong>{user.name || 'Workspace user'}</strong><span>{user.email}</span></div><button onClick={logout} title="Sign out"><LogOut size={17} /></button></>}</footer>
    </aside>
    <section className="x-main">
      <header className="x-mobile-head"><button onClick={() => setOpen(true)}><Menu size={20} /></button><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><span>XNRGY</span><Search size={18} /></header>
      {children}
    </section>
  </div>
}
