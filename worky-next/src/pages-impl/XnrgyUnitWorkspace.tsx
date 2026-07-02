'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Box, ClipboardList, Hash, MapPin, Pencil, Trash2, Wrench, X } from 'lucide-react'
import { V2 } from '@/api/v2'

interface UnitRecord { id: string; tag: string; serial_number?: string; manufacturer?: string; model?: string; unit_type?: string; location_in_site?: string; status: string; site_id: string; site_name: string; campus_code?: string; customer_name: string; project_number?: string; notes?: string }
interface HistoryIssue { id: string; title: string; status: string; priority: string; description?: string; asr_number: string; reported_at: string }
interface WorkRecord { id: string; work_performed: string; result?: string; technician_name?: string; asr_number: string; performed_at: string }
interface PartRecord { id: string; description: string; part_number?: string; quantity: number; order_status: string; asr_number: string }
interface UnitWorkspace { unit: UnitRecord; issues: HistoryIssue[]; service_work: WorkRecord[]; parts: PartRecord[] }

export function XnrgyUnitWorkspace() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<UnitWorkspace | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const load = () => V2.units.get(id).then(value => setData(value as unknown as UnitWorkspace)).catch(error => setError(error.message))
  useEffect(() => { V2.units.get(id).then(value => setData(value as unknown as UnitWorkspace)).catch(error => setError(error.message)) }, [id])
  if (error) return <div className="x-state"><h1>Couldn’t open this unit</h1><p>{error}</p></div>
  if (!data) return <div className="x-state"><h1>Opening equipment record</h1><p>Gathering serial information and work history…</p></div>
  const { unit } = data
  async function deleteUnit() { if (!window.confirm(`Delete unit ${unit.tag}? Its unit-specific service and part records will also be removed.`)) return; try { await V2.units.delete(id); router.push(`/sites/${unit.site_id}`) } catch (error) { setError((error as Error).message) } }
  const history = [...data.issues.map(item => ({ id: item.id, date: item.reported_at, kind: 'Issue', title: item.title, detail: item.description, asr: item.asr_number, status: item.status })), ...data.service_work.map(item => ({ id: item.id, date: item.performed_at, kind: 'Service', title: item.work_performed, detail: item.result, asr: item.asr_number, status: 'complete' }))].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return <div className="x-page x-unit-page"><Link className="x-back" href={`/sites/${unit.site_id}`}><ArrowLeft size={16} /> Back to {unit.site_name}</Link><header className="x-unit-hero"><div><div className="x-breadcrumb">{[unit.customer_name, unit.campus_code, unit.site_name].filter(Boolean).join(' / ')}</div><h1>{unit.tag}</h1><p>{[unit.manufacturer, unit.model].filter(Boolean).join(' ') || 'Equipment record'}</p></div><div><div className={`x-health-pill is-${unit.status}`}><i />{unit.status}</div><div className="x-head-actions" style={{ marginTop: 10 }}><button onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button><button onClick={deleteUnit}><Trash2 size={14} /> Delete</button></div></div></header>
    <section className="x-unit-facts-new"><Fact icon={<Hash />} label="Serial number" value={unit.serial_number || 'Not entered'} /><Fact icon={<Box />} label="Unit type" value={unit.unit_type || 'Not entered'} /><Fact icon={<MapPin />} label="Site location" value={unit.location_in_site || unit.site_name} /><Fact icon={<ClipboardList />} label="Project" value={unit.project_number || 'Not assigned'} /></section>
    <div className="x-unit-layout"><section className="x-section"><header><div><h2>Work history</h2><p>Issues and service performed on this specific unit.</p></div></header><div className="x-work-history">{history.map(item => <article key={`${item.kind}-${item.id}`}><div className={`x-work-icon is-${item.kind.toLowerCase()}`}>{item.kind === 'Issue' ? <AlertTriangle size={16} /> : <Wrench size={16} />}</div><div><header><span>{item.kind}</span><time>{formatDate(item.date)}</time></header><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}<footer><code>{item.asr}</code><span>{item.status}</span></footer></div></article>)}{!history.length && <div className="x-empty">No work has been recorded for this unit.</div>}</div></section>
      <aside><section className="x-section"><header><div><h2>Parts</h2><p>Items associated with this unit.</p></div></header>{data.parts.map(part => <div className="x-record" key={part.id}><span><Box size={16} /></span><div><strong>{part.description}</strong><small>{part.part_number || 'No part number'} · Qty {part.quantity} · {part.order_status}</small></div></div>)}{!data.parts.length && <div className="x-empty">No parts associated.</div>}</section>{unit.notes && <section className="x-section x-unit-notes"><header><div><h2>Equipment notes</h2></div></header><p>{unit.notes}</p></section>}</aside>
    </div>{editing && <UnitEditor unit={unit} close={() => setEditing(false)} saved={() => { setEditing(false); load() }} />}
  </div>
}
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div><span>{icon}</span><small>{label}</small><strong>{value}</strong></div> }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

function UnitEditor({ unit, close, saved }: { unit: UnitRecord; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ tag: unit.tag, serial_number: unit.serial_number || '', manufacturer: unit.manufacturer || '', model: unit.model || '', unit_type: unit.unit_type || '', location_in_site: unit.location_in_site || '', status: unit.status, notes: unit.notes || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: event.target.value }))
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await V2.units.update(unit.id, form); saved() } catch (error) { setError((error as Error).message) } finally { setSaving(false) } }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}><header><div><span className="x-kicker">Equipment</span><h2>Edit {unit.tag}</h2></div><button type="button" onClick={close}><X size={18} /></button></header><div className="x-form-row"><label className="x-field"><span>Unit tag</span><input value={form.tag} onChange={set('tag')} required /></label><label className="x-field"><span>Serial number</span><input value={form.serial_number} onChange={set('serial_number')} /></label></div><div className="x-form-row"><label className="x-field"><span>Manufacturer</span><input value={form.manufacturer} onChange={set('manufacturer')} /></label><label className="x-field"><span>Model</span><input value={form.model} onChange={set('model')} /></label></div><div className="x-form-row"><label className="x-field"><span>Unit type</span><input value={form.unit_type} onChange={set('unit_type')} /></label><label className="x-field"><span>Location in site</span><input value={form.location_in_site} onChange={set('location_in_site')} /></label></div><label className="x-field"><span>Status</span><select value={form.status} onChange={set('status')}>{['planned','installed','commissioning','active','attention','offline','retired'].map(value => <option key={value}>{value}</option>)}</select></label><label className="x-field"><span>Notes</span><textarea value={form.notes} onChange={set('notes')} rows={3} /></label>{error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save unit'}</button></footer></form></div>
}
