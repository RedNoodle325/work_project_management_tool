'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { API } from '../api'
import type { Site, JobNumber } from '../types'
import { useToastFn } from '@/app/providers'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const REGIONS = ['Northeast','Southeast','Midwest','Southwest','Northwest','Mountain','Pacific','Canada','International']

const SITE_TYPES = [
  { value: 'data_center', label: 'Data Center' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
]

interface JobRow {
  id?: string
  job_number: string
  description: string
  is_primary: boolean
}

export function SiteForm() {
  const { id } = useParams<{ id?: string }>()
  const router = useRouter()
  const toast = useToastFn()
  const isEditing = !!id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [name, setName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectNumber, setProjectNumber] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [region, setRegion] = useState('')
  const [siteType, setSiteType] = useState('')
  const [status, setStatus] = useState('active')
  const [warrantyStatus, setWarrantyStatus] = useState('')
  const [asteaSiteId, setAsteaSiteId] = useState('')
  const [owner, setOwner] = useState('')
  const [shippingName, setShippingName] = useState('')
  const [shippingContact, setShippingContact] = useState('')

  const [jobRows, setJobRows] = useState<JobRow[]>([
    { job_number: '', description: '', is_primary: true },
  ])

  useEffect(() => {
    async function load() {
      try {
        if (isEditing && id) {
          const [site, existingJobs] = await Promise.all([
            API.sites.get(id),
            API.jobNumbers.list(id).catch(() => [] as JobNumber[]),
          ])
          setName(site.name || '')
          setProjectName(site.project_name || '')
          setProjectNumber(site.project_number || '')
          setAddress(site.address || '')
          setCity(site.city || '')
          setState(site.state || '')
          setZip(site.zip || '')
          setRegion(site.region || '')
          setSiteType(site.site_type || '')
          setStatus(site.status || 'active')
          setWarrantyStatus(site.warranty_status || '')
          setAsteaSiteId(site.astea_site_id || '')
          setOwner(site.owner || '')
          setShippingName(site.shipping_name || '')
          setShippingContact(site.shipping_contact || '')
          if (existingJobs.length) {
            setJobRows(existingJobs.map(j => ({
              id: j.id,
              job_number: j.job_number,
              description: j.description || '',
              is_primary: false,
            })))
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load site')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEditing])

  const handleDelete = async () => {
    if (!id || !confirm('Delete this site? This cannot be undone.')) return
    try {
      await API.sites.delete(id)
      toast('Site deleted')
      router.push('/')
    } catch (e) {
      toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  const addJobRow = () => {
    setJobRows(rows => [...rows, { job_number: '', description: '', is_primary: false }])
  }

  const removeJobRow = (idx: number) => {
    setJobRows(rows => {
      const next = rows.filter((_, i) => i !== idx)
      if (rows[idx].is_primary && next.length > 0) {
        next[0] = { ...next[0], is_primary: true }
      }
      return next
    })
  }

  const updateJobRow = (idx: number, field: keyof JobRow, value: string | boolean) => {
    setJobRows(rows => rows.map((r, i) => {
      if (field === 'is_primary' && value === true) {
        return { ...r, is_primary: i === idx }
      }
      if (i !== idx) return r
      return { ...r, [field]: value }
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const data: Partial<Site> = {
      name: name || projectName || undefined,
      project_name: projectName || undefined,
      project_number: projectNumber || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
      region: region || undefined,
      site_type: siteType || undefined,
      status: status || undefined,
      warranty_status: warrantyStatus || undefined,
      astea_site_id: asteaSiteId || undefined,
      owner: owner || undefined,
      shipping_name: shippingName || undefined,
      shipping_contact: shippingContact || undefined,
    }

    try {
      let siteId: string
      if (isEditing && id) {
        await API.sites.update(id, data)
        siteId = id
        toast('Site updated')
      } else {
        const created = await API.sites.create(data)
        siteId = created.id
        toast('Site created')
      }

      const validJobs = jobRows.filter(j => j.job_number.trim())
      for (const job of validJobs) {
        const payload = { job_number: job.job_number.trim(), description: job.description.trim() || undefined }
        if (job.id) {
          await API.jobNumbers.update(siteId, job.id, payload).catch(() => null)
        } else {
          await API.jobNumbers.create(siteId, payload).catch(() => null)
        }
      }

      router.push(`/sites/${siteId}`)
    } catch (err) {
      toast('Error: ' + (err instanceof Error ? err.message : String(err)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const backHref = isEditing && id ? `/sites/${id}` : '/'

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Loading…</div>
  }

  if (error) {
    return <div style={{ color: 'var(--red)', padding: 40 }}>Error: {error}</div>
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={backHref} className="btn btn-secondary btn-sm">← Back</Link>
          <div>
            <h1 style={{ margin: 0 }}>{isEditing ? 'Edit Site' : 'New Site'}</h1>
            {isEditing && (projectName || name) && (
              <div className="page-subtitle">{projectName || name}</div>
            )}
          </div>
        </div>
        {isEditing && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleDelete}
            style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44' }}
          >
            Delete Site
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 900 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Basic Info</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Site Name *</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. QTS Reno Data Center" />
            </div>
            <div className="form-group">
              <label>Project Name</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. QTS Reno Phase 2" />
            </div>
            <div className="form-group">
              <label>Project Number</label>
              <input
                value={projectNumber}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 5)
                  setProjectNumber(val)
                }}
                placeholder="e.g. 10456 or 40123"
                maxLength={5}
              />
              {projectNumber.length === 5 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {(projectNumber.startsWith('10') || projectNumber.startsWith('11')) 
                    ? '🏭 Built in Montreal' 
                    : projectNumber.startsWith('40') 
                    ? '🏜️ Built in Mesa, AZ' 
                    : '⚠️ Unknown facility prefix'}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Owner / Customer</label>
              <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. Quality Technology Services" />
            </div>
            <div className="form-group">
              <label>Astea Site ID</label>
              <input value={asteaSiteId} onChange={e => setAsteaSiteId(e.target.value)} placeholder="e.g. QUAL055-GA167" style={{ fontFamily: 'monospace' }} />
            </div>
            <div className="form-group">
              <label>Site Type</label>
              <select value={siteType} onChange={e => setSiteType(e.target.value)}>
                <option value="">— Select —</option>
                {SITE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">— Select —</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="card-title" style={{ margin: 0 }}>Job Numbers</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addJobRow}>+ Add Job #</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 12px' }}>Astea order numbers for this site.</p>
          <div>
            {jobRows.map((row, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input placeholder="e.g. 22366582" value={row.job_number} onChange={e => updateJobRow(idx, 'job_number', e.target.value)} style={{ flex: '0 0 180px', fontFamily: 'monospace' }} />
                <input placeholder="Description (optional)" value={row.description} onChange={e => updateJobRow(idx, 'description', e.target.value)} style={{ flex: 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="jn_primary" checked={row.is_primary} onChange={() => updateJobRow(idx, 'is_primary', true)} /> Primary
                </label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeJobRow(idx)} style={{ padding: '4px 10px' }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Site Address</div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Street</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="form-group">
              <label>City</label>
              <input value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="form-group">
              <label>State</label>
              <select value={state} onChange={e => setState(e.target.value)}>
                <option value="">— Select —</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Zip</label>
              <input value={zip} onChange={e => setZip(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ padding: '0 0 32px' }}>
          <Link href={backHref} className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Site'}
          </button>
        </div>
      </form>
    </div>
  )
}
