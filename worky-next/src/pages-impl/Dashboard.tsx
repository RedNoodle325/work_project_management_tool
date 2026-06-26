'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { API } from '../api'
import { useToastFn } from '@/app/providers'
import type { Site, Issue, ServiceTicket, Todo, ResourceLink } from '../types'
import { ExternalLink, BookOpen } from 'lucide-react'


const STATUS_COLOR: Record<string, string> = {
  open:        '#dc2626',
  in_progress: '#d97706',
}

const STATUS_LABEL: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
}

// ── Stat digit ────────────────────────────────────────────────────────────────
function ScoreDigit({ value, label, color, onClick }: {
  value: number; label: string; color: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        padding: '8px 24px',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 36, lineHeight: 1, fontWeight: 700,
        color,
        letterSpacing: -1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 1,
        color: 'var(--text3)', textTransform: 'uppercase', marginTop: 3,
      }}>
        {label}
      </div>
    </div>
  )
}

export function Dashboard() {
  const toast = useToastFn()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<Site[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [serviceTickets, setServiceTickets] = useState<ServiceTicket[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [quickLinks, setQuickLinks] = useState<ResourceLink[]>([])

  useEffect(() => {
    Promise.all([
      API.sites.list(),
      API.issues.listAll().catch(() => [] as Issue[]),
      API.serviceTickets.listAll().catch(() => [] as ServiceTicket[]),
      API.todos.list({ status: 'todo' }).catch(() => [] as Todo[]),
      API.todos.list({ status: 'in_progress' }).catch(() => [] as Todo[]),
      API.resourceLinks.list().catch(() => [] as ResourceLink[]),
    ]).then(([s, i, st, todosOpen, todosInProgress, rl]) => {
      setSites(s)
      setIssues(i)
      setServiceTickets(st)
      const merged = [...todosInProgress, ...todosOpen].sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
        return (order[a.priority ?? 'normal'] ?? 2) - (order[b.priority ?? 'normal'] ?? 2)
      })
      setTodos(merged)
      setQuickLinks(rl)
    }).catch(e => {
      toast('Failed to load dashboard: ' + (e as Error).message, 'error')
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading…</div>
  }

  const siteMap = Object.fromEntries(sites.map(s => [s.id, s.name]))
  const isActiveIssue = (status: string) => status !== 'complete'
  const openIssues = issues.filter(i => isActiveIssue(i.status ?? 'open')).length
  const openTickets = serviceTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length
  const emergencyCount = sites.filter(s => {
    const si = issues.filter(i => i.site_id === s.id && isActiveIssue(i.status ?? 'open'))
    return si.some(i => i.priority === 'critical')
  }).length

  // Per-site issue counts, sorted: emergency → problem → operational
  const siteIssueStats = sites.map(s => {
    const si = issues.filter(i => i.site_id === s.id && isActiveIssue(i.status ?? 'open'))
    const critical = si.filter(i => i.priority === 'critical').length
    const high = si.filter(i => i.priority === 'high').length
    const total = si.length
    const status = critical > 0 ? 'emergency' : high > 0 ? 'problem' : 'operational'
    return { site: s, total, critical, high, status }
  }).filter(s => s.total > 0)
    .sort((a, b) => {
      const order: Record<string, number> = { emergency: 0, problem: 1, operational: 2 }
      return order[a.status] - order[b.status] || b.critical - a.critical || b.total - a.total
    })

  return (
    <div>
      {/* ── Dashboard Header ── */}
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 16,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Top accent bar */}
        <div style={{ height: 3, background: 'var(--accent)' }} />

        <div className="dash-header-inner">
          {/* Branding */}
          <div className="dash-branding">
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: 'var(--text)',
            }}>
              Project Overview Dashboard
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Field Ops · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Stats */}
          <div className="dash-stats">
            <ScoreDigit value={sites.length} label="Sites" color="var(--cyan)" />
            <ScoreDigit
              value={openIssues} label="Issues"
              color={openIssues > 0 ? 'var(--yellow)' : 'var(--text3)'}
              onClick={() => router.push('/issues')}
            />
            {emergencyCount > 0 && (
              <ScoreDigit
                value={emergencyCount} label="Emergency"
                color="var(--red)"
                onClick={() => router.push('/issues')}
              />
            )}
          </div>

          {/* Clock */}
          <div className="dash-clock">
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 20, fontWeight: 600, color: 'var(--text2)', lineHeight: 1,
            }}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
              Local time
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column: Site Issues Board + To-Do ── */}
      <div className="dash-two-col">

        {/* Site Issues Board */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{ height: 3, background: 'var(--yellow)' }} />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 12, fontWeight: 600, letterSpacing: 0.04, color: 'var(--text)',
            }}>
              Site Issues
            </span>
            <Link href="/issues" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>

          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 40px 40px 40px',
            padding: '4px 14px', borderBottom: '1px solid var(--border)',
          }}>
            {['SITE', 'TTL', 'CRIT', 'HIGH'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.06, color: 'var(--text3)', textAlign: h !== 'SITE' ? 'center' : 'left' }}>
                {h}
              </span>
            ))}
          </div>

          {siteIssueStats.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
              All clear — no open issues
            </div>
          ) : siteIssueStats.map(({ site, total, critical, high, status }) => {
            const statusColor = status === 'emergency' ? 'var(--red)' : status === 'problem' ? 'var(--orange)' : 'var(--green)'
            const statusColorHex = status === 'emergency' ? '#EF4444' : status === 'problem' ? '#F97316' : '#10B981'
            return (
              <div
                key={site.id}
                onClick={() => router.push(`/sites/${site.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 40px 40px 40px',
                  alignItems: 'center',
                  padding: '7px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: status === 'emergency' ? 'rgba(239,68,68,0.06)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColorHex, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {site.name}
                  </span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                  {total}
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: critical > 0 ? 'var(--red)' : 'var(--border)' }}>
                  {critical || '—'}
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: high > 0 ? 'var(--orange)' : 'var(--border)' }}>
                  {high || '—'}
                </div>
              </div>
            )
          })}

          {/* Sites with no issues — compact footer */}
          {(() => {
            const clean = sites.filter(s => !siteIssueStats.find(x => x.site.id === s.id))
            if (!clean.length) return null
            return (
              <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {clean.map(s => (
                  <span
                    key={s.id}
                    onClick={() => router.push(`/sites/${s.id}`)}
                    style={{
                      fontSize: 10, fontWeight: 500,
                      color: 'var(--green)', cursor: 'pointer',
                      background: 'rgba(16,185,129,0.08)', borderRadius: 4,
                      padding: '2px 7px', border: '1px solid rgba(16,185,129,0.2)',
                    }}
                  >
                    ✓ {s.name}
                  </span>
                ))}
              </div>
            )
          })()}
        </div>

        {/* To-Do widget */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{ height: 3, background: 'var(--accent)' }} />
          <div style={{ padding: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8,
          }}>
            <span style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 12, fontWeight: 600, color: 'var(--text)',
            }}>
              My To-Do
            </span>
            <Link href="/todos" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>

          {todos.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>
              Nothing on the list — enjoy it while it lasts
            </div>
          ) : (
            <>
              {todos.slice(0, 8).map(t => {
                const due = t.due_date ? new Date(t.due_date.includes('T') ? t.due_date : t.due_date + 'T00:00:00') : null
                const overdue = due && due < new Date() && t.status !== 'done'
                const priColor: Record<string, string> = { urgent: '#dc2626', high: '#ea580c', normal: '#2563eb', low: '#6b7280' }
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: priColor[t.priority ?? 'normal'], marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      {t.site_id && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{siteMap[t.site_id] || ''}</div>}
                    </div>
                    {overdue ? (
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>Overdue</span>
                    ) : due ? (
                      <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : null}
                  </div>
                )
              })}
              {todos.length > 8 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 6, textAlign: 'center' }}>+ {todos.length - 8} more</div>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* ── Quick Links ── */}
      {quickLinks.length > 0 && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 16,
        }}>
          <div style={{ height: 3, background: '#3b82f6' }} />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BookOpen size={13} color="#3b82f6" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Quick Links</span>
            </div>
            <Link href="/resources" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              Manage →
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px' }}>
            {quickLinks.map(link => link.url ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={11} />
                {link.name}
              </a>
            ) : (
              <span
                key={link.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--text3)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '5px 10px',
                }}
              >
                {link.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Site Cards ── */}
      {sites.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {sites.map(site => {
            const siteIssues = issues.filter(
              i => i.site_id === site.id && (i.status === 'open' || i.status === 'in_progress')
            )
            const hasCritical = siteIssues.some(i => i.priority === 'critical')
            const hasHigh = siteIssues.some(i => i.priority === 'high')
            const siteStatus = hasCritical
              ? { label: 'Emergency', colorHex: '#EF4444' }
              : hasHigh
              ? { label: 'Attention', colorHex: '#F97316' }
              : { label: 'Operational', colorHex: '#10B981' }

            return (
              <div
                key={site.id}
                onClick={() => router.push(`/sites/${site.id}`)}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  minHeight: 78,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ height: 3, background: siteStatus.colorHex }} />
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: siteStatus.colorHex, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: 0.04, color: siteStatus.colorHex,
                    }}>
                      {siteStatus.label}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  } as React.CSSProperties}>
                    {site.name}
                  </div>
                  {siteIssues.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: siteStatus.colorHex, lineHeight: 1 }}>
                        {siteIssues.length}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        open
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hidden — kept for StatusBadge/Link import usage */}
      <span style={{ display: 'none' }}>
        {Object.keys(STATUS_COLOR).map(k => STATUS_LABEL[k])}
      </span>
    </div>
  )
}
