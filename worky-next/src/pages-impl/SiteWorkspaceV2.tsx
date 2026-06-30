'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, Boxes, ClipboardList, Contact, PackageSearch, Plus, RefreshCw, Wrench } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { SiteWorkspaceV2 } from '@/types/v2'
import { Modal } from '@/components/Modal'

type CreateKind = 'update' | 'project' | 'unit' | 'contact' | 'asr' | 'issue' | 'part_order' | 'service_visit'

export function SiteWorkspaceV2Page() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SiteWorkspaceV2 | null>(null)
  const [error, setError] = useState('')
  const [create, setCreate] = useState<CreateKind | null>(null)
  const load = () => V2.sites.get(id).then(setData).catch(error => setError(error.message))
  useEffect(() => { load() }, [id])
  if (error) return <div className="ops-empty">{error}</div>
  if (!data) return <div className="ops-loading">Loading site workspace…</div>
  const { site } = data

  return (
    <div className="ops-page">
      <div className="ops-breadcrumb"><Link href="/sites">{site.customer_name}</Link><span>/</span><Link href="/sites">{site.campus_code}</Link><span>/</span><strong>{site.name}</strong></div>
      <header className="ops-site-hero">
        <div className={`ops-site-status ops-site-status-${site.status}`}><span className={`ops-health ops-health-${site.status}`} />{site.status}</div>
        <div><p className="ops-eyebrow">{site.campus_code} · {site.city}, {site.state}</p><h1>{site.name}</h1><p>{site.latest_update || site.status_summary || 'No current update recorded.'}</p></div>
        <button className="ops-button ops-button-secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </header>

      <section className="ops-metrics ops-site-metrics">
        <Mini icon={<Boxes />} value={data.units.length} label="Units" />
        <Mini icon={<AlertTriangle />} value={data.issues.filter(i => !['resolved','closed'].includes(i.status)).length} label="Open issues" />
        <Mini icon={<ClipboardList />} value={data.asrs.filter(a => !['complete','cancelled'].includes(a.status)).length} label="Active ASRs" />
        <Mini icon={<PackageSearch />} value={data.part_orders.filter(order => !['received','installed','cancelled'].includes(String(order.status))).length} label="Parts pending" />
      </section>

      <div className="ops-site-grid">
        <Panel title="Current updates" action="Add update" onAction={() => setCreate('update')} wide>
          {data.updates.length ? data.updates.slice(0, 6).map(update => <article className="ops-timeline-item" key={update.id}><span className={`ops-health ops-health-${update.status || site.status}`} /><div><strong>{update.summary}</strong>{update.details && <p>{update.details}</p>}<small>{date(update.created_at)}{update.author_name ? ` · ${update.author_name}` : ''}</small></div></article>) : <Empty text="No site updates yet." />}
        </Panel>
        <Panel title="Contacts" action="Add contact" onAction={() => setCreate('contact')}>
          {data.contacts.length ? data.contacts.map(contact => <div className="ops-contact" key={contact.id}><Contact size={15} /><div><strong>{contact.name}</strong><small>{contact.role || contact.title || contact.company}</small></div>{contact.is_primary && <span>Primary</span>}</div>) : <Empty text="No contacts assigned." />}
        </Panel>
        <Panel title="Issues" action="Add issue" onAction={() => setCreate('issue')} wide>
          <div className="ops-list-head"><span>Issue</span><span>Unit</span><span>ASR</span><span>Status</span></div>
          {data.issues.length ? data.issues.map(issue => <div className="ops-list-row" key={issue.id}><strong>{issue.title}</strong><span>{issue.unit_tag || 'Site-wide'}</span><span className="ops-mono">{issue.asr_number}</span><span className={`ops-badge ops-badge-${issue.priority}`}>{issue.status}</span></div>) : <Empty text="No issues recorded." />}
        </Panel>
        <Panel title="ASRs" action="Create ASR" onAction={() => setCreate('asr')}>
          {data.asrs.length ? data.asrs.map(asr => <div className="ops-asr" key={asr.id}><div><strong className="ops-mono">{asr.asr_number}</strong><p>{asr.title}</p></div><span>{asr.issue_count || 0} issues</span></div>) : <Empty text="No ASRs yet." />}
        </Panel>
        <Panel title="Units" action="Add unit" onAction={() => setCreate('unit')} wide>
          <div className="ops-unit-grid">{data.units.map(unit => <Link href={`/units/${unit.id}`} className="ops-unit-card" key={unit.id}><div><strong>{unit.tag}</strong><span>{unit.status}</span></div><p>{unit.manufacturer} {unit.model}</p><small>Serial: {unit.serial_number || '—'}</small></Link>)}</div>
          {!data.units.length && <Empty text="No equipment added." />}
        </Panel>
        <Panel title="Projects" action="Add project" onAction={() => setCreate('project')}>
          {data.projects.map(project => <div className="ops-project" key={project.id}><strong className="ops-mono">{project.project_number}</strong><span>{project.name}</span></div>)}
          {!data.projects.length && <Empty text="Add a project before creating an ASR." />}
        </Panel>
        <Panel title="Parts" action="Add order" onAction={() => setCreate('part_order')}>
          {data.part_orders.map(order => <div className="ops-project" key={String(order.id)}><strong>{String(order.order_number || order.supplier || 'Parts needed')}</strong><span>{String(order.status)}</span></div>)}
          {!data.part_orders.length && <Empty text="No part orders." />}
        </Panel>
        <Panel title="Service" action="Schedule" onAction={() => setCreate('service_visit')}>
          {data.service_visits.map(visit => <div className="ops-project" key={String(visit.id)}><strong>{String(visit.asr_number)}</strong><span>{String(visit.status)}</span></div>)}
          {!data.service_visits.length && <Empty text="No service visits." />}
        </Panel>
      </div>
      {create && <CreateModal kind={create} data={data} siteId={id} onClose={() => setCreate(null)} onSaved={() => { setCreate(null); load() }} />}
    </div>
  )
}

function Panel({ title, action, onAction, wide, children }: { title: string; action: string; onAction: () => void; wide?: boolean; children: React.ReactNode }) { return <section className={`ops-panel ops-site-panel ${wide ? 'ops-panel-wide' : ''}`}><div className="ops-panel-heading"><h2>{title}</h2><button onClick={onAction}><Plus size={14} /> {action}</button></div>{children}</section> }
function Mini({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <div className="ops-metric"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }
function Empty({ text }: { text: string }) { return <div className="ops-empty">{text}</div> }
function date(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

function CreateModal({ kind, data, siteId, onClose, onSaved }: { kind: CreateKind; data: SiteWorkspaceV2; siteId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: string) => (value: string) => setForm(current => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await V2.sites.createRelated(siteId, { kind, ...form, is_primary: form.is_primary === 'true' }); onSaved() } catch (error) { setError((error as Error).message) } finally { setSaving(false) } }
  const asrOptions = data.asrs.map(a => [a.id, `${a.asr_number} · ${a.title}`])
  return <Modal title={`Add ${kind.replace('_',' ')}`} onClose={onClose} maxWidth={560}><form className="ops-form" onSubmit={submit}>
    {kind === 'update' && <><SelectField label="Site status" value={form.status} onChange={set('status')} options={['active','attention','critical','offline','complete'].map(v => [v,v])} /><TextField label="Summary" value={form.summary} onChange={set('summary')} required /><TextArea label="Details" value={form.details} onChange={set('details')} /></>}
    {kind === 'project' && <><TextField label="Project number" value={form.project_number} onChange={set('project_number')} required /><TextField label="Project name" value={form.name} onChange={set('name')} required /></>}
    {kind === 'unit' && <><TextField label="Unit tag" value={form.tag} onChange={set('tag')} required /><TextField label="Serial number" value={form.serial_number} onChange={set('serial_number')} /><TextField label="Manufacturer" value={form.manufacturer} onChange={set('manufacturer')} /><TextField label="Model" value={form.model} onChange={set('model')} /></>}
    {kind === 'contact' && <><TextField label="Name" value={form.name} onChange={set('name')} required /><TextField label="Role" value={form.role} onChange={set('role')} /><TextField label="Email" value={form.email} onChange={set('email')} /><TextField label="Phone" value={form.phone} onChange={set('phone')} /></>}
    {kind === 'asr' && <><SelectField label="Project" value={form.project_id} onChange={set('project_id')} options={data.projects.map(p => [p.id,`${p.project_number} · ${p.name}`])} /><SelectField label="Numbering" value={form.number_mode || 'auto'} onChange={set('number_mode')} options={[['auto','Generate next'],['manual','Enter existing']]} />{form.number_mode === 'manual' && <TextField label="ASR number" value={form.asr_number} onChange={set('asr_number')} required />}<TextField label="Title" value={form.title} onChange={set('title')} required /><TextArea label="Description" value={form.description} onChange={set('description')} /></>}
    {kind === 'issue' && <><SelectField label="ASR" value={form.asr_id} onChange={set('asr_id')} options={asrOptions} /><SelectField label="Unit" value={form.unit_id} onChange={set('unit_id')} options={[['','Site-wide'], ...data.units.map(u => [u.id,u.tag])]} /><TextField label="Issue" value={form.title} onChange={set('title')} required /><TextArea label="Description" value={form.description} onChange={set('description')} /><SelectField label="Priority" value={form.priority || 'normal'} onChange={set('priority')} options={['low','normal','high','critical'].map(v => [v,v])} /></>}
    {kind === 'part_order' && <><SelectField label="ASR" value={form.asr_id} onChange={set('asr_id')} options={asrOptions} /><TextField label="Supplier" value={form.supplier} onChange={set('supplier')} /><TextField label="Order number" value={form.order_number} onChange={set('order_number')} /><TextArea label="Notes / parts needed" value={form.notes} onChange={set('notes')} /></>}
    {kind === 'service_visit' && <><SelectField label="ASR" value={form.asr_id} onChange={set('asr_id')} options={asrOptions} /><TextField label="Scheduled for" type="datetime-local" value={form.scheduled_for} onChange={set('scheduled_for')} /><TextField label="Technicians" value={form.technician_names} onChange={set('technician_names')} /><TextArea label="Scope / notes" value={form.notes} onChange={set('notes')} /></>}
    {error && <div className="ops-form-error">{error}</div>}<div className="ops-modal-actions"><button type="button" className="ops-button ops-button-secondary" onClick={onClose}>Cancel</button><button className="ops-button" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
  </form></Modal>
}

function TextField({ label, value = '', onChange, required, type = 'text' }: { label: string; value?: string; onChange: (v: string) => void; required?: boolean; type?: string }) { return <label className="ops-field"><span>{label}{required ? ' *' : ''}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} /></label> }
function TextArea({ label, value = '', onChange }: { label: string; value?: string; onChange: (v: string) => void }) { return <label className="ops-field"><span>{label}</span><textarea value={value} onChange={e => onChange(e.target.value)} rows={3} /></label> }
function SelectField({ label, value = '', onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: string[][] }) { return <label className="ops-field"><span>{label} *</span><select value={value} onChange={e => onChange(e.target.value)} required><option value="">Select…</option>{options.map(([id,name]) => <option value={id} key={`${id}-${name}`}>{name}</option>)}</select></label> }
