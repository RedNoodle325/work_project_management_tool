'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Boxes, CalendarDays, Download, FileText, Mail, MapPin, Paperclip, Phone, Plus, Send, Upload, UserRound, Wrench } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { AttachmentV2, SiteWorkspaceV2 } from '@/types/v2'

type Tab = 'updates' | 'issues' | 'parts' | 'units' | 'contacts' | 'files'
const categories = ['other', 'po', 'quote', 'invoice', 'submittal', 'email', 'photo', 'report']

export function XnrgySiteWorkspace() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SiteWorkspaceV2 | null>(null)
  const [tab, setTab] = useState<Tab>('updates')
  const [error, setError] = useState('')
  const load = () => V2.sites.get(id).then(setData).catch(error => setError(error.message))
  useEffect(() => { load() }, [id])
  if (error) return <div className="x-state"><h1>Couldn’t open this site</h1><p>{error}</p></div>
  if (!data) return <div className="x-state"><h1>Opening site</h1><p>Gathering notes, equipment, and documents…</p></div>
  const site = data.site
  const openIssues = data.issues.filter(issue => !['resolved', 'closed'].includes(issue.status))

  return <div className="x-site-page">
    <header className="x-site-header">
      <Link href="/sites" className="x-back"><ArrowLeft size={16} /> All sites</Link>
      <div className="x-site-heading"><div><div className="x-breadcrumb">{site.customer_name} <span>/</span> {site.campus_code}</div><h1>{site.name}</h1><p><MapPin size={14} /> {site.city}, {site.state} · {site.lifecycle_phase}</p></div><div className={`x-health-pill is-${site.status}`}><i />{site.status}</div></div>
      <div className="x-site-summary"><p>{site.latest_update || site.status_summary || 'No current status has been posted yet.'}</p><div><span><AlertTriangle size={15} /> {openIssues.length} open issues</span><span><Boxes size={15} /> {data.units.length} units</span><span><Paperclip size={15} /> {data.attachments.length} files</span></div></div>
    </header>

    <nav className="x-tabs">{(['updates','issues','parts','units','contacts','files'] as Tab[]).map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item === 'parts' ? 'Parts & service' : item}<Count value={item === 'updates' ? data.updates.length : item === 'issues' ? openIssues.length : item === 'parts' ? data.part_orders.length + data.service_visits.length : item === 'units' ? data.units.length : item === 'contacts' ? data.contacts.length : data.attachments.length} /></button>)}</nav>

    <main className="x-site-content">
      {tab === 'updates' && <Updates data={data} siteId={id} reload={load} />}
      {tab === 'issues' && <Issues data={data} />}
      {tab === 'parts' && <Parts data={data} />}
      {tab === 'units' && <Units data={data} />}
      {tab === 'contacts' && <Contacts data={data} />}
      {tab === 'files' && <Files files={data.attachments} siteId={id} reload={load} />}
    </main>
  </div>
}

function Updates({ data, siteId, reload }: { data: SiteWorkspaceV2; siteId: string; reload: () => void }) {
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('general')
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState('other')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { const update = await V2.sites.createRelated(siteId, { kind: 'update', summary, details, status: status || null, update_type: type }) as { id: string }; for (const file of files) { const form = new FormData(); form.set('file', file); form.set('category', category); form.set('update_id', update.id); await V2.sites.upload(siteId, form) } setSummary(''); setDetails(''); setStatus(''); setFiles([]); reload() } catch (error) { setError((error as Error).message) } finally { setSaving(false) } }
  return <div className="x-updates-layout"><div>
    <form className="x-composer" onSubmit={submit}><div className="x-composer-top"><span>New site note</span><div><select value={type} onChange={event => setType(event.target.value)}><option value="general">General</option><option value="status">Status</option><option value="service">Service</option><option value="parts">Parts</option><option value="commercial">Commercial</option><option value="milestone">Milestone</option></select><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Keep site status</option><option value="active">Active</option><option value="attention">Needs attention</option><option value="critical">Critical</option><option value="offline">Offline</option><option value="complete">Complete</option></select></div></div><input className="x-composer-title" value={summary} onChange={event => setSummary(event.target.value)} placeholder="What changed?" required /><textarea value={details} onChange={event => setDetails(event.target.value)} placeholder="Add the details you’ll want to remember later…" rows={4} />
      {files.length > 0 && <div className="x-upload-queue"><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select>{files.map(file => <span key={`${file.name}-${file.size}`}><FileText size={14} />{file.name}</span>)}</div>}
      <footer><label className="x-attach"><Paperclip size={16} /> Attach files<input type="file" multiple onChange={event => setFiles(Array.from(event.target.files || []))} /></label><button disabled={saving}><Send size={15} /> {saving ? 'Posting…' : 'Post update'}</button></footer>{error && <p className="x-error">{error}</p>}
    </form>
    <div className="x-timeline">{data.updates.map(update => <article key={update.id}><div className={`x-timeline-mark is-${update.status || 'general'}`}><i /></div><div className="x-note"><header><span>{update.update_type || 'update'}</span><time>{formatDate(update.created_at)}</time></header><h3>{update.title || update.summary}</h3>{update.title && <strong>{update.summary}</strong>}{update.details && <p>{update.details}</p>}<footer>{update.author_name && <span><UserRound size={13} /> {update.author_name}</span>}{Number(update.attachment_count) > 0 && <span><Paperclip size={13} /> {update.attachment_count} files</span>}</footer></div></article>)}{!data.updates.length && <Empty text="No updates yet. Post the first field note above." />}</div>
  </div><aside className="x-context-panel"><span className="x-kicker">At a glance</span><h2>Site context</h2><dl><div><dt>Status</dt><dd>{data.site.status}</dd></div><div><dt>Latest activity</dt><dd>{data.site.last_update_at ? formatDate(data.site.last_update_at) : 'None yet'}</dd></div><div><dt>Active ASRs</dt><dd>{data.asrs.filter(item => !['complete','cancelled'].includes(item.status)).length}</dd></div><div><dt>Pending parts</dt><dd>{data.part_orders.filter(item => !['received','installed','cancelled'].includes(String(item.status))).length}</dd></div></dl></aside></div>
}

function Issues({ data }: { data: SiteWorkspaceV2 }) { return <Section title="Issues & ASRs" intro="Every issue is tied to an ASR; several issues can share the same ASR."><div className="x-table"><div className="x-table-head"><span>Issue</span><span>Unit</span><span>ASR</span><span>Priority</span><span>Status</span></div>{data.issues.map(issue => <div className="x-table-row" key={issue.id}><strong>{issue.title}</strong><span>{issue.unit_tag || 'Site-wide'}</span><code>{issue.asr_number}</code><em className={`is-${issue.priority}`}>{issue.priority}</em><span>{issue.status}</span></div>)}</div>{!data.issues.length && <Empty text="No issues have been recorded for this site." />}</Section> }
function Parts({ data }: { data: SiteWorkspaceV2 }) { return <div className="x-two-col"><Section title="Part orders" intro="Quotes, orders, and receipts connected to ASRs.">{data.part_orders.map(order => <Record key={String(order.id)} icon={<FileText />} title={String(order.order_number || order.supplier || 'Parts request')} meta={`${String(order.asr_number)} · ${String(order.status)}`} />)}{!data.part_orders.length && <Empty text="No part orders yet." />}</Section><Section title="Service visits" intro="Scheduled and completed work at this site.">{data.service_visits.map(visit => <Record key={String(visit.id)} icon={<Wrench />} title={String(visit.summary || visit.asr_number)} meta={`${String(visit.status)}${visit.scheduled_for ? ` · ${formatDate(String(visit.scheduled_for))}` : ''}`} />)}{!data.service_visits.length && <Empty text="No service visits yet." />}</Section></div> }
function Units({ data }: { data: SiteWorkspaceV2 }) { return <Section title="Equipment" intro="Open a unit to see its serial information and full work history."><div className="x-unit-grid">{data.units.map(unit => <Link href={`/units/${unit.id}`} key={unit.id}><div><Boxes size={18} /><span>{unit.status}</span></div><h3>{unit.tag}</h3><p>{[unit.manufacturer, unit.model].filter(Boolean).join(' ') || 'Equipment details not entered'}</p><small>Serial · {unit.serial_number || 'Not entered'}</small></Link>)}</div>{!data.units.length && <Empty text="No units have been added." />}</Section> }
function Contacts({ data }: { data: SiteWorkspaceV2 }) { return <Section title="Site contacts" intro="People and roles that stay associated with this site."><div className="x-contact-grid">{data.contacts.map(contact => <article key={contact.id}><div><UserRound size={20} /></div><h3>{contact.name}</h3><p>{contact.role || contact.title || contact.company || 'Site contact'}</p>{contact.email && <a href={`mailto:${contact.email}`}><Mail size={14} />{contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}><Phone size={14} />{contact.phone}</a>}{contact.is_primary && <span>Primary contact</span>}</article>)}</div>{!data.contacts.length && <Empty text="No contacts are associated with this site." />}</Section> }
function Files({ files, siteId, reload }: { files: AttachmentV2[]; siteId: string; reload: () => void }) { const picker = useRef<HTMLInputElement>(null); const [category, setCategory] = useState('other'); const [busy, setBusy] = useState(false); const groups = useMemo(() => categories.map(category => ({ category, files: files.filter(file => file.category === category) })).filter(group => group.files.length), [files]); async function upload(list: FileList | null) { if (!list?.length) return; setBusy(true); try { for (const file of Array.from(list)) { const form = new FormData(); form.set('file', file); form.set('category', category); await V2.sites.upload(siteId, form) } reload() } finally { setBusy(false); if (picker.current) picker.current.value = '' } } return <Section title="Document library" intro="Private, site-specific storage for the paper trail."><div className="x-library-tools"><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select><button onClick={() => picker.current?.click()} disabled={busy}><Upload size={15} />{busy ? 'Uploading…' : 'Upload files'}</button><input ref={picker} hidden type="file" multiple onChange={event => upload(event.target.files)} /></div>{groups.map(group => <div className="x-file-group" key={group.category}><h3>{group.category}</h3>{group.files.map(file => <button key={file.id} onClick={() => V2.attachments.open(file.id)}><FileText size={18} /><span><strong>{file.file_name}</strong><small>{formatBytes(file.size_bytes)} · {formatDate(file.created_at)}{file.update_summary ? ` · ${file.update_summary}` : ''}</small></span><Download size={16} /></button>)}</div>)}{!files.length && <Empty text="Upload a PO, quote, invoice, submittal, email PDF, or report." />}</Section> }

function Section({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <section className="x-section"><header><div><h2>{title}</h2><p>{intro}</p></div></header>{children}</section> }
function Record({ icon, title, meta }: { icon: React.ReactNode; title: string; meta: string }) { return <div className="x-record"><span>{icon}</span><div><strong>{title}</strong><small>{meta}</small></div></div> }
function Empty({ text }: { text: string }) { return <div className="x-empty">{text}</div> }
function Count({ value }: { value: number }) { return value ? <span>{value}</span> : null }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1048576).toFixed(1)} MB` }
