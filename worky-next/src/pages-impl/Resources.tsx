'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, ExternalLink, FileText, FolderKanban, Link as LinkIcon, Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react'
import { API } from '@/api'
import { useToastFn } from '@/app/providers'
import type { ResourceLink } from '@/types'

const categories = [
  { value: 'sharepoint', label: 'SharePoint', icon: FolderKanban },
  { value: 'document', label: 'Files & documents', icon: FileText },
  { value: 'tool', label: 'Tools & trackers', icon: Wrench },
  { value: 'reference', label: 'References', icon: BookOpen },
  { value: 'general', label: 'General', icon: LinkIcon },
]

type LinkForm = { name: string; url: string; category: string; description: string }
const emptyForm: LinkForm = { name: '', url: '', category: 'sharepoint', description: '' }

export function Resources() {
  const toast = useToastFn()
  const [links, setLinks] = useState<ResourceLink[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ResourceLink | null | undefined>(undefined)

  const load = () => API.resourceLinks.list().then(setLinks).catch(error => setError(error.message)).finally(() => setLoading(false))
  useEffect(() => { API.resourceLinks.list().then(setLinks).catch(error => setError(error.message)).finally(() => setLoading(false)) }, [])

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return links
    return links.filter(link => `${link.name} ${link.description || ''} ${link.category}`.toLowerCase().includes(text))
  }, [links, query])

  const grouped = categories.map(category => ({
    ...category,
    links: filtered.filter(link => normalizedCategory(link.category) === category.value),
  })).filter(group => group.links.length)

  async function remove(link: ResourceLink) {
    if (!window.confirm(`Delete ${link.name}?`)) return
    try { await API.resourceLinks.delete(link.id); toast('Link deleted'); load() }
    catch (error) { toast((error as Error).message, 'error') }
  }

  return <div className="x-page x-resources-page">
    <header className="x-directory-head">
      <div><span className="x-kicker">Quick access</span><h1>Resources</h1><p>Keep SharePoint locations, frequently used files, and everyday tools one click away.</p></div>
      <button className="x-resource-add" onClick={() => setEditing(null)}><Plus size={16} /> Add link</button>
    </header>

    <label className="x-directory-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search resources..." /></label>

    {error ? <div className="x-load-panel"><strong>Resources are unavailable</strong><p>{error}. Run database/006_resource_links.sql, then try again.</p><button className="primary" onClick={() => { setError(''); setLoading(true); load() }}>Try again</button></div>
      : loading ? <div className="x-resource-empty">Loading resources…</div>
      : filtered.length === 0 ? <div className="x-resource-empty"><LinkIcon size={24} /><strong>{query ? 'No matching resources' : 'Your resource library is empty'}</strong><p>{query ? 'Try a different search.' : 'Add your company SharePoint, working files, trackers, and reference links.'}</p>{!query && <button onClick={() => setEditing(null)}><Plus size={15} /> Add your first link</button>}</div>
      : <div className="x-resource-groups">{grouped.map(group => { const Icon = group.icon; return <section key={group.value} className="x-resource-group"><header><Icon size={16} /><h2>{group.label}</h2><span>{group.links.length}</span></header><div className="x-resource-grid">{group.links.map(link => <article className="x-resource-card" key={link.id}><div className="x-resource-icon"><Icon size={19} /></div><div className="x-resource-copy"><h3>{link.name}</h3>{link.description && <p>{link.description}</p>}{link.url && <small>{host(link.url)}</small>}</div><div className="x-resource-actions"><button aria-label={`Edit ${link.name}`} onClick={() => setEditing(link)}><Pencil size={14} /></button><button aria-label={`Delete ${link.name}`} onClick={() => remove(link)}><Trash2 size={14} /></button></div>{link.url && <a href={link.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={14} /></a>}</article>)}</div></section> })}</div>}

    {editing !== undefined && <LinkEditor link={editing} close={() => setEditing(undefined)} saved={() => { setEditing(undefined); load() }} />}
  </div>
}

function LinkEditor({ link, close, saved }: { link: ResourceLink | null; close: () => void; saved: () => void }) {
  const toast = useToastFn()
  const [form, setForm] = useState<LinkForm>(link ? { name: link.name, url: link.url || '', category: normalizedCategory(link.category), description: link.description || '' } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof LinkForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: event.target.value }))
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      if (link) await API.resourceLinks.update(link.id, form)
      else await API.resourceLinks.create(form)
      toast(link ? 'Link updated' : 'Link added'); saved()
    } catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  return <div className="x-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><form className="x-modal" onSubmit={submit}><header><div><span className="x-kicker">Resource library</span><h2>{link ? 'Edit link' : 'Add link'}</h2></div><button type="button" aria-label="Close" onClick={close}><X size={18} /></button></header><label className="x-field"><span>Name</span><input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Company SharePoint" required /></label><label className="x-field"><span>Web address</span><input type="url" value={form.url} onChange={set('url')} placeholder="https://company.sharepoint.com/..." required /></label><label className="x-field"><span>Category</span><select value={form.category} onChange={set('category')}>{categories.map(category => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label><label className="x-field"><span>Description</span><input value={form.description} onChange={set('description')} placeholder="What you use this for" /></label>{error && <p className="x-error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save link'}</button></footer></form></div>
}

function host(value: string) { try { return new URL(value).hostname.replace(/^www\./, '') } catch { return value } }
function normalizedCategory(value: string) { if (value === 'tracker') return 'tool'; if (value === 'form') return 'document'; return categories.some(category => category.value === value) ? value : 'general' }
