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
  const [unitModels, setUnitModels] = useState('')
  const [unitCounts, setUnitCounts] = useState('')
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!projectName || !projectNumber || !unitModels || !unitCounts || !address || !city || !state || !zip) {
      toast('Please fill in all required fields.', 'error')
      return
    }

    setSaving(true)

    const data: Partial<Site> = {
      name: name || projectName || undefined,
      project_name: projectName,
      project_number: projectNumber,
      address,
      city,
      state,
      zip,
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

      // Save job numbers
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

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 900 }}>
        {/* Basic Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Required Information</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Site Name *</label>
              <input required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Project Name *</label>
              <input required value={projectName} onChange={e => setProjectName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Project Number *</label>
              <input required value={projectNumber} onChange={e => setProjectNumber(e.target.value)} placeholder="5-digit #"/>
            </div>
            <div className="form-group">
              <label>Unit Models *</label>
              <input required value={unitModels} onChange={e => setUnitModels(e.target.value)} placeholder="e.g. AHU-500" />
            </div>
            <div className="form-group">
              <label># of Units *</label>
              <input required type="number" value={unitCounts} onChange={e => setUnitCounts(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Site Address *</div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Street *</label>
              <input required value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label>City *</label>
              <input required value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="form-group">
              <label>State *</label>
              <select required value={state} onChange={e => setState(e.target.value)}>
                <option value="">— Select —</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Zip *</label>
              <input required value={zip} onChange={e => setZip(e.target.value)} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Site'}
        </button>
      </form>
    </div>
  )
}
