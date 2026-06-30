'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { V2 } from '@/api/v2'

interface UnitRecord { id: string; tag: string; serial_number?: string; manufacturer?: string; model?: string; unit_type?: string; location_in_site?: string; status: string; site_id: string; site_name: string; campus_code: string; customer_name: string; project_number?: string; notes?: string }
interface HistoryIssue { id: string; title: string; status: string; priority: string; description?: string; asr_number: string; reported_at: string }
interface WorkRecord { id: string; work_performed: string; result?: string; technician_name?: string; asr_number: string; performed_at: string }
interface PartRecord { id: string; description: string; part_number?: string; quantity: number; order_status: string; asr_number: string }
interface UnitWorkspace { unit: UnitRecord; issues: HistoryIssue[]; service_work: WorkRecord[]; parts: PartRecord[] }

export function UnitWorkspaceV2Page() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<UnitWorkspace | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { V2.units.get(id).then(value => setData(value as unknown as UnitWorkspace)).catch(error => setError(error.message)) }, [id])
  if (error) return <div className="ops-empty">{error}</div>
  if (!data) return <div className="ops-loading">Loading unit history…</div>
  const { unit } = data
  const timeline = [
    ...data.issues.map(issue => ({ id: issue.id, date: issue.reported_at, type: 'Issue', title: issue.title, detail: issue.description, asr: issue.asr_number, status: issue.status })),
    ...data.service_work.map(work => ({ id: work.id, date: work.performed_at, type: 'Service', title: work.work_performed, detail: work.result, asr: work.asr_number, status: 'complete' })),
  ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return <div className="ops-page">
    <div className="ops-breadcrumb"><Link href="/sites">{unit.customer_name}</Link><span>/</span><span>{unit.campus_code}</span><span>/</span><Link href={`/sites/${unit.site_id}`}>{unit.site_name}</Link><span>/</span><strong>{unit.tag}</strong></div>
    <header className="ops-site-hero"><div className={`ops-site-status ops-site-status-${unit.status}`}><span className={`ops-health ops-health-${unit.status}`} />{unit.status}</div><div><p className="ops-eyebrow">Equipment record</p><h1>{unit.tag}</h1><p>{unit.manufacturer} {unit.model}</p></div></header>
    <section className="ops-unit-facts">
      <Fact label="Serial number" value={unit.serial_number} mono /><Fact label="Manufacturer" value={unit.manufacturer} /><Fact label="Model" value={unit.model} /><Fact label="Type" value={unit.unit_type} /><Fact label="Location" value={unit.location_in_site} /><Fact label="Project" value={unit.project_number} mono />
    </section>
    <div className="ops-site-grid">
      <section className="ops-panel ops-panel-wide"><div className="ops-panel-heading"><h2>Complete work history</h2><span>{timeline.length}</span></div>{timeline.length ? timeline.map(item => <article className="ops-history-item" key={`${item.type}-${item.id}`}><div><span>{item.type}</span><small>{new Date(item.date).toLocaleDateString()}</small></div><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}<small className="ops-mono">{item.asr}</small></div><span>{item.status}</span></article>) : <div className="ops-empty">No work recorded for this unit.</div>}</section>
      <section className="ops-panel"><div className="ops-panel-heading"><h2>Parts history</h2><span>{data.parts.length}</span></div>{data.parts.map(part => <div className="ops-project" key={part.id}><strong>{part.part_number || part.description}</strong><span>{part.quantity} · {part.order_status}</span></div>)}{!data.parts.length && <div className="ops-empty">No parts recorded.</div>}</section>
    </div>
  </div>
}

function Fact({ label, value, mono }: { label: string; value?: string; mono?: boolean }) { return <div><small>{label}</small><strong className={mono ? 'ops-mono' : ''}>{value || '—'}</strong></div> }
