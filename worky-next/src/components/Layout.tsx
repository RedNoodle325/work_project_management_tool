'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useEditMode } from '@/contexts/EditModeContext'
import { useState, type ReactNode } from 'react'
import {
  LayoutDashboard, AlertTriangle, Users, FileText, 
  CheckSquare, Wrench, Sun, Moon, Eye, Pencil, 
  LogOut, Menu, ChevronLeft, BarChart2, BookOpen, Layers
} from 'lucide-react'

type NavItem = { to: string; label: string; Icon: React.ElementType; end?: boolean }
type NavSection = { section: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    section: '',
    items: [
      { to: '/', label: 'Dashboard', Icon: LayoutDashboard, end: true },
    ],
  },
  {
    section: 'Service',
    items: [
      { to: '/issues', label: 'Issues', Icon: AlertTriangle },
    ],
  },
  {
    section: 'Parts',
    items: [
      { to: '/bom', label: 'BOM / Parts', Icon: Layers },
    ],
  },
  {
    section: 'Field Ops',
    items: [
      { to: '/operations', label: 'Operations', Icon: Wrench },
      { to: '/todos',      label: 'To-Do',      Icon: CheckSquare },
    ],
  },
  {
    section: 'Sites',
    items: [
      { to: '/contacts', label: 'Contacts', Icon: Users },
      { to: '/notes',    label: 'Notes',    Icon: FileText },
    ],
  },
  {
    section: 'Tools',
    items: [
      { to: '/report',    label: 'Report',    Icon: BarChart2 },
      { to: '/resources', label: 'Resources', Icon: BookOpen },
    ],
  },
]

export function Layout({ children }: { children: ReactNode }) {
  // ... (The rest of your Layout component remains exactly the same from here down)
  const { logout, user } = useAuth()
  const { theme, toggle } = useTheme()
  const { editMode, toggleEditMode } = useEditMode()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div id="app">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 49 }}
        />
      )}

      {/* Sidebar */}
      <aside id="sidebar" className={`sidebar-responsive${sidebarOpen ? ' open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Hackazak" style={{ height: 36, width: 36, objectFit: 'contain' }} />
            <span className="sidebar-logo-m">Zak&apos;s Office</span>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {NAV.map(({ section, items }) => (
            <div key={section || '__top'}>
              {section && (
                <div className="nav-section-label">{section}</div>
              )}
              <ul className="nav-links">
                {items.map(({ to, label, Icon, end }) => (
                  <li key={to}>
                    <Link
                      href={to}
                      className={
                        end
                          ? pathname === to ? 'active' : ''
                          : pathname.startsWith(to) ? 'active' : ''
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon size={15} strokeWidth={1.8} />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-action-btn" onClick={toggleEditMode}>
            {editMode ? <Pencil size={13} /> : <Eye size={13} />}
            <span>{editMode ? 'Editing' : 'View Mode'}</span>
          </button>
          <button className="sidebar-action-btn" onClick={toggle}>
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              <span className="sidebar-user-name">{user.name || user.email}</span>
              <button className="sidebar-user-logout" onClick={logout} title="Sign out">
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="mobile-header">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <Menu size={20} />
        </button>
        <img src="/logo.png" alt="Hackazak" style={{ height: 32, width: 32, objectFit: 'contain' }} />
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ChevronLeft size={14} /> Back
        </button>
      </div>

      {/* Main content */}
      <main id="content" className="main-content">
        <div id="page-container">
          {children}
        </div>
      </main>
    </div>
  )
}
