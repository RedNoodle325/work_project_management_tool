'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Boxes, Building2, MapPin, PackageSearch, Plus, RefreshCw, Wrench } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { HierarchyCustomerV2 } from '@/types/v2'
import { HierarchyTree } from '@/components/HierarchyTree'

export function WorkspaceV2() {
  const [customers, setCustomers] = useState<HierarchyCustomerV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    V2.hierarchy.list().then(setCustomers).catch(error => setError(error.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const sites = useMemo(() => customers.flatMap(customer => customer.locations.flatMap(location => location.sites || [])), [customers])
  const totals = {
    campuses: customers.reduce((count, customer) => count + customer.locations.length, 0),
    sites: sites.length,
    units: sites.reduce((count, site) => count + Number(site.unit_count), 0),
    issues: sites.reduce((count, site) => count + Number(site.open_issue_count), 0),
    parts: sites.reduce((count, site) => count + Number(site.pending_part_order_count), 0),
    asrs: sites.reduce((count, site) => count + Number(site.active_asr_count), 0),
  }
  const attention = sites.filter(site => ['attention', 'critical', 'offline'].includes(site.status))

  if (loading) return <div className="ops-loading">Loading operations workspace…</div>
  if (error) return <div className="ops-empty">{error}</div>

  return (
    <div className="ops-page">
      <header className="ops-page-header">
        <div><p className="ops-eyebrow">Operations</p><h1>Site command center</h1><p>Current health, work, and equipment across every campus.</p></div>
        <div className="ops-header-actions">
          <button className="ops-button ops-button-secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
          <Link href="/sites" className="ops-button"><Plus size={15} /> Add hierarchy</Link>
        </div>
      </header>

      <section className="ops-metrics">
        <Metric icon={<MapPin />} label="Campuses" value={totals.campuses} />
        <Metric icon={<Building2 />} label="Sites" value={totals.sites} />
        <Metric icon={<Boxes />} label="Units" value={totals.units} />
        <Metric icon={<AlertTriangle />} label="Open issues" value={totals.issues} tone={totals.issues ? 'warning' : undefined} />
        <Metric icon={<Wrench />} label="Active ASRs" value={totals.asrs} />
        <Metric icon={<PackageSearch />} label="Parts pending" value={totals.parts} tone={totals.parts ? 'warning' : undefined} />
      </section>

      <div className="ops-dashboard-grid">
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><p className="ops-eyebrow">Hierarchy</p><h2>Customers and campuses</h2></div><Link href="/sites">Manage</Link></div>
          {customers.length ? <HierarchyTree customers={customers} /> : <div className="ops-empty">Start by adding a customer and campus.</div>}
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><p className="ops-eyebrow">Attention</p><h2>Sites requiring action</h2></div><span>{attention.length}</span></div>
          {attention.length ? attention.map(site => (
            <Link href={`/sites/${site.id}`} className="ops-attention-row" key={site.id}>
              <span className={`ops-health ops-health-${site.status}`} />
              <div><strong>{site.name}</strong><p>{site.latest_update || site.status_summary || 'No update recorded'}</p></div>
              <div className="ops-attention-counts"><span>{site.open_issue_count} issues</span><span>{site.pending_part_order_count} parts</span></div>
            </Link>
          )) : <div className="ops-empty">No sites currently need attention.</div>}
        </section>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return <div className={`ops-metric ${tone ? `ops-metric-${tone}` : ''}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>
}
