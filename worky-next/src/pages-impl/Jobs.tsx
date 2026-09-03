'use client'

import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Check, Search, UserRound, UsersRound } from 'lucide-react'
import { API } from '@/api'
import { useToastFn } from '@/app/providers'
import type { ProjectJob, ProjectJobsResponse } from '@/types'

type View = 'all' | 'mine'
const PAGE_SIZE = 40

export function Jobs() {
  const toast = useToastFn()
  const [data, setData] = useState<ProjectJobsResponse>({ jobs: [], project_managers: [], sites: [], representatives: [], customers: [] })
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    setError('')
    return API.projectJobs.list().then(setData).catch(error => setError(error.message || 'Jobs could not be loaded.')).finally(() => setLoading(false))
  }
  useEffect(() => {
    API.projectJobs.list()
      .then(setData)
      .catch(error => setError(error.message || 'Jobs could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  const mineCount = data.current_user ? data.jobs.filter(job => job.assigned_pm_id === data.current_user?.id).length : 0
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    return data.jobs.filter(job => {
      if (view === 'mine' && job.assigned_pm_id !== data.current_user?.id) return false
      return !text || [job.job_number, job.project_code, job.name, job.representative_code, job.representative_name, job.customer_name, job.assigned_pm_name, job.assigned_pm_email, job.site_name, job.site_customer_name, job.site_city, job.site_state]
        .some(value => String(value || '').toLowerCase().includes(text))
    })
  }, [data, query, view])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageJobs = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function assign(job: ProjectJob, projectManagerId: string | null) {
    setSaving(job.id)
    try {
      await API.projectJobs.assign(job.id, projectManagerId)
      const manager = data.project_managers.find(person => person.id === projectManagerId)
      setData(current => ({ ...current, jobs: current.jobs.map(item => item.id === job.id ? {
        ...item,
        assigned_pm_id: manager?.id,
        assigned_pm_name: manager?.display_name,
        assigned_pm_email: manager?.email,
      } : item) }))
      toast(projectManagerId ? `Assigned ${job.job_number}` : `Unassigned ${job.job_number}`, 'success')
    } catch (error) {
      toast((error as Error).message || 'Assignment could not be saved.', 'error')
    } finally { setSaving(null) }
  }

  async function assignSite(job: ProjectJob, siteId: string | null) {
    setSaving(job.id)
    try {
      await API.projectJobs.assignSite(job.id, siteId)
      const site = data.sites.find(item => item.id === siteId)
      setData(current => ({ ...current, jobs: current.jobs.map(item => item.id === job.id ? {
        ...item,
        site_id: site?.id,
        site_name: site?.name,
        customer_id: site?.customer_id || item.customer_id,
        customer_name: site?.customer_name || item.customer_name,
        site_customer_name: site?.customer_name,
        site_city: site?.city,
        site_state: site?.state,
      } : item) }))
      toast(siteId ? `Linked ${job.job_number} to ${site?.name || 'site'}` : `Removed site from ${job.job_number}`, 'success')
    } catch (error) {
      toast((error as Error).message || 'Site assignment could not be saved.', 'error')
    } finally { setSaving(null) }
  }

  async function assignRepresentative(job: ProjectJob, representativeId: string | null) {
    setSaving(job.id)
    try {
      await API.projectJobs.assignRepresentative(job.id, representativeId)
      const representative = data.representatives.find(item => item.id === representativeId)
      setData(current => ({ ...current, jobs: current.jobs.map(item => item.id === job.id ? { ...item, representative_id: representative?.id, representative_name: representative?.name, assigned_representative_code: representative?.code } : item) }))
      toast(representativeId ? `Representative assigned to ${job.job_number}` : `Representative removed from ${job.job_number}`, 'success')
    } catch (error) {
      toast((error as Error).message || 'Representative assignment could not be saved.', 'error')
    } finally { setSaving(null) }
  }

  async function assignCustomer(job: ProjectJob, customerId: string | null) {
    setSaving(job.id)
    try {
      await API.projectJobs.assignCustomer(job.id, customerId)
      const customer = data.customers.find(item => item.id === customerId)
      const keepSite = !job.site_id || data.sites.some(site => site.id === job.site_id && site.customer_id === customerId)
      setData(current => ({ ...current, jobs: current.jobs.map(item => item.id === job.id ? {
        ...item,
        customer_id: customer?.id,
        customer_name: customer?.name,
        site_id: keepSite ? item.site_id : undefined,
        site_name: keepSite ? item.site_name : undefined,
        site_customer_name: keepSite ? item.site_customer_name : undefined,
        site_city: keepSite ? item.site_city : undefined,
        site_state: keepSite ? item.site_state : undefined,
      } : item) }))
      toast(customerId ? `Customer assigned to ${job.job_number}` : `Customer removed from ${job.job_number}`, 'success')
    } catch (error) {
      toast((error as Error).message || 'Customer assignment could not be saved.', 'error')
    } finally { setSaving(null) }
  }

  return <main className="x-page x-jobs-page">
    <header className="x-directory-head">
      <div><span className="x-kicker">Project directory</span><h1>Jobs</h1><p>{data.jobs.length} released jobs · {mineCount} assigned to {data.current_user?.display_name || 'you'} · {data.jobs.filter(job => job.site_id).length} linked to sites</p></div>
      <div className="x-jobs-summary"><BriefcaseBusiness size={18} /><span><strong>{visible.length}</strong> showing</span></div>
    </header>

    <section className="x-jobs-toolbar" aria-label="Job filters">
      <div className="x-jobs-toggle" role="group" aria-label="Job ownership">
        <button className={view === 'all' ? 'active' : ''} onClick={() => { setView('all'); setPage(1) }}><UsersRound size={15} />All Jobs <span>{data.jobs.length}</span></button>
        <button className={view === 'mine' ? 'active' : ''} onClick={() => { setView('mine'); setPage(1) }}><UserRound size={15} />My Jobs <span>{mineCount}</span></button>
      </div>
      <label className="x-directory-search"><Search size={17} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search job number, project, site, rep, or PM…" /></label>
    </section>

    {error ? <div className="x-load-panel"><strong>Jobs are temporarily unavailable</strong><p>{error}</p><button className="primary" onClick={load}>Try again</button></div> : loading ? <div className="x-jobs-loading">Loading jobs…</div> : <section className="x-jobs-list" aria-live="polite">
      <div className="x-jobs-head"><span>Job</span><span>Project</span><span>Customer</span><span>Site</span><span>Representative</span><span>Project manager</span></div>
      {pageJobs.map(job => {
        const isMine = job.assigned_pm_id === data.current_user?.id
        const siteOptions = job.customer_id ? data.sites.filter(site => site.customer_id === job.customer_id) : data.sites
        return <article className={`x-job-row ${isMine ? 'is-mine' : ''}`} key={job.id}>
          <div className="x-job-number"><strong>{job.job_number}</strong>{isMine && <span><Check size={11} />Mine</span>}</div>
          <div className="x-job-name"><strong>{job.name}</strong><small>{job.project_code}</small></div>
          <div className="x-job-customer"><select aria-label={`Customer for ${job.job_number}`} disabled={saving === job.id} value={job.customer_id || ''} onChange={event => void assignCustomer(job, event.target.value || null)}><option value="">No customer</option>{data.customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
          <div className="x-job-site">
            <select aria-label={`Site for ${job.job_number}`} disabled={saving === job.id} value={job.site_id || ''} onChange={event => void assignSite(job, event.target.value || null)}>
              <option value="">No site assigned</option>
              {siteOptions.map(site => <option key={site.id} value={site.id}>{site.name}{!job.customer_id && site.customer_name ? ` · ${site.customer_name}` : ''}</option>)}
            </select>
            {job.site_id && <small>{[job.site_city, job.site_state].filter(Boolean).join(', ') || job.site_customer_name}</small>}
          </div>
          <div className="x-job-rep"><select aria-label={`Representative for ${job.job_number}`} disabled={saving === job.id} value={job.representative_id || ''} onChange={event => void assignRepresentative(job, event.target.value || null)}><option value="">No representative</option>{data.representatives.map(representative => <option key={representative.id} value={representative.id}>{representative.name}{representative.code && representative.code !== representative.name ? ` (${representative.code})` : ''}</option>)}</select></div>
          <div className="x-job-assignee">
            <select aria-label={`Project manager for ${job.job_number}`} disabled={saving === job.id} value={job.assigned_pm_id || ''} onChange={event => void assign(job, event.target.value || null)}>
              <option value="">Unassigned</option>
              {data.project_managers.map(person => <option key={person.id} value={person.id}>{person.display_name || person.email}{person.id === data.current_user?.id ? ' (me)' : ''}</option>)}
            </select>
            {data.current_user && !isMine && <button disabled={saving === job.id} onClick={() => void assign(job, data.current_user!.id)}>Assign to me</button>}
          </div>
        </article>
      })}
      {!visible.length && <div className="x-empty">{view === 'mine' ? 'No jobs assigned to you yet. Switch to All Jobs and choose “Assign to me.”' : 'No jobs match that search.'}</div>}
      {visible.length > PAGE_SIZE && <footer className="x-jobs-pagination"><span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, visible.length)} of {visible.length}</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><b>Page {currentPage} of {pageCount}</b><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>}
    </section>}
  </main>
}
