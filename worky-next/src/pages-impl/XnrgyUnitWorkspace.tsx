'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Box, ClipboardList, Hash, MapPin, Wrench } from 'lucide-react'
import { V2 } from '@/api/v2'

interface UnitRecord { id: string; tag: string; serial_number?: string; manufacturer?: string; model?: string; unit_type?: string; location_in_site?: string; status: string; site_id: string; site_name: string; campus_code: string; customer_name: string; project_number?: string; notes?: string }
interface HistoryIssue { id: string; title: string; status: string; priority: string; description?: string; asr_number: string; reported_at: string }
interface WorkRecord { id: string; work_performed: string; result?: string; technician_name?: string; asr_number: string; performed_at: string }
interface PartRecord { id: string; description: string; part_number?: string; quantity: number; order_status: string; asr_number: string }
interface UnitWorkspace { unit: UnitRecord; issues: HistoryIssue[]; service_work: WorkRecord[]; parts: PartRecord[] }

export function XnrgyUnitWorkspace() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<UnitWorkspace | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { V2.units.get(id).then(value => setData(value as unknown as UnitWorkspace)).catch(error => setError(error.message)) }, [id])
  if (error) return <div className="x-state"><h1>Couldn’t open this unit</h1><p>{error}</p></div>
  if (!data) return <div className="x-state"><h1>Opening equipment record</h1><p>Gathering serial information and work history…</p></div>
  const { unit } = data
  const history = [...data.issues.map(item => ({ id: item.id, date: item.reported_at, kind: 'Issue', title: item.title, detail: item.description, asr: item.asr_number, status: item.status })), ...data.service_work.map(item => ({ id: item.id, date: item.performed_at, kind: 'Service', title: item.work_performed, detail: item.result, asr: item.asr_number, status: 'complete' }))].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return <div className="x-page x-unit-page"><Link className="x-back" href={`/sites/${unit.site_id}`}><ArrowLeft size={16} /> Back to {unit.site_name}</Link><header className="x-unit-hero"><div><div className="x-breadcrumb">{unit.customer_name} <span>/</span> {unit.campus_code} <span>/</span> {unit.site_name}</div><h1>{unit.tag}</h1><p>{[unit.manufacturer, unit.model].filter(Boolean).join(' ') || 'Equipment record'}</p></div><div className={`x-health-pill is-${unit.status}`}><i />{unit.status}</div></header>
    <section className="x-unit-facts-new"><Fact icon={<Hash />} label="Serial number" value={unit.serial_number || 'Not entered'} /><Fact icon={<Box />} label="Unit type" value={unit.unit_type || 'Not entered'} /><Fact icon={<MapPin />} label="Site location" value={unit.location_in_site || unit.site_name} /><Fact icon={<ClipboardList />} label="Project" value={unit.project_number || 'Not assigned'} /></section>
    <div className="x-unit-layout"><section className="x-section"><header><div><h2>Work history</h2><p>Issues and service performed on this specific unit.</p></div></header><div className="x-work-history">{history.map(item => <article key={`${item.kind}-${item.id}`}><div className={`x-work-icon is-${item.kind.toLowerCase()}`}>{item.kind === 'Issue' ? <AlertTriangle size={16} /> : <Wrench size={16} />}</div><div><header><span>{item.kind}</span><time>{formatDate(item.date)}</time></header><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}<footer><code>{item.asr}</code><span>{item.status}</span></footer></div></article>)}{!history.length && <div className="x-empty">No work has been recorded for this unit.</div>}</div></section>
      <aside><section className="x-section"><header><div><h2>Parts</h2><p>Items associated with this unit.</p></div></header>{data.parts.map(part => <div className="x-record" key={part.id}><span><Box size={16} /></span><div><strong>{part.description}</strong><small>{part.part_number || 'No part number'} · Qty {part.quantity} · {part.order_status}</small></div></div>)}{!data.parts.length && <div className="x-empty">No parts associated.</div>}</section>{unit.notes && <section className="x-section x-unit-notes"><header><div><h2>Equipment notes</h2></div></header><p>{unit.notes}</p></section>}</aside>
    </div>
  </div>
}
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div><span>{icon}</span><small>{label}</small><strong>{value}</strong></div> }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
