'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useState, type ReactNode } from 'react'
import { Menu, Moon, Search, Sun, X } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Command center' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/sites', label: 'Sites' },
  { href: '/issues', label: 'Issues' },
  { href: '/scheduler', label: 'Scheduler' },
  { href: '/parts-orders', label: 'Part orders' },
  { href: '/commissioning', label: 'Commissioning' },
  { href: '/resources', label: 'Resources' },
  { href: '/todos', label: 'My to-do list' },
]

export function Layout({ children }: { children: ReactNode }) {
  const path = usePathname()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)

  return <div className="x-shell">
    {open && <button className="x-mobile-shade" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`x-sidebar ${open ? 'open' : ''}`}>
      <div className="x-logo"><Image src="/brand/xnrgy-mark.svg" width={28} height={28} alt="XNRGY" /><div><strong>Site Intelligence</strong><span>XNRGY Climate Systems</span></div><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav><span>Program</span>{nav.map(item => { const active = path === item.href || path.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setOpen(false)}><i /><span>{item.label}</span></Link> })}</nav>
      <div className="x-sidebar-bottom">
        <button className="x-theme-toggle" onClick={toggle}><span>{theme === 'dark' ? 'Light canvas' : 'Dark canvas'}</span>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
        <footer><div className="x-user-mark">X</div><div><strong>Program workspace</strong><span>Open access</span></div></footer>
      </div>
    </aside>
    <section className="x-main"><div className="x-brand-topline" />
      <header className="x-mobile-head"><button onClick={() => setOpen(true)}><Menu size={20} /></button><Image src="/brand/xnrgy-mark.svg" width={28} height={28} alt="XNRGY" /><span>Site Intelligence</span><Search size={18} /></header>
      {children}
    </section>
  </div>
}
