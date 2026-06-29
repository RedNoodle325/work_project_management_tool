'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API } from '../api'
import { useToastFn } from '@/app/providers'
import { StatusBadge } from '../components/StatusBadge'
import type { Site, Ticket } from '../types'

const TICKET_TYPE_LABELS: Record<string, string> = {
  cs_ticket:    'ASR',
  parts_order:  'Parts Order',
  service_line: 'Service Line',
}

const TICKET_TYPE_STYLE: Record<string, { background: string; color: string }> = {
  cs_ticket:    { background: '#1e3a5f', color: '#60a5fa' },
  parts_order:  { background: '#431407', color: '#fb923c' },
  service_line: { background: '#14532d', color: '#4ade80' },
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#6b7280',
}

const STATUS_OPTIONS = ['open', 'parts_ordered', 'tech_dispatched', 'on_site', 'resolved', 'closed']
const TYPE_OPTIONS   = ['cs_ticket', 'parts_order', 'service_line']

export function Tickets() {
  const toast = useToastFn()
  const router = useRouter()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  async function load() {
    try {
      const [ticketData, siteData] = await Promise.all([
        API.tickets.list(),
        API.sites.list(),
      ])
      setTickets(ticketData)
      setSites(siteData)
    } catch (e) {
      toast('Error: ' + (e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function siteName(id?: string) {
    return id ? (sites.find(s => s.id === id)?.name || '—') : '—'
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ticket? This cannot be undone.')) return
    try {
      await API.tickets.delete(id)
      toast('Ticket deleted')
      load()
    } catch (e) {
      toast('Error: ' + (e as Error).message, 'error')
    }
  }

  const filtered = tickets.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      const matches =
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.unit_tag || '').toLowerCase().includes(q)
      if (!matches) return false
    }
    if (statusFilter && t.status !== statusFilter) return false
    if (typeFilter && t.ticket_type !== typeFilter) return false
    return true
  })

  function getTicketSummary(t: Ticket): string {
    if (t.ticket_type === 'parts_order') {
      return t.unit_tag ? `Unit: ${t.unit_tag}` : (t.title || '—')
    }
    return t.description || t.title || '—'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <div className="page-subtitle">CxAlloy punch list tickets</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => router.push('/tickets/new')}
        >
          + New Ticket
        </button>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-bar">
            <input
              placeholder="Search title, description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{TICKET_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <div className="toolbar-spacer" />
        </div>

        {/* Desktop table */}
        <div className="table-wrap desktop-only">
          {loading ? (
            <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title / Summary</th>
                  <th>Site</th>
                  <th>Unit Tag</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text3)' }}>No tickets found</td>
                  </tr>
                ) : (
                  filtered.map(t => {
                    const typeStyle = TICKET_TYPE_STYLE[t.ticket_type || ''] || {
                      background: 'var(--bg3)', color: 'var(--text2)',
                    }
                    return (
                      <tr key={t.id}>
                        <td>
                          <span className="badge" style={typeStyle}>
                            {TICKET_TYPE_LABELS[t.ticket_type || ''] || t.ticket_type || '—'}
                          </span>
                        </td>
                        <td
                          style={{
                            maxWidth: 220, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12,
                          }}
                          title={getTicketSummary(t)}
                        >
                          <span
                            onClick={() => router.push(`/tickets/${t.id}`)}
                            style={{ cursor: 'pointer', color: 'var(--accent)' }}
                          >
                            {getTicketSummary(t)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{siteName(t.site_id)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {t.unit_tag || '—'}
                        </td>
                        <td>
                          {t.priority ? (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: PRIORITY_COLOR[t.priority] || 'var(--text3)',
                              background: `${PRIORITY_COLOR[t.priority] || '#6b7280'}18`,
                              border: `1px solid ${PRIORITY_COLOR[t.priority] || '#6b7280'}44`,
                              borderRadius: 99, padding: '1px 7px',
                            }}>
                              {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                            </span>
                          ) : '—'}
                        </td>
                        <td><StatusBadge status={t.status} size="sm" /></td>
                        <td style={{ fontSize: 12 }}>
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => router.push(`/tickets/${t.id}`)}
                          >
                            Open
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ marginLeft: 4, color: 'var(--red)' }}
                            onClick={() => handleDelete(t.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile card list */}
        {loading ? (
          <div className="mobile-only" style={{ color: 'var(--text3)', padding: 32, textAlign: 'center' }}>Loading…</div>
        ) : (
          <div className="mobile-ticket-cards mobile-only">
            {filtered.length === 0 ? (
              <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 24 }}>No tickets found</div>
            ) : filtered.map(t => {
              const typeStyle = TICKET_TYPE_STYLE[t.ticket_type || ''] || {
                background: 'var(--bg3)', color: 'var(--text2)',
              }
              return (
                <div key={t.id} className="mobile-ticket-card" onClick={() => router.push(`/tickets/${t.id}`)}>
                  <div className="mtc-header">
                    <span className="badge" style={typeStyle}>
                      {TICKET_TYPE_LABELS[t.ticket_type || ''] || t.ticket_type || '—'}
                    </span>
                    <StatusBadge status={t.status} size="sm" />
                  </div>
                  <div className="mtc-title">{getTicketSummary(t)}</div>
                  <div className="mtc-meta">
                    <span>{siteName(t.site_id)}</span>
                    {t.unit_tag && <span className="mtc-tag">{t.unit_tag}</span>}
                  </div>
                  <div className="mtc-footer">
                    {t.priority && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: PRIORITY_COLOR[t.priority] || 'var(--text3)',
                        background: `${PRIORITY_COLOR[t.priority] || '#6b7280'}18`,
                        border: `1px solid ${PRIORITY_COLOR[t.priority] || '#6b7280'}44`,
                        borderRadius: 99, padding: '2px 8px',
                      }}>
                        {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                      </span>
                    )}
                    <span className="mtc-date">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                    </span>
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ color: 'var(--red)', padding: '4px 10px' }}
                      onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
