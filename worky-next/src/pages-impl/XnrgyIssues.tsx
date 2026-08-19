'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileSpreadsheet, Pencil, Plus, Search, StickyNote, Upload, X } from 'lucide-react'
import { V2 } from '@/api/v2'
import type { LeanIssueV2, SiteSummaryV2 } from '@/types/v2'

export function XnrgyIssues() {
  const [issues, setIssues] = useState<LeanIssueV2[]>([])
  const [sites, setSites] = useState<SiteSummaryV2[]>([])
  const [siteId, setSiteId] = useState('')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editIssue, setEditIssue] = useState<LeanIssueV2 | null>(null)
  const [noteIssue, setNoteIssue] = useState<LeanIssueV2 | null>(null)
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
      <div className="x-issue-actions"><button onClick={() => setShowImport(true)}><Upload size={16} /> Import export</button><button className="primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New issue</button></div>
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
        <span><div className="x-issue-number-actions"><strong>{issue.issue_number}</strong>{issue.source_url && <a className="x-issue-icon-action" href={issue.source_url} target="_blank" rel="noreferrer" title="Open in CxAlloy" aria-label={`Open ${issue.issue_number} in CxAlloy`}><ExternalLink size={14} /></a>}<button type="button" className="x-issue-icon-action" onClick={() => setEditIssue(issue)} title="Edit issue" aria-label={`Edit ${issue.issue_number}`}><Pencil size={14} /></button><button type="button" className={`x-issue-icon-action ${issue.internal_notes ? 'has-note' : ''}`} onClick={() => setNoteIssue(issue)} title={issue.internal_notes ? 'Edit internal note' : 'Add internal note'} aria-label={`Add an internal note to ${issue.issue_number}`}><StickyNote size={14} /></button></div><small>{issue.site_name}{issue.status ? ` · ${issue.status.replace('_', ' ')}` : ''}{issue.priority ? ` · ${issue.priority}` : ''}</small></span>
        <p>{issue.description || '—'}</p>
        <code>{issue.equipment_name || '—'}</code>
        <code className={!issue.serial_number ? 'is-empty' : ''}>{issue.serial_number || '—'}</code>
      </div>)}
      {!filtered.length && <div className="x-resource-empty"><FileSpreadsheet size={30} /><strong>No issues found</strong><p>Add an issue directly or import a CxAlloy export.</p><button onClick={() => setShowCreate(true)}><Plus size={15} /> New issue</button></div>}
    </div>}

    {showImport && <ImportIssues sites={sites} initialSiteId={siteId} close={() => setShowImport(false)} imported={(selectedSiteId) => { setShowImport(false); changeSite(selectedSiteId) }} />}
    {showCreate && <CreateIssue sites={sites} initialSiteId={siteId} close={() => setShowCreate(false)} saved={(selectedSiteId) => { setShowCreate(false); changeSite(selectedSiteId) }} />}
    {editIssue && <EditIssue issue={editIssue} sites={sites} close={() => setEditIssue(null)} saved={(updated) => { setIssues(current => siteId && updated.site_id !== siteId ? current.filter(issue => issue.id !== updated.id) : current.map(issue => issue.id === updated.id ? updated : issue)); setEditIssue(null) }} />}
    {noteIssue && <IssueNotes issue={noteIssue} close={() => setNoteIssue(null)} saved={(notes) => { setIssues(current => current.map(issue => issue.id === noteIssue.id ? { ...issue, internal_notes: notes || undefined } : issue)); setNoteIssue(null) }} />}
  </div>
}

function IssueNotes({ issue, close, saved }: { issue: LeanIssueV2; close: () => void; saved: (notes: string) => void }) {
  const [notes, setNotes] = useState(issue.internal_notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await V2.issues.updateNotes(issue.id, notes); saved(notes.trim()) }
    catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}>
    <header><div><span className="x-kicker">Internal only</span><h2>Notes · {issue.issue_number}</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    <p className="x-import-intro">These notes stay in Site Intelligence and are not sent to CxAlloy.</p>
    <label className="x-field"><span>Internal notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={7} placeholder="Add coordination notes, next steps, or context…" autoFocus /></label>
    {error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save notes'}</button></footer>
  </form></div>
}

function EditIssue({ issue, sites, close, saved }: { issue: LeanIssueV2; sites: SiteSummaryV2[]; close: () => void; saved: (issue: LeanIssueV2) => void }) {
  const [form, setForm] = useState({
    site_id: issue.site_id,
    issue_number: issue.issue_number || '',
    description: issue.description || '',
    equipment_name: issue.equipment_name || '',
    serial_number: issue.serial_number || '',
    status: issue.status || 'open',
    priority: issue.priority || 'normal',
    source_url: issue.source_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [field]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { saved(await V2.issues.update(issue.id, form)) }
    catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}>
    <header><div><span className="x-kicker">Issue tracker</span><h2>Edit issue</h2></div><button type="button" onClick={close}><X size={18} /></button></header>
    <p className="x-import-intro">Update the issue record. Clear the issue number to assign the next number for the selected site.</p>
    <label className="x-field"><span>Site</span><select value={form.site_id} onChange={event => set('site_id')(event.target.value)} required><option value="">Choose a site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    <label className="x-field"><span>Issue number</span><input value={form.issue_number} onChange={event => set('issue_number')(event.target.value)} placeholder="Auto-assigned from site" /></label>
    <label className="x-field"><span>Description</span><textarea value={form.description} onChange={event => set('description')(event.target.value)} rows={3} placeholder="Describe the issue" /></label>
    <div className="x-form-row"><label className="x-field"><span>Equipment / asset tag</span><input value={form.equipment_name} onChange={event => set('equipment_name')(event.target.value)} /></label><label className="x-field"><span>Serial #</span><input value={form.serial_number} onChange={event => set('serial_number')(event.target.value)} /></label></div>
    <div className="x-form-row"><label className="x-field"><span>Status</span><select value={form.status} onChange={event => set('status')(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="scheduled">Scheduled</option><option value="waiting_parts">Waiting parts</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label className="x-field"><span>Priority</span><select value={form.priority} onChange={event => set('priority')(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
    <label className="x-field"><span>CxAlloy link (optional)</span><input type="url" value={form.source_url} onChange={event => set('source_url')(event.target.value)} placeholder="https://tq.cxalloy.com/..." /></label>
    {error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save issue'}</button></footer>
  </form></div>
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
    <p className="x-import-intro">Add an issue immediately. Leave the issue number blank to assign the next number for the selected site.</p>
    <label className="x-field"><span>Site</span><select value={form.site_id} onChange={event => set('site_id')(event.target.value)} required><option value="">Choose a site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    <label className="x-field"><span>Issue number</span><input value={form.issue_number} onChange={event => set('issue_number')(event.target.value)} placeholder="Auto-assigned from site" /></label>
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
