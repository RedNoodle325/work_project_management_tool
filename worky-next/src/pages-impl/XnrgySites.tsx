'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Gauge,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { V2 } from '@/api/v2'
import type { HierarchyCustomerV2, SiteSummaryV2 } from '@/types/v2'

type NewKind = 'customer' | 'location' | 'site'

interface DirectorySite extends SiteSummaryV2 {
  customer_name: string
  campus_code?: string
}

export function XnrgySites() {
  const [customers, setCustomers] = useState<HierarchyCustomerV2[]>([])
  const [query, setQuery] = useState('')
  const [create, setCreate] = useState<NewKind | null>(null)
  const [error, setError] = useState('')

  const load = () => V2.hierarchy.list().then(setCustomers).catch(error => setError(error.message))
  useEffect(() => { load() }, [])

  const sites = useMemo(() => flattenSites(customers), [customers])
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return sites
    return sites.filter(site => [
      site.name,
      site.site_code,
      site.customer_name,
      site.campus_code,
      site.city,
      site.state,
      site.status,
      site.lifecycle_phase,
      site.notes,
      site.latest_update,
    ].some(value => String(value || '').toLowerCase().includes(text)))
  }, [query, sites])

  const totals = useMemo(() => ({
    issues: filtered.reduce((count, site) => count + Number(site.open_issue_count || 0), 0),
    commissioning: filtered.filter(site => !isCommissioningComplete(site)).length,
    warranty: filtered.filter(site => isCommissioningComplete(site)).length,
  }), [filtered])

  return <div className="x-page">
    <header className="x-directory-head">
      <div>
        <span className="x-kicker">Site list</span>
        <h1>Sites</h1>
        <p>{filtered.length} sites - {totals.commissioning} commissioning - {totals.warranty} warranty/service - {totals.issues} open issues</p>
      </div>
      <div className="x-head-actions">
        <button onClick={() => setCreate('customer')}><Plus size={15} /> Customer</button>
        <button onClick={() => setCreate('location')}><Plus size={15} /> Campus</button>
        <button className="primary" onClick={() => setCreate('site')}><Plus size={15} /> Site</button>
      </div>
    </header>

    <label className="x-directory-search">
      <Search size={17} />
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sites, customers, campuses, status, or notes..." />
    </label>

    {error && <div className="x-error">{error}</div>}

    <div className="x-site-list">
      {filtered.map(site => <SiteDashboard key={site.id} site={site} />)}
      {!filtered.length && <div className="x-empty">No sites match that search.</div>}
    </div>

    {create && <CreateHierarchy kind={create} customers={customers} close={() => setCreate(null)} saved={() => { setCreate(null); load() }} />}
  </div>
}

function flattenSites(customers: HierarchyCustomerV2[]): DirectorySite[] {
  return customers.flatMap(customer => [
    ...(customer.sites || []).map(site => ({
      ...site,
      customer_name: site.customer_name || customer.name,
    })),
    ...customer.locations.flatMap(location => (location.sites || []).map(site => ({
      ...site,
      customer_name: site.customer_name || customer.name,
      campus_code: site.campus_code || location.campus_code,
      city: site.city || location.city,
      state: site.state || location.state,
    }))),
  ]).sort((a, b) => {
    const customer = a.customer_name.localeCompare(b.customer_name)
    if (customer) return customer
    const campus = String(a.campus_code || '').localeCompare(String(b.campus_code || ''))
    if (campus) return campus
    return a.name.localeCompare(b.name)
  })
}

function SiteDashboard({ site }: { site: DirectorySite }) {
  const complete = isCommissioningComplete(site)
  const location = [site.campus_code, [site.city, site.state].filter(Boolean).join(', ')].filter(Boolean).join(' - ')
  const note = site.notes || site.latest_update || site.status_summary || 'No site notes recorded yet.'

  return <article className="x-site-dashboard">
    <div className="x-site-list-main">
      <div className={`x-status-dot is-${site.status}`} />
      <div className="x-site-list-title">
        <div>
          <span>{site.customer_name}</span>
          <h2>{site.name}</h2>
          <p><MapPin size={13} /> {location || 'Location not set'}</p>
        </div>
        <Link href={`/sites/${site.id}`} className="x-open-site">Open <ArrowRight size={15} /></Link>
      </div>
    </div>

    <div className="x-site-dashboard-grid">
      {complete ? <WarrantyStatus site={site} /> : <CommissioningStatus site={site} />}
      <IssueStatus count={Number(site.open_issue_count || 0)} />
      <UnitStatus site={site} />
      <div className="x-site-notes">
        <span><ClipboardList size={14} /> Site notes</span>
        <p>{note}</p>
      </div>
    </div>
  </article>
}

function CommissioningStatus({ site }: { site: DirectorySite }) {
  const total = Number(site.unit_count || 0)
  const complete = Number(site.commissioned_unit_count || 0)
  const percent = total ? Math.min(100, Number(site.commissioning_percent || Math.floor((complete / total) * 100))) : 0
  const active = Number(site.commissioning_unit_count || 0)

  return <div className="x-dashboard-tile x-dashboard-tile-wide">
    <span><Gauge size={15} /> Commissioning</span>
    <strong>{total ? `${percent}%` : 'No units'}</strong>
    <div className="x-progress"><i style={{ width: `${percent}%` }} /></div>
    <small>{total ? `${complete} of ${total} units complete${active ? ` - ${active} in progress` : ''}` : 'Add units to track commissioning.'}</small>
  </div>
}

function WarrantyStatus({ site }: { site: DirectorySite }) {
  const active = Number(site.warranty_active_unit_count || 0)
  const expiring = Number(site.warranty_expiring_unit_count || 0)
  const expired = Number(site.warranty_expired_unit_count || 0)
  const missing = Number(site.warranty_missing_unit_count || 0)

  return <div className="x-dashboard-tile x-dashboard-tile-wide">
    <span><ShieldCheck size={15} /> Warranty</span>
    <strong>{expired ? `${expired} expired` : active ? `${active} active` : 'Not set'}</strong>
    <div className="x-mini-counts">
      <b>{active}<small>active</small></b>
      <b>{expiring}<small>90 day</small></b>
      <b className={expired ? 'is-alert' : ''}>{expired}<small>expired</small></b>
      <b>{missing}<small>missing</small></b>
    </div>
  </div>
}

function IssueStatus({ count }: { count: number }) {
  return <div className={`x-dashboard-tile ${count ? 'is-alert' : 'is-clear'}`}>
    <span><AlertTriangle size={15} /> Open issues</span>
    <strong>{count}</strong>
    <small>{count ? 'Needs attention' : 'Clear'}</small>
  </div>
}

function UnitStatus({ site }: { site: DirectorySite }) {
  const statuses = Object.entries(site.unit_status_counts || {}).sort(([a], [b]) => a.localeCompare(b))

  return <div className="x-dashboard-tile">
    <span><CheckCircle2 size={15} /> Unit status</span>
    <strong>{site.unit_count}</strong>
    {statuses.length ? (
      <div className="x-status-chips">
        {statuses.slice(0, 4).map(([status, count]) => <em key={status}>{label(status)} {count}</em>)}
      </div>
    ) : <small>No units added</small>}
  </div>
}

function isCommissioningComplete(site: SiteSummaryV2) {
  if (['warranty', 'service', 'closed'].includes(site.lifecycle_phase)) return true
  if (site.status === 'complete') return true
  const total = Number(site.unit_count || 0)
  return total > 0 && Number(site.commissioned_unit_count || 0) >= total
}

function label(value: string) {
  return value.replace(/_/g, ' ')
}

function CreateHierarchy({ kind, customers, close, saved }: { kind: NewKind; customers: HierarchyCustomerV2[]; close: () => void; saved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locations = customers.flatMap(customer => customer.locations.map(location => ({ ...location, customer: customer.name })))
  const customerLocations = locations.filter(location => !form.customer_id || location.customer_id === form.customer_id)
  const standalone = kind === 'site' && !form.location_id
  const set = (key: string) => (value: string) => setForm(current => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await V2.hierarchy.create({ kind, ...form }); saved() } catch (error) { setError((error as Error).message) } finally { setSaving(false) } }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}><header><div><span className="x-kicker">Add to directory</span><h2>New {kind === 'location' ? 'campus' : kind}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    {kind === 'customer' && <><Field label="Customer name" value={form.name} change={set('name')} required /><Field label="Customer code" value={form.code} change={set('code')} /></>}
    {kind === 'location' && <><Select label="Customer" value={form.customer_id} change={set('customer_id')} options={customers.map(customer => [customer.id, customer.name])} /><Field label="Campus code" value={form.campus_code} change={set('campus_code')} required placeholder="e.g. ATL2" /><div className="x-form-row"><Field label="City" value={form.city} change={set('city')} required /><Field label="State" value={form.state} change={set('state')} required /></div><div className="x-form-row"><Field label="Street address" value={form.address} change={set('address')} /><Field label="ZIP / postal code" value={form.postal_code} change={set('postal_code')} /></div></>}
    {kind === 'site' && <><Select label="Customer" value={form.customer_id} change={value => setForm(current => ({ ...current, customer_id: value, location_id: '' }))} options={customers.map(customer => [customer.id, customer.name])} /><Select label="Campus (optional)" value={form.location_id} change={set('location_id')} options={customerLocations.map(location => [location.id, `${location.campus_code} - ${location.city}, ${location.state}`])} required={false} emptyLabel="No campus - standalone site" /><Field label="Site name" value={form.name} change={set('name')} required placeholder="e.g. TOR1A" /><div className="x-form-row"><Field label="Site code" value={form.site_code} change={set('site_code')} /><Field label="Building" value={form.building} change={set('building')} /></div>{standalone && <><div className="x-form-row"><Field label="City" value={form.city} change={set('city')} required /><Field label="State / province" value={form.state} change={set('state')} required /></div><div className="x-form-row"><Field label="Street address" value={form.address} change={set('address')} /><Field label="ZIP / postal code" value={form.postal_code} change={set('postal_code')} /></div></>}</>}
    {error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving...' : `Create ${kind === 'location' ? 'campus' : kind}`}</button></footer>
  </form></div>
}

function Field({ label, value = '', change, required, placeholder }: { label: string; value?: string; change: (value: string) => void; required?: boolean; placeholder?: string }) { return <label className="x-field"><span>{label}</span><input value={value} onChange={event => change(event.target.value)} required={required} placeholder={placeholder} /></label> }
function Select({ label, value = '', change, options, required = true, emptyLabel = 'Select...' }: { label: string; value?: string; change: (value: string) => void; options: string[][]; required?: boolean; emptyLabel?: string }) { return <label className="x-field"><span>{label}</span><select value={value} onChange={event => change(event.target.value)} required={required}><option value="">{emptyLabel}</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label> }
