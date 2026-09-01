'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Paperclip } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { AttachmentV2, SiteSummaryV2, SiteUpdateV2 } from '@/types/v2'

type FeedUpdate = SiteUpdateV2 & { site_name: string; customer_name: string; campus_code?: string; site_status: string }
type ActiveVisit = { id: string; technician_names?: string; summary?: string; started_at?: string; scheduled_for?: string }
type DashboardSite = SiteSummaryV2 & { customer_name: string; campus_code?: string; city: string; state: string; active_visits?: ActiveVisit[] }
type DashboardData = { customer_count: number; sites: DashboardSite[]; updates: FeedUpdate[]; documents: (AttachmentV2 & { site_name: string; campus_code?: string })[] }

export function XnrgyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { V2.dashboard.get().then(value => setData(value as unknown as DashboardData)).catch(error => setError(error.message)) }, [])

  if (error) return <State title="The workspace is temporarily unavailable" detail={`${error}. Check the database connection and migrations, then refresh.`} />
  if (!data) return <State title="Opening your workspace" detail="Gathering the latest site activity…" />
  const needsAttention = data.sites.filter(site => ['attention', 'critical', 'offline'].includes(site.status))
  const openIssues = data.sites.reduce((total, site) => total + Number(site.open_issue_count), 0)
  const sitesWithTechs = data.sites.filter(site => site.active_visits?.length)
  const onSiteTechs = sitesWithTechs.flatMap(site => site.active_visits || []).flatMap(visit => splitTechs(visit.technician_names)).length
  const attentionUpdates = data.updates.filter(update => ['attention', 'critical', 'offline'].includes(update.status || update.site_status))

  return <div className="x-page">
    <header className="x-welcome x-command-head">
      <div><span className="x-kicker">Field operations</span><h1>Command center</h1><p>{data.sites.length} sites, one program. What needs attention, where commissioning stands, and what is inbound.</p></div>
      <div className="x-command-actions"><Link href="/report">Weekly report</Link><Link className="primary" href="/tickets">New work order</Link></div>
    </header>
      <section className="x-stat-row">
        <Stat value={data.sites.length} label="Sites tracked" />
        <Stat value={onSiteTechs} label="Technicians on site" live={onSiteTechs > 0} />
        <Stat value={openIssues} label="Open issues" warn={openIssues > 0} />
        <Stat value={needsAttention.length} label="Sites needing attention" critical={needsAttention.length > 0} />
      </section>

      <div className="x-command-grid">
        <section className="x-attention-column">
          <div className="x-column-label"><span>Needs attention</span><small>{attentionUpdates.length || needsAttention.length} items across {needsAttention.length} sites</small></div>
          {needsAttention.length ? needsAttention.map(site => <AttentionSite key={site.id} site={site} updates={data.updates.filter(update => update.site_id === site.id)} />) : <div className="x-card"><Empty text="No sites need attention right now." /></div>}
          <section className="x-card x-feed-card"><div className="x-section-title"><div><span>Field notes</span><h2>Latest updates</h2></div></div><div className="x-feed">{data.updates.slice(0, 5).map(update => <Link href={`/sites/${update.site_id}`} className="x-feed-item" key={update.id}><div className={`x-status-dot is-${update.status || update.site_status}`} /><div className="x-feed-body"><div><strong>{update.site_name}</strong><span>{relative(update.created_at)}</span></div><h3>{update.title || update.summary}</h3>{update.title && <p>{update.summary}</p>}<footer>{Number(update.attachment_count) > 0 && <span><Paperclip size={13} /> {update.attachment_count}</span>}</footer></div></Link>)}</div></section>
        </section>
        <aside className="x-dashboard-side">
          <section className="x-card x-rollup"><div className="x-section-title"><div><span>Program status</span><h2>Commissioning by site</h2></div></div>{data.sites.map(site => <CommissioningRow key={site.id} site={site} />)}</section>
          <section className="x-card"><div className="x-section-title"><div><span>Supply chain</span><h2>Recent files</h2></div><Link href="/resources">All</Link></div><div className="x-file-list">{data.documents.slice(0, 5).map(file => <button key={file.id} onClick={() => V2.attachments.open(file.id)}><FileText size={17} /><span><strong>{file.file_name}</strong><small>{[file.site_name, file.campus_code].filter(Boolean).join(' · ')}</small></span><em>{file.category}</em></button>)}{!data.documents.length && <Empty text="POs, quotes, and reports will appear here." />}</div></section>
        </aside>
      </div>
  </div>
}

function Stat({ value, label, warn, live, critical }: { value: number; label: string; warn?: boolean; live?: boolean; critical?: boolean }) { return <div className={`x-stat ${warn ? 'is-warn' : ''} ${live ? 'is-live' : ''} ${critical ? 'is-critical' : ''}`}><strong>{value}</strong><small>{label}</small></div> }
function AttentionSite({ site, updates }: { site: DashboardSite; updates: FeedUpdate[] }) { const rows = updates.length ? updates.slice(0, 3) : [{ id: `${site.id}-status`, summary: site.status_summary || site.latest_update || `${site.open_issue_count || 0} open issues require review.`, status: site.status, created_at: '', site_id: site.id, site_name: site.name, customer_name: site.customer_name, site_status: site.status } as FeedUpdate]; return <section className="x-attention-site"><header><span className={`x-square-status is-${site.status}`} /><div><strong>{site.name}</strong><small>{[site.customer_name, site.campus_code, [site.city, site.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</small></div><em>{site.status.replace('_', ' ')}</em><Link href={`/sites/${site.id}`}>Open site</Link></header>{rows.map(update => <div className="x-attention-row" key={update.id}><b>{update.status === 'critical' ? 'Issue' : 'Update'}</b><p>{update.title || update.summary}</p><span>{update.created_at ? relative(update.created_at) : `${site.open_issue_count || 0} open`}</span></div>)}</section> }
function CommissioningRow({ site }: { site: DashboardSite }) { const pct = Math.max(0, Math.min(100, Number(site.commissioning_percent || 0))); return <Link href={`/sites/${site.id}`} className="x-commissioning-row"><div><strong>{site.name}</strong><span>{pct}%</span></div><i><b style={{ width: `${pct}%` }} /></i><small>{site.unit_count || 0} units · {site.open_issue_count || 0} open issues</small></Link> }
function Empty({ text }: { text: string }) { return <div className="x-empty">{text}</div> }
function State({ title, detail }: { title: string; detail: string }) { return <div className="x-state"><div className="x-brand-line" /><h1>{title}</h1><p>{detail}</p></div> }
function relative(value: string) { const date = new Date(value); const days = Math.floor((Date.now() - date.getTime()) / 86400000); if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return `${days} days ago`; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function splitTechs(value?: string) { return (value || '').split(/[,;|]/).map(name => name.trim()).filter(Boolean) }
