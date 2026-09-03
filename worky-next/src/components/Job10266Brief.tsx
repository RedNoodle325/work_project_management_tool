'use client'

import { useState } from 'react'
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, ClipboardCheck, ExternalLink, PackageSearch, Search, ShieldAlert, Wrench } from 'lucide-react'
import { job10266 } from '@/data/job10266'

type BriefView = 'overview' | 'work' | 'timeline' | 'parts' | 'service'

const views: Array<{ id: BriefView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work list' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'parts', label: 'Parts' },
  { id: 'service', label: 'Service' },
]

export function Job10266Brief() {
  const [view, setView] = useState<BriefView>('overview')
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const matches = (values: readonly unknown[]) => !normalized || values.some(value => String(value).toLowerCase().includes(normalized))

  const issues = job10266.issues.filter(issue => matches([issue.title, issue.scope, issue.status, issue.priority]))
  const unitActions = job10266.unitActions.filter(item => matches(item))
  const timeline = job10266.timeline.filter(item => matches(item))
  const parts = job10266.parts.filter(item => matches(item))
  const valves = job10266.valves.filter(item => matches(item))
  const service = job10266.service.filter(item => matches(item))

  return <div className="x-brief">
    <header className="x-brief-hero">
      <div>
        <span className="x-kicker">Job 10266 · decision brief</span>
        <h2>LG Alpha closeout command</h2>
        <p>{job10266.executiveStatus}</p>
      </div>
      <div className="x-brief-date"><CalendarClock size={18} /><span>Evidence reviewed through</span><strong>Sep 2, 2026</strong></div>
    </header>

    <div className="x-brief-alert"><ShieldAlert size={18} /><div><strong>Safety boundary</strong><p>{job10266.safetyNote}</p></div></div>

    <div className="x-brief-stats">
      <BriefStat value="5" label="Safety / production risks" tone="danger" />
      <BriefStat value="7" label="Equipment / controls" tone="warn" />
      <BriefStat value={job10266.parts.length} label="Part lines to verify" />
      <BriefStat value={job10266.service.filter(item => !item[3].toLowerCase().startsWith('marked resolved')).length} label="Support items open" />
    </div>

    <div className="x-brief-tools">
      <nav aria-label="Command brief views">{views.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
      {view !== 'overview' && <label><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Filter ${views.find(item => item.id === view)?.label.toLowerCase()}…`} /></label>}
    </div>

    {view === 'overview' && <Overview />}
    {view === 'work' && <WorkList issues={issues} unitActions={unitActions} />}
    {view === 'timeline' && <Timeline items={timeline} />}
    {view === 'parts' && <Parts items={parts} valves={valves} />}
    {view === 'service' && <Service items={service} />}

    <footer className="x-brief-provenance"><strong>Evidence standard</strong><span>{job10266.statusRule}</span><span>{job10266.source}</span></footer>
  </div>
}

function Overview() {
  return <div className="x-brief-overview">
    <section className="x-brief-panel x-brief-context"><header><span><Building2 size={17} /></span><div><h3>{job10266.facilityContext.title}</h3><p>Public program context · separate from field completion evidence</p></div></header><div className="x-brief-context-body"><p>{job10266.facilityContext.summary}</p><div>{job10266.facilityContext.facts.map(fact => <article key={fact.label}><span>{fact.label}</span><p>{fact.value}</p></article>)}</div></div><footer>{job10266.facilityContext.sources.map(source => <a href={source[1]} target="_blank" rel="noreferrer" key={source[1]}>{source[0]} <ExternalLink size={11} /></a>)}</footer></section>
    <section className="x-brief-panel x-brief-actions"><header><span><ClipboardCheck size={17} /></span><div><h3>Recommended next moves</h3><p>Ordered to remove safety and execution blockers first.</p></div></header><ol>{job10266.immediatePlan.map((item, index) => <li key={item}><b>{String(index + 1).padStart(2, '0')}</b><span>{item}</span></li>)}</ol></section>
    <aside>
      <section className="x-brief-panel x-brief-gaps"><header><span><AlertTriangle size={17} /></span><div><h3>Evidence gaps</h3><p>Treat these as verification tasks.</p></div></header>{job10266.gaps.map(gap => <p key={gap}>{gap}</p>)}</section>
      <section className="x-brief-panel x-brief-verified"><header><span><CheckCircle2 size={17} /></span><div><h3>Confirmed or partly corrected</h3><p>Completion is intentionally narrow.</p></div></header>{job10266.corrections.map(item => <details key={item[0]}><summary>{item[0]}</summary><p><b>Recorded:</b> {item[1]}</p><p><b>Still required:</b> {item[2]}</p></details>)}</section>
    </aside>
  </div>
}

function WorkList({ issues, unitActions }: { issues: typeof job10266.issues[number][]; unitActions: typeof job10266.unitActions[number][] }) {
  return <div className="x-brief-stack">
    {(['Safety / production', 'Equipment / controls'] as const).map(priority => <section className="x-brief-panel" key={priority}><header><span>{priority === 'Safety / production' ? <ShieldAlert size={17} /> : <Wrench size={17} />}</span><div><h3>{priority}</h3><p>{issues.filter(issue => issue.priority === priority).length} matching issues</p></div></header><div className="x-brief-issue-list">{issues.filter(issue => issue.priority === priority).map(issue => <article key={issue.title}><div><h4>{issue.title}</h4><p>{issue.scope}</p></div><span>{issue.status}</span></article>)}</div></section>)}
    <section className="x-brief-panel"><header><span><ClipboardCheck size={17} /></span><div><h3>Unit-level closure register</h3><p>Items requiring field verification.</p></div></header><div className="x-brief-unit-grid">{unitActions.map(item => <article key={item[0]}><strong>{item[0]}</strong><p>{item[1]}</p></article>)}</div></section>
  </div>
}

function Timeline({ items }: { items: typeof job10266.timeline[number][] }) {
  return <section className="x-brief-panel"><header><span><CalendarClock size={17} /></span><div><h3>Evidence timeline</h3><p>{items.length} matching events · newest first</p></div></header><div className="x-brief-timeline">{[...items].reverse().map(item => <article key={`${item[0]}-${item[1]}`}><time>{formatDate(item[0])}</time><div><strong>{item[1]}</strong><p>{item[2]}</p></div></article>)}</div></section>
}

function Parts({ items, valves }: { items: typeof job10266.parts[number][]; valves: typeof job10266.valves[number][] }) {
  return <div className="x-brief-stack"><section className="x-brief-panel"><header><span><PackageSearch size={17} /></span><div><h3>Parts and procurement</h3><p>{items.length} matching lines; status reflects the reviewed record.</p></div></header><div className="x-brief-table x-brief-parts-table"><div className="head"><span>Part</span><span>Description</span><span>Qty / use</span><span>Status</span></div>{items.map(item => <div className="row" key={`${item[0]}-${item[1]}-${item[2]}`}><code>{item[0]}</code><strong>{item[1]}</strong><span>{item[2]}</span><p>{item[3]}</p></div>)}</div></section><section className="x-brief-panel"><header><span><Wrench size={17} /></span><div><h3>Control-valve register</h3><p>Validate responsibility and formally release before action.</p></div></header><div className="x-brief-table x-brief-valve-table"><div className="head"><span>Group</span><span>Location</span><span>Part / issue</span></div>{valves.map(item => <div className="row" key={`${item[0]}-${item[1]}-${item[2]}`}><strong>{item[0]}</strong><code>{item[1]}</code><p>{item[2]}</p></div>)}</div></section></div>
}

function Service({ items }: { items: typeof job10266.service[number][] }) {
  return <section className="x-brief-panel"><header><span><Wrench size={17} /></span><div><h3>Service requests and support</h3><p>{items.length} matching records</p></div></header><div className="x-brief-service-list">{items.map(item => <article key={item[0]}><div><span>Request</span><h4>{item[0]}</h4></div><div><span>Scope</span><p>{item[1]}</p></div><div><span>Coordination</span><p>{item[2]}</p></div><div><span>Status</span><p>{item[3]}</p></div></article>)}</div></section>
}

function BriefStat({ value, label, tone = '' }: { value: string | number; label: string; tone?: string }) {
  return <div className={tone ? `is-${tone}` : ''}><strong>{value}</strong><span>{label}</span></div>
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
