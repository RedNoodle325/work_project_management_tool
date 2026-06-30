'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, MapPin, Plus, Search, X } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { HierarchyCustomerV2 } from '@/types/v2'

type NewKind = 'customer' | 'location' | 'site'

export function XnrgySites() {
  const [customers, setCustomers] = useState<HierarchyCustomerV2[]>([])
  const [query, setQuery] = useState('')
  const [create, setCreate] = useState<NewKind | null>(null)
  const [error, setError] = useState('')
  const load = () => V2.hierarchy.list().then(setCustomers).catch(error => setError(error.message))
  useEffect(() => { load() }, [])
  const filtered = useMemo(() => customers.map(customer => ({ ...customer, locations: customer.locations.map(location => ({ ...location, sites: (location.sites || []).filter(site => `${customer.name} ${location.campus_code} ${location.city} ${site.name}`.toLowerCase().includes(query.toLowerCase())) })).filter(location => !query || (location.sites || []).length) })).filter(customer => !query || customer.locations.length), [customers, query])
  return <div className="x-page">
    <header className="x-directory-head"><div><span className="x-kicker">Site directory</span><h1>Customers, campuses & sites</h1><p>Follow the real-world hierarchy from customer to individual equipment.</p></div><div className="x-head-actions"><button onClick={() => setCreate('customer')}><Plus size={15} /> Customer</button><button onClick={() => setCreate('location')}><Plus size={15} /> Campus</button><button className="primary" onClick={() => setCreate('site')}><Plus size={15} /> Site</button></div></header>
    <label className="x-directory-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names, campus codes, or cities…" /></label>
    {error && <div className="x-error">{error}</div>}
    <div className="x-customer-list">{filtered.map(customer => <section key={customer.id} className="x-customer"><header><div className="x-customer-icon"><Building2 size={20} /></div><div><span>Customer</span><h2>{customer.name}</h2></div><b>{customer.locations.reduce((total, location) => total + (location.sites?.length || 0), 0)} sites</b></header><div className="x-campus-list">{customer.locations.map(location => <div className="x-campus" key={location.id}><div className="x-campus-head"><MapPin size={16} /><div><strong>{location.campus_code}</strong><span>{location.city}, {location.state}</span></div></div><div className="x-directory-sites">{location.sites?.map(site => <Link href={`/sites/${site.id}`} key={site.id}><div className={`x-status-dot is-${site.status}`} /><div><strong>{site.name}</strong><span>{site.lifecycle_phase} · {site.unit_count} units · {site.open_issue_count} open issues</span></div><ArrowRight size={16} /></Link>)}</div></div>)}</div></section>)}{!filtered.length && <div className="x-empty">No sites match that search.</div>}</div>
    {create && <CreateHierarchy kind={create} customers={customers} close={() => setCreate(null)} saved={() => { setCreate(null); load() }} />}
  </div>
}

function CreateHierarchy({ kind, customers, close, saved }: { kind: NewKind; customers: HierarchyCustomerV2[]; close: () => void; saved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locations = customers.flatMap(customer => customer.locations.map(location => ({ ...location, customer: customer.name })))
  const set = (key: string) => (value: string) => setForm(current => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await V2.hierarchy.create({ kind, ...form }); saved() } catch (error) { setError((error as Error).message) } finally { setSaving(false) } }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}><header><div><span className="x-kicker">Add to directory</span><h2>New {kind === 'location' ? 'campus' : kind}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    {kind === 'customer' && <><Field label="Customer name" value={form.name} change={set('name')} required /><Field label="Customer code" value={form.code} change={set('code')} /></>}
    {kind === 'location' && <><Select label="Customer" value={form.customer_id} change={set('customer_id')} options={customers.map(customer => [customer.id, customer.name])} /><Field label="Campus code" value={form.campus_code} change={set('campus_code')} required placeholder="e.g. ATL2" /><div className="x-form-row"><Field label="City" value={form.city} change={set('city')} required /><Field label="State" value={form.state} change={set('state')} required /></div><Field label="Street address" value={form.address} change={set('address')} /></>}
    {kind === 'site' && <><Select label="Campus" value={form.location_id} change={set('location_id')} options={locations.map(location => [location.id, `${location.customer} · ${location.campus_code} · ${location.city}, ${location.state}`])} /><Field label="Site name" value={form.name} change={set('name')} required /><div className="x-form-row"><Field label="Site code" value={form.site_code} change={set('site_code')} /><Field label="Building" value={form.building} change={set('building')} /></div></>}
    {error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : `Create ${kind === 'location' ? 'campus' : kind}`}</button></footer>
  </form></div>
}
function Field({ label, value = '', change, required, placeholder }: { label: string; value?: string; change: (value: string) => void; required?: boolean; placeholder?: string }) { return <label className="x-field"><span>{label}</span><input value={value} onChange={event => change(event.target.value)} required={required} placeholder={placeholder} /></label> }
function Select({ label, value = '', change, options }: { label: string; value?: string; change: (value: string) => void; options: string[][] }) { return <label className="x-field"><span>{label}</span><select value={value} onChange={event => change(event.target.value)} required><option value="">Select…</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label> }
