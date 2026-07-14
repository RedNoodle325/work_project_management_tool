'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileSpreadsheet, Plus, RefreshCw, Search, Upload, X } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { LeanIssueV2, SiteSummaryV2 } from '@/types/v2'

export function XnrgyIssues() {
  const [issues, setIssues] = useState<LeanIssueV2[]>([])
  const [sites, setSites] = useState<SiteSummaryV2[]>([])
  const [siteId, setSiteId] = useState('')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([V2.issues.list(), V2.hierarchy.list()]).then(([issueRows, hierarchy]) => {
      setIssues(issueRows)
      const byId = new Map<string, SiteSummaryV2>()
      hierarchy.forEach(customer => {
        customer.sites?.forEach(site => byId.set(site.id, site))
        customer.locations?.forEach(location => location.sites?.forEach(site => byId.set(site.id, site)))
      })
      setSites(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)))
    }).catch(error => setError(error.message)).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return issues
    return issues.filter(issue => [issue.issue_number, issue.description, issue.equipment_name, issue.serial_number]
      .some(value => value?.toLowerCase().includes(needle)))
  }, [issues, search])

  function changeSite(value: string) {
    setSiteId(value)
    setLoading(true)
    V2.issues.list(value || undefined).then(setIssues).catch(error => setError(error.message)).finally(() => setLoading(false))
  }

  return <div className="x-page x-issues-page">
    <header className="x-directory-head">
      <div><span className="x-kicker">Issue tracker</span><h1>Issues</h1><p>Issue number, description, equipment, and serial number—nothing extra.</p></div>
      <div className="x-issue-actions"><button onClick={() => setShowSync(true)}><RefreshCw size={16} /> Sync CxAlloy</button><button onClick={() => setShowImport(true)}><Upload size={16} /> Import export</button><button className="primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New issue</button></div>
    </header>

    <div className="x-issue-toolbar">
      <label><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search issues or equipment…" /></label>
      <select value={siteId} onChange={event => changeSite(event.target.value)}><option value="">All sites</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select>
      <span>{filtered.length} issues</span>
    </div>

    {error && <div className="x-load-panel"><strong>Couldn’t load the issue tracker</strong><p>{error}</p></div>}
    {!error && loading && <div className="x-state"><h1>Loading issues</h1><p>Gathering the latest imported records…</p></div>}
    {!error && !loading && <div className="x-lean-issues">
      <div className="x-lean-issue-head"><span>Issue Number</span><span>Description</span><span>Equipment Name / Asset Tag</span><span>Serial #</span></div>
      {filtered.map(issue => <div className="x-lean-issue-row" key={issue.id}>
        <span><strong>{issue.issue_number}</strong>{issue.source_url && <a className="x-lean-issue-link" href={issue.source_url} target="_blank" rel="noreferrer">Open in CxAlloy <ExternalLink size={12} /></a>}<small>{issue.site_name}</small></span>
        <p>{issue.description || '—'}</p>
        <code>{issue.equipment_name || '—'}</code>
        <code className={!issue.serial_number ? 'is-empty' : ''}>{issue.serial_number || '—'}</code>
      </div>)}
      {!filtered.length && <div className="x-resource-empty"><FileSpreadsheet size={30} /><strong>No issues found</strong><p>Add an issue directly or import a CxAlloy export.</p><button onClick={() => setShowCreate(true)}><Plus size={15} /> New issue</button></div>}
    </div>}

    {showImport && <ImportIssues sites={sites} initialSiteId={siteId} close={() => setShowImport(false)} imported={(selectedSiteId) => { setShowImport(false); changeSite(selectedSiteId) }} />}
    {showSync && <SyncIssues sites={sites} initialSiteId={siteId} close={() => setShowSync(false)} synced={(selectedSiteId) => { setShowSync(false); changeSite(selectedSiteId) }} />}
    {showCreate && <CreateIssue sites={sites} initialSiteId={siteId} close={() => setShowCreate(false)} saved={(selectedSiteId) => { setShowCreate(false); changeSite(selectedSiteId) }} />}
  </div>
}

function CreateIssue({ sites, initialSiteId, close, saved }: { sites: SiteSummaryV2[]; initialSiteId: string; close: () => void; saved: (siteId: string) => void }) {
  const [form, setForm] = useState({ site_id: initialSiteId, issue_number: '', description: '', equipment_name: '', serial_number: '', status: 'open', priority: 'normal', source_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [field]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await V2.issues.create(form); saved(form.site_id) }
    catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}>
    <header><div><span className="x-kicker">Manual entry</span><h2>New issue</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    <p className="x-import-intro">Add an issue immediately. If the issue number already exists for this site, its fields are updated instead of creating a duplicate.</p>
    <label className="x-field"><span>Site</span><select value={form.site_id} onChange={event => set('site_id')(event.target.value)} required><option value="">Choose a site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    <label className="x-field"><span>Issue number</span><input value={form.issue_number} onChange={event => set('issue_number')(event.target.value)} required placeholder="e.g. 614-001" /></label>
    <label className="x-field"><span>Description</span><textarea value={form.description} onChange={event => set('description')(event.target.value)} rows={3} placeholder="Describe the issue" /></label>
    <div className="x-form-row"><label className="x-field"><span>Equipment / asset tag</span><input value={form.equipment_name} onChange={event => set('equipment_name')(event.target.value)} /></label><label className="x-field"><span>Serial #</span><input value={form.serial_number} onChange={event => set('serial_number')(event.target.value)} /></label></div>
    <div className="x-form-row"><label className="x-field"><span>Status</span><select value={form.status} onChange={event => set('status')(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="scheduled">Scheduled</option><option value="waiting_parts">Waiting parts</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label className="x-field"><span>Priority</span><select value={form.priority} onChange={event => set('priority')(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
    <label className="x-field"><span>CxAlloy link (optional)</span><input type="url" value={form.source_url} onChange={event => set('source_url')(event.target.value)} placeholder="https://tq.cxalloy.com/..." /></label>
    {error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Create issue'}</button></footer>
  </form></div>
}

function ImportIssues({ sites, initialSiteId, close, imported }: { sites: SiteSummaryV2[]; initialSiteId: string; close: () => void; imported: (siteId: string) => void }) {
  const picker = useRef<HTMLInputElement>(null)
  const [siteId, setSiteId] = useState(initialSiteId)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!siteId || !file) return
    setSaving(true); setError(''); setNote('')
    try {
      const result = await V2.issues.importCxAlloy(siteId, file)
      setNote(`${result.imported} issues processed (${result.created} new, ${result.updated} updated).${result.serialColumnFound ? '' : ' Serial numbers were matched from existing equipment where available.'}`)
      window.setTimeout(() => imported(siteId), 900)
    } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }

  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}>
    <header><div><span className="x-kicker">CxAlloy</span><h2>Import issues</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    <p className="x-import-intro">Only Issue Number, Description, Equipment Name / Asset Tag, and Serial Number are stored. Re-importing the same export updates existing issues.</p>
    <label className="x-field"><span>Site</span><select value={siteId} onChange={event => setSiteId(event.target.value)} required><option value="">Choose a site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    <label className="x-file-drop" onClick={() => picker.current?.click()}><FileSpreadsheet size={25} /><strong>{file?.name || 'Choose CxAlloy Excel export'}</strong><span>.xlsx files are supported</span><input ref={picker} type="file" accept=".xlsx" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
    {error && <p className="x-error">{error}</p>}{note && <p className="x-import-success">{note}</p>}
    <footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving || !siteId || !file}>{saving ? 'Importing…' : 'Import issues'}</button></footer>
  </form></div>
}

function SyncIssues({ sites, initialSiteId, close, synced }: { sites: SiteSummaryV2[]; initialSiteId: string; close: () => void; synced: (siteId: string) => void }) {
  const [siteId, setSiteId] = useState(initialSiteId)
  const [projectId, setProjectId] = useState('40206')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await V2.issues.syncCxAlloy(siteId, Number(projectId)); synced(siteId) }
    catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}>
    <header><div><span className="x-kicker">CxAlloy API</span><h2>Sync assigned issues</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    <p className="x-import-intro">Pulls issues assigned to Subcontractor, XNRGY, or Zak Klinedinst and updates matching issue numbers. A read-only CxAlloy API key must be configured on the server.</p>
    <label className="x-field"><span>Site</span><select value={siteId} onChange={event => setSiteId(event.target.value)} required><option value="">Choose a site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    <label className="x-field"><span>CxAlloy project ID</span><input inputMode="numeric" value={projectId} onChange={event => setProjectId(event.target.value.replace(/\D/g, ''))} required /></label>
    {error && <p className="x-error">{error}</p>}
    <footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving || !siteId || !projectId}>{saving ? 'Syncing…' : 'Sync issues'}</button></footer>
  </form></div>
}
