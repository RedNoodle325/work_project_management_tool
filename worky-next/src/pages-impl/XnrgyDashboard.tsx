'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Building2, FileText, MapPin, Paperclip, Search, Wrench } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { AttachmentV2, SiteSummaryV2, SiteUpdateV2 } from '@/types/v2'

type FeedUpdate = SiteUpdateV2 & { site_name: string; customer_name: string; campus_code: string; site_status: string }
type DashboardData = { customer_count: number; sites: (SiteSummaryV2 & { customer_name: string; campus_code: string; city: string; state: string })[]; updates: FeedUpdate[]; documents: (AttachmentV2 & { site_name: string; campus_code: string })[] }

export function XnrgyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => { V2.dashboard.get().then(value => setData(value as unknown as DashboardData)).catch(error => setError(error.message)) }, [])
  const sites = useMemo(() => data?.sites.filter(site => `${site.name} ${site.customer_name} ${site.campus_code} ${site.city}`.toLowerCase().includes(query.toLowerCase())) || [], [data, query])

  if (error) return <State title="The workspace needs its notes migration" detail={`${error}. Run database/002_notes_and_attachments.sql in Supabase, then refresh.`} />
  if (!data) return <State title="Opening your workspace" detail="Gathering the latest site activity…" />
  const needsAttention = data.sites.filter(site => ['attention', 'critical', 'offline'].includes(site.status))
  const openIssues = data.sites.reduce((total, site) => total + Number(site.open_issue_count), 0)

  return <div className="x-page">
    <header className="x-welcome">
      <div><span className="x-kicker">Project intelligence</span><h1>Good morning.</h1><p>Everything worth knowing about your sites, in one calm place.</p></div>
      <label className="x-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a customer, campus, or site…" /></label>
    </header>

    {query ? <section className="x-search-results"><div className="x-section-title"><div><span>Search</span><h2>{sites.length} matching sites</h2></div></div><div className="x-site-grid">{sites.map(site => <SiteCard key={site.id} site={site} />)}</div></section> : <>
      <section className="x-stat-row">
        <Stat icon={<Building2 />} value={data.sites.length} label="Active sites" />
        <Stat icon={<MapPin />} value={data.customer_count} label="Customers" />
        <Stat icon={<AlertTriangle />} value={openIssues} label="Open issues" warn={openIssues > 0} />
        <Stat icon={<Wrench />} value={needsAttention.length} label="Need attention" warn={needsAttention.length > 0} />
      </section>

      <div className="x-dashboard-grid">
        <section className="x-card x-feed-card">
          <div className="x-section-title"><div><span>Field notes</span><h2>Latest updates</h2></div><Link href="/sites">View sites <ArrowRight size={15} /></Link></div>
          <div className="x-feed">{data.updates.length ? data.updates.map(update => <Link href={`/sites/${update.site_id}`} className="x-feed-item" key={update.id}>
            <div className={`x-status-dot is-${update.status || update.site_status}`} />
            <div className="x-feed-body"><div><strong>{update.site_name}</strong><span>{update.customer_name} · {update.campus_code}</span></div><h3>{update.title || update.summary}</h3>{update.title && <p>{update.summary}</p>}<footer><time>{relative(update.created_at)}</time>{Number(update.attachment_count) > 0 && <span><Paperclip size={13} /> {update.attachment_count}</span>}</footer></div>
          </Link>) : <Empty text="Your site updates will collect here." />}</div>
        </section>

        <aside className="x-dashboard-side">
          <section className="x-card"><div className="x-section-title"><div><span>Priority</span><h2>Needs attention</h2></div><b>{needsAttention.length}</b></div>{needsAttention.length ? needsAttention.slice(0, 5).map(site => <SiteCard key={site.id} site={site} compact />) : <Empty text="Nothing urgent. A beautiful sight." />}</section>
          <section className="x-card"><div className="x-section-title"><div><span>Library</span><h2>Recent files</h2></div></div><div className="x-file-list">{data.documents.map(file => <button key={file.id} onClick={() => V2.attachments.open(file.id)}><FileText size={17} /><span><strong>{file.file_name}</strong><small>{file.site_name} · {file.campus_code}</small></span><em>{file.category}</em></button>)}{!data.documents.length && <Empty text="POs, quotes, and reports will appear here." />}</div></section>
        </aside>
      </div>
    </>}
  </div>
}

function Stat({ icon, value, label, warn }: { icon: React.ReactNode; value: number; label: string; warn?: boolean }) { return <div className={`x-stat ${warn ? 'is-warn' : ''}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }
function SiteCard({ site, compact }: { site: DashboardData['sites'][number]; compact?: boolean }) { return <Link href={`/sites/${site.id}`} className={`x-site-card ${compact ? 'is-compact' : ''}`}><div className={`x-status-dot is-${site.status}`} /><div><strong>{site.name}</strong><span>{site.customer_name} · {site.campus_code}</span>{!compact && <small>{site.city}, {site.state}</small>}</div><ArrowRight size={15} /></Link> }
function Empty({ text }: { text: string }) { return <div className="x-empty">{text}</div> }
function State({ title, detail }: { title: string; detail: string }) { return <div className="x-state"><div className="x-brand-line" /><h1>{title}</h1><p>{detail}</p></div> }
function relative(value: string) { const date = new Date(value); const days = Math.floor((Date.now() - date.getTime()) / 86400000); if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return `${days} days ago`; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
