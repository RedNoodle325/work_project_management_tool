'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ClipboardCheck, Save } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { V2 } from '@/api/v2'
import { Ops } from '@/api/ops'
import type { SiteSummaryV2 } from '@/types/v2'

const STAGES = [
  { key: 'production', label: 'In production' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'installed', label: 'Installed / set in place' },
  { key: 'energized', label: 'Energized' },
  { key: 'startup', label: 'Startup' },
  { key: 'functional_testing', label: 'Functional testing' },
  { key: 'commissioned', label: 'Commissioned' },
] as const

const STAGE_LABELS: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.key, s.label]))

interface UnitRow { id: string; tag: string; unit_type?: string; status: string; build_stage?: string; ship_to?: string | null }
interface UnitChange { build_stage: string; ship_to: string | null }

function isPreCommissioning(site: SiteSummaryV2) {
  if (site.lifecycle_phase === 'commissioning') return true
  return (site.unit_count ?? 0) > 0 && (site.commissioning_percent ?? 0) < 100
}

export function Commissioning() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteSummaryV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)

  useEffect(() => {
    V2.hierarchy.list()
      .then(hierarchy => {
        const byId = new Map<string, SiteSummaryV2>()
        hierarchy.forEach(customer => {
          customer.sites?.forEach(site => byId.set(site.id, site))
          customer.locations?.forEach(location => location.sites?.forEach(site => byId.set(site.id, site)))
        })
        setSites(Array.from(byId.values()).filter(isPreCommissioning).sort((a, b) => (a.commissioning_percent ?? 0) - (b.commissioning_percent ?? 0)))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId) || null, [sites, selectedSiteId])

  if (selectedSite) {
    return <div className="x-page x-site-page">
      <button className="x-back" onClick={() => setSelectedSiteId(null)}><ArrowLeft size={14} /> All pre-commissioning sites</button>
      <SiteChecklist site={selectedSite} canEdit={!!user} />
    </div>
  }

  return <div className="x-page x-issues-page">
    <header className="x-directory-head">
      <div><span className="x-kicker">Commissioning</span><h1>Pre-commissioning sites</h1><p>Every site still moving units through production → shipping → installation → energization → startup → functional testing → commissioning.</p></div>
    </header>

    {error && <div className="x-load-panel"><strong>Couldn&apos;t load sites</strong><p>{error}</p></div>}
    {!error && loading && <div className="x-state"><h1>Loading sites</h1><p>Gathering commissioning progress…</p></div>}
    {!error && !loading && !sites.length && <div className="x-resource-empty"><ClipboardCheck size={30} /><strong>No sites are pre-commissioning</strong><p>Sites show up here until every one of their units reaches the commissioned stage.</p></div>}

    {!error && !loading && sites.length > 0 && <div className="x-commissioning-grid">
      {sites.map(site => <button key={site.id} className="x-commissioning-card" onClick={() => setSelectedSiteId(site.id)}>
        <div className="x-commissioning-card-top"><strong>{site.name}</strong><span>{[site.city, site.state].filter(Boolean).join(', ')}</span></div>
        <div className="x-progress"><i style={{ width: `${site.commissioning_percent ?? 0}%` }} /></div>
        <div className="x-commissioning-card-bottom">
          <span>{site.commissioning_percent ?? 0}% commissioned</span>
          <span>{site.commissioned_unit_count ?? 0}/{site.unit_count} units</span>
        </div>
        {site.build_stage_counts && Object.keys(site.build_stage_counts).length > 0 && <div className="x-status-chips">
          {STAGES.filter(s => s.key !== 'commissioned').map(s => site.build_stage_counts?.[s.key] ? <em key={s.key}>{site.build_stage_counts[s.key]} {s.label}</em> : null)}
        </div>}
      </button>)}
    </div>}
  </div>
}

function SiteChecklist({ site, canEdit }: { site: SiteSummaryV2; canEdit: boolean }) {
  const [units, setUnits] = useState<UnitRow[]>([])
  const [changes, setChanges] = useState<Record<string, UnitChange>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true); setError('')
    V2.sites.get(site.id)
      .then(workspace => setUnits((workspace.units as unknown as UnitRow[]) || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [site.id])

  function setStage(unit: UnitRow, buildStage: string) {
    const current = changes[unit.id] ?? { build_stage: unit.build_stage ?? 'production', ship_to: unit.ship_to ?? null }
    setChanges(prev => ({ ...prev, [unit.id]: { build_stage: buildStage, ship_to: buildStage === 'shipped' ? current.ship_to : null } }))
    setSaved(false)
  }

  function setShipTo(unit: UnitRow, shipTo: string) {
    const current = changes[unit.id] ?? { build_stage: unit.build_stage ?? 'production', ship_to: unit.ship_to ?? null }
    setChanges(prev => ({ ...prev, [unit.id]: { ...current, ship_to: shipTo } }))
    setSaved(false)
  }

  async function save() {
    const updates = Object.entries(changes).map(([unit_id, change]) => ({ unit_id, ...change }))
    if (!updates.length) return
    setSaving(true); setError('')
    try {
      await Ops.units.updateBuildStage(site.id, updates)
      setUnits(current => current.map(u => changes[u.id] ? { ...u, build_stage: changes[u.id].build_stage, ship_to: changes[u.id].ship_to } : u))
      setChanges({})
      setSaved(true)
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  const pendingCount = Object.keys(changes).length

  return <>
    <header className="x-site-header"><div className="x-site-heading"><div><span className="x-kicker">Commissioning checklist</span><h1>{site.name}</h1><p>{[site.city, site.state].filter(Boolean).join(', ')}</p></div>
      {canEdit && <button className="x-issue-actions primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 15px', color: '#fff', border: 0, borderRadius: 8, background: 'var(--amethyst)', cursor: pendingCount ? 'pointer' : 'not-allowed', opacity: pendingCount ? 1 : .55 }} disabled={!pendingCount || saving} onClick={save}><Save size={15} /> {saving ? 'Saving…' : `Save ${pendingCount || ''} change${pendingCount === 1 ? '' : 's'}`}</button>}
    </div></header>

    {error && <p className="x-error">{error}</p>}
    {saved && !pendingCount && <p className="x-import-success">Production stages saved.</p>}
    {loading && <div className="x-state"><h1>Loading units</h1></div>}

    {!loading && <div className="x-lean-issues x-commissioning-units">
      <div className="x-commissioning-unit-head"><span>Unit</span><span>Type</span><span>Status</span><span>Production stage</span></div>
      {units.map(unit => {
        const change = changes[unit.id]
        const stage = change?.build_stage ?? unit.build_stage ?? 'production'
        const shipTo = change ? change.ship_to : unit.ship_to ?? null
        const stageIndex = STAGES.findIndex(s => s.key === stage)
        return <div className="x-commissioning-unit-row" key={unit.id}>
          <span><strong>{unit.tag}</strong></span>
          <span>{unit.unit_type || '—'}</span>
          <span>{unit.status}</span>
          <span className="x-stage-cell">
            <div className="x-stage-track">
              {STAGES.map((s, i) => <button key={s.key} type="button" title={s.label} disabled={!canEdit}
                className={`x-stage-dot ${i < stageIndex ? 'is-done' : ''} ${i === stageIndex ? 'is-current' : ''}`}
                onClick={() => setStage(unit, s.key)}>{i + 1}</button>)}
            </div>
            <div className="x-stage-caption">
              <small>{STAGE_LABELS[stage] || stage}</small>
              {stage === 'shipped' && (canEdit
                ? <select value={shipTo || ''} onChange={e => setShipTo(unit, e.target.value)}><option value="">Ship to…</option><option value="customer">Customer</option><option value="warehouse">Warehouse</option></select>
                : shipTo && <em>· {shipTo}</em>)}
            </div>
          </span>
        </div>
      })}
      {!units.length && <div className="x-resource-empty"><ClipboardCheck size={28} /><strong>No units yet</strong><p>Import or add units to this site to start the commissioning checklist.</p></div>}
    </div>}
  </>
}
