'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { HierarchyCustomerV2 } from '@/types/v2'
import { HierarchyTree } from '@/components/HierarchyTree'

type CreateKind = 'customer' | 'location' | 'site'

export function HierarchyV2() {
  const [customers, setCustomers] = useState<HierarchyCustomerV2[]>([])
  const [kind, setKind] = useState<CreateKind>('customer')
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = () => V2.hierarchy.list().then(setCustomers).catch(error => setError(error.message))
  useEffect(() => { load() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await V2.hierarchy.create({ kind, ...form }); setForm({}); await load() }
    catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }

  const locations = customers.flatMap(customer => customer.locations.map(location => ({ ...location, customerName: customer.name })))
  return (
    <div className="ops-page">
      <header className="ops-page-header"><div><p className="ops-eyebrow">Structure</p><h1>Customers, campuses, and sites</h1><p>Build the hierarchy people actually navigate.</p></div></header>
      <div className="ops-manage-grid">
        <section className="ops-panel"><div className="ops-panel-heading"><h2>Current hierarchy</h2></div><HierarchyTree customers={customers} /></section>
        <section className="ops-panel ops-create-panel">
          <div className="ops-panel-heading"><h2><Plus size={17} /> Add to hierarchy</h2></div>
          <div className="ops-segmented">{(['customer','location','site'] as CreateKind[]).map(item => <button key={item} className={kind === item ? 'active' : ''} onClick={() => { setKind(item); setForm({}) }}>{item}</button>)}</div>
          <form onSubmit={submit} className="ops-form">
            {kind === 'customer' && <><Field label="Customer name" value={form.name} onChange={name => setForm({ ...form, name })} required /><Field label="Short code" value={form.code} onChange={code => setForm({ ...form, code })} /></>}
            {kind === 'location' && <><Select label="Customer" value={form.customer_id} onChange={customer_id => setForm({ ...form, customer_id })} options={customers.map(c => [c.id,c.name])} /><Field label="Campus code" value={form.campus_code} onChange={campus_code => setForm({ ...form, campus_code })} required placeholder="ATL2" /><div className="ops-form-row"><Field label="City" value={form.city} onChange={city => setForm({ ...form, city })} required /><Field label="State" value={form.state} onChange={state => setForm({ ...form, state })} required /></div></>}
            {kind === 'site' && <><Select label="Campus" value={form.location_id} onChange={location_id => setForm({ ...form, location_id })} options={locations.map(l => [l.id,`${l.customerName} · ${l.campus_code} · ${l.city}`])} /><Field label="Site / data center name" value={form.name} onChange={name => setForm({ ...form, name })} required /><Field label="Building or site code" value={form.site_code} onChange={site_code => setForm({ ...form, site_code })} /></>}
            {error && <div className="ops-form-error">{error}</div>}
            <button className="ops-button" disabled={saving}>{saving ? 'Saving…' : `Add ${kind}`}</button>
          </form>
        </section>
      </div>
    </div>
  )
}

function Field({ label, value = '', onChange, required, placeholder }: { label: string; value?: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) { return <label className="ops-field"><span>{label}{required ? ' *' : ''}</span><input value={value} required={required} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></label> }
function Select({ label, value = '', onChange, options }: { label: string; value?: string; onChange: (value: string) => void; options: string[][] }) { return <label className="ops-field"><span>{label} *</span><select value={value} required onChange={e => onChange(e.target.value)}><option value="">Select…</option>{options.map(([id,name]) => <option value={id} key={id}>{name}</option>)}</select></label> }
