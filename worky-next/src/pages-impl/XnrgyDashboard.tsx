'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Building2, Clock3, FileText, Paperclip, Search, UsersRound, Wrench } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { AttachmentV2, SiteSummaryV2, SiteUpdateV2 } from '@/types/v2'

type FeedUpdate = SiteUpdateV2 & { site_name: string; customer_name: string; campus_code?: string; site_status: string }
type ActiveVisit = { id: string; technician_names?: string; summary?: string; started_at?: string; scheduled_for?: string }
type DashboardSite = SiteSummaryV2 & { customer_name: string; campus_code?: string; city: string; state: string; active_visits?: ActiveVisit[] }
type DashboardData = { customer_count: number; sites: DashboardSite[]; updates: FeedUpdate[]; documents: (AttachmentV2 & { site_name: string; campus_code?: string })[] }

export function XnrgyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => { V2.dashboard.get().then(value => setData(value as unknown as DashboardData)).catch(error => setError(error.message)) }, [])
  const sites = useMemo(() => data?.sites.filter(site => `${site.name} ${site.customer_name} ${site.campus_code} ${site.city}`.toLowerCase().includes(query.toLowerCase())) || [], [data, query])

  if (error) return <State title="The workspace is temporarily unavailable" detail={`${error}. Check the database connection and migrations, then refresh.`} />
  if (!data) return <State title="Opening your workspace" detail="Gathering the latest site activity…" />
  const needsAttention = data.sites.filter(site => ['attention', 'critical', 'offline'].includes(site.status))
  const openIssues = data.sites.reduce((total, site) => total + Number(site.open_issue_count), 0)
  const sitesWithTechs = data.sites.filter(site => site.active_visits?.length)
  const onSiteTechs = sitesWithTechs.flatMap(site => site.active_visits || []).flatMap(visit => splitTechs(visit.technician_names)).length

  return <div className="x-page">
    <header className="x-welcome">
      <div><span className="x-kicker">Field operations</span><h1>Site command center.</h1><p>See what needs attention, where the field team is, and what changed most recently.</p></div>
      <label className="x-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a customer, campus, or site…" /></label>
    </header>

    {query ? <section className="x-search-results"><div className="x-section-title"><div><span>Search</span><h2>{sites.length} matching sites</h2></div></div><div className="x-site-grid">{sites.map(site => <SiteCard key={site.id} site={site} />)}</div></section> : <>
      <section className="x-stat-row">
        <Stat icon={<Building2 />} value={data.sites.length} label="Sites tracked" />
        <Stat icon={<UsersRound />} value={onSiteTechs} label="Technicians on site" live={onSiteTechs > 0} />
        <Stat icon={<AlertTriangle />} value={openIssues} label="Open issues" warn={openIssues > 0} />
        <Stat icon={<Wrench />} value={needsAttention.length} label="Sites needing attention" warn={needsAttention.length > 0} />
      </section>

      <section className="x-card x-operations-card">
        <div className="x-section-title"><div><span>Live field status</span><h2>Sites right now</h2></div><Link href="/sites">All sites <ArrowRight size={15} /></Link></div>
        <div className="x-operations-list">
          {data.sites.map(site => <OperationsSite key={site.id} site={site} />)}
        </div>
      </section>

      <div className="x-dashboard-grid x-dashboard-grid-secondary">
        <section className="x-card x-feed-card">
          <div className="x-section-title"><div><span>Field notes</span><h2>Latest updates</h2></div><Link href="/sites">View sites <ArrowRight size={15} /></Link></div>
          <div className="x-feed">{data.updates.length ? data.updates.map(update => <Link href={`/sites/${update.site_id}`} className="x-feed-item" key={update.id}>
            <div className={`x-status-dot is-${update.status || update.site_status}`} />
            <div className="x-feed-body"><div><strong>{update.site_name}</strong><span>{[update.customer_name, update.campus_code].filter(Boolean).join(' · ')}</span></div><h3>{update.title || update.summary}</h3>{update.title && <p>{update.summary}</p>}<footer><time>{relative(update.created_at)}</time>{Number(update.attachment_count) > 0 && <span><Paperclip size={13} /> {update.attachment_count}</span>}</footer></div>
          </Link>) : <Empty text="Your site updates will collect here." />}</div>
        </section>

        <aside className="x-dashboard-side">
          <section className="x-card"><div className="x-section-title"><div><span>Field coverage</span><h2>Technicians on site</h2></div><b>{onSiteTechs}</b></div>{sitesWithTechs.length ? sitesWithTechs.map(site => <OnSiteTeam key={site.id} site={site} />) : <Empty text="No technicians are currently checked in." />}</section>
          <section className="x-card"><div className="x-section-title"><div><span>Library</span><h2>Recent files</h2></div></div><div className="x-file-list">{data.documents.map(file => <button key={file.id} onClick={() => V2.attachments.open(file.id)}><FileText size={17} /><span><strong>{file.file_name}</strong><small>{[file.site_name, file.campus_code].filter(Boolean).join(' · ')}</small></span><em>{file.category}</em></button>)}{!data.documents.length && <Empty text="POs, quotes, and reports will appear here." />}</div></section>
        </aside>
      </div>
    </>}
  </div>
}

function Stat({ icon, value, label, warn, live }: { icon: React.ReactNode; value: number; label: string; warn?: boolean; live?: boolean }) { return <div className={`x-stat ${warn ? 'is-warn' : ''} ${live ? 'is-live' : ''}`}><span>{icon}</span><div><strong>{value}</strong><small>{live && <i />} {label}</small></div></div> }
function OperationsSite({ site }: { site: DashboardSite }) { const technicians = (site.active_visits || []).flatMap(visit => splitTechs(visit.technician_names)); const visit = site.active_visits?.[0]; const summary = visit?.summary || site.status_summary || site.latest_update || 'No recent status note.'; return <Link href={`/sites/${site.id}`} className="x-operations-site"><div className={`x-status-dot is-${site.status}`} /><div className="x-operations-main"><div className="x-operations-title"><strong>{site.name}</strong><span>{[site.customer_name, site.campus_code, [site.city, site.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span></div><p>{summary}</p></div><div className="x-operations-metrics"><span className={`x-site-health is-${site.status}`}>{site.status.replace('_', ' ')}</span><small><AlertTriangle size={13} /> {site.open_issue_count || 0} open</small></div><div className="x-tech-cell">{technicians.length ? <><span className="x-on-site-label"><i /> On site</span><div className="x-tech-names">{technicians.map(name => <b key={name}>{initials(name)}<em>{name}</em></b>)}</div></> : <span className="x-unassigned"><Clock3 size={14} /> No active visit</span>}</div><ArrowRight size={16} /></Link> }
function OnSiteTeam({ site }: { site: DashboardSite }) { const technicians = (site.active_visits || []).flatMap(visit => splitTechs(visit.technician_names)); return <Link href={`/sites/${site.id}`} className="x-on-site-team"><div className="x-team-icon"><UsersRound size={16} /></div><div><strong>{site.name}</strong><span>{technicians.join(' · ')}</span></div><ArrowRight size={15} /></Link> }
function SiteCard({ site }: { site: DashboardSite }) { return <Link href={`/sites/${site.id}`} className="x-site-card"><div className={`x-status-dot is-${site.status}`} /><div><strong>{site.name}</strong><span>{[site.customer_name, site.campus_code].filter(Boolean).join(' · ')}</span><small>{site.city}, {site.state}</small></div><ArrowRight size={15} /></Link> }
function Empty({ text }: { text: string }) { return <div className="x-empty">{text}</div> }
function State({ title, detail }: { title: string; detail: string }) { return <div className="x-state"><div className="x-brand-line" /><h1>{title}</h1><p>{detail}</p></div> }
function relative(value: string) { const date = new Date(value); const days = Math.floor((Date.now() - date.getTime()) / 86400000); if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return `${days} days ago`; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function splitTechs(value?: string) { return (value || '').split(/[,;|]/).map(name => name.trim()).filter(Boolean) }
function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() }
