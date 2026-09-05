'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, ClipboardList, Plus, RotateCcw, Search, X } from 'lucide-react'
import { API } from '@/api'
import { useAuth } from '@/contexts/AuthContext'
import type { ServiceRequest, Site } from '@/types'

const typeLabels={billable:'Billable service',startup:'Startup / commissioning',warranty:'Warranty request'} as const
const reviewRoles=['owner','admin','service_ops']

export function ServiceRequests(){
 const {user}=useAuth(),canReview=Boolean(user?.role&&reviewRoles.includes(user.role))
 const [requests,setRequests]=useState<ServiceRequest[]>([]),[sites,setSites]=useState<Site[]>([]),[query,setQuery]=useState(''),[filter,setFilter]=useState('pending_review'),[open,setOpen]=useState(false),[selected,setSelected]=useState<ServiceRequest|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const load=async()=>{setLoading(true);try{const [requestRows,siteRows]=await Promise.all([API.serviceRequests.list(),API.sites.list()]);setRequests(requestRows);setSites(siteRows);setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load service requests')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const visible=useMemo(()=>requests.filter(r=>(filter==='all'||r.status===filter)&&`${r.request_number} ${r.site_name} ${r.unit_serial_number} ${r.requester_name||''}`.toLowerCase().includes(query.toLowerCase())),[requests,filter,query])
 const review=async(action:'approve'|'return',notes:string)=>{if(!selected)return;try{await API.serviceRequests.review(selected.id,action,notes);setSelected(null);await load()}catch(e){setError(e instanceof Error?e.message:'Unable to review request')}}
 return <main className="x-page x-intake-page">
  <header className="x-intake-hero"><div><span className="x-kicker">Service operations</span><h1>Service intake</h1><p>{canReview?'Validate commercial and warranty requirements before work enters dispatch.':'Submit complete service requests and track their review status.'}</p></div><button onClick={()=>setOpen(true)}><Plus size={17}/>New request</button></header>
  {error&&<p className="x-error">{error}</p>}
  <section className="x-intake-stats"><article><strong>{requests.filter(r=>r.status==='pending_review').length}</strong><span>Pending review</span></article><article><strong>{requests.filter(r=>r.status==='returned').length}</strong><span>Returned</span></article><article><strong>{requests.filter(r=>r.status==='approved').length}</strong><span>Approved</span></article></section>
  <section className="x-intake-queue"><header><div><ClipboardList size={18}/><h2>{canReview?'Review queue':'My requests'}</h2></div><div className="x-intake-controls"><label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search site, serial, or request"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending_review">Pending</option><option value="returned">Returned</option><option value="approved">Approved</option><option value="all">All</option></select></div></header>
  <div className="x-intake-list">{loading?<p>Loading requests…</p>:visible.map(r=><button key={r.id} onClick={()=>setSelected(r)}><div><span>{r.request_number}</span><strong>{r.site_name}</strong><small>{typeLabels[r.request_type]} · Serial {r.unit_serial_number}</small></div><div><em className={`status-${r.status}`}>{r.status.replace('_',' ')}</em><small>{r.requester_name||r.requester_email}</small></div><ChevronRight size={18}/></button>)}{!loading&&!visible.length&&<p>No requests match this view.</p>}</div></section>
  {open&&<RequestModal sites={sites} close={()=>setOpen(false)} saved={async()=>{setOpen(false);await load()}}/>}
  {selected&&<Detail request={selected} canReview={canReview} close={()=>setSelected(null)} review={review}/>}
 </main>
}

function RequestModal({sites,close,saved}:{sites:Site[];close:()=>void;saved:()=>Promise<void>}){
 const [type,setType]=useState<ServiceRequest['request_type']>('billable'),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setError('');try{await API.serviceRequests.create(Object.fromEntries(new FormData(e.currentTarget)) as Partial<ServiceRequest>);await saved()}catch(err){setError(err instanceof Error?err.message:'Unable to submit request')}finally{setBusy(false)}}
 return <div className="x-intake-shade" onClick={close}><section className="x-intake-modal" onClick={e=>e.stopPropagation()}><button className="x-intake-close" onClick={close}><X/></button><span className="x-kicker">Required intake</span><h2>Submit service request</h2><p>This request will not enter dispatch until Service Operations approves it.</p>{error&&<p className="x-error">{error}</p>}<form onSubmit={submit}>
  <label>Request type<select name="request_type" value={type} onChange={e=>setType(e.target.value as ServiceRequest['request_type'])}><option value="billable">Billable service</option><option value="startup">Startup / commissioning</option><option value="warranty">Warranty request</option></select></label>
  <label>Existing site<select name="site_id"><option value="">New or unlisted site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><small>Service Operations must link new sites before approval.</small></label>
  <div className="x-form-pair"><label>Site name<input name="site_name" required/></label><label>Region<select name="region"><option>Americas</option><option>EMEA</option><option>APAC</option></select></label></div>
  <label>Full site address<textarea name="site_address" required/></label><div className="x-form-pair"><label>Site contact<input name="site_contact_name" required/></label><label>Email or phone<input name="site_contact_details" required/></label></div>
  <label>Unit serial number<input name="unit_serial_number" required/></label><label>Requested scope<textarea name="requested_scope" required/></label><label>Requested service date<input name="requested_service_date" type="date" required/></label>
  {(type==='billable'||type==='startup')&&<div className="x-form-pair"><label>PO number<input name="po_number"/></label><label>Other payment authorization<input name="payment_evidence" placeholder="Approved NTE, paid quote, or reference"/></label></div>}
  {type==='startup'&&<label>Contract language<textarea name="contract_language" required placeholder="Applicable startup scope, commercial terms, and exclusions"/></label>}
  {type==='warranty'&&<><label>C-2 number<input name="c2_number" required/></label><div className="x-form-pair"><label>Warranty start<input name="warranty_start_date" type="date"/></label><label>Warranty end<input name="warranty_end_date" type="date"/></label></div><label>Warranty information<textarea name="warranty_details" required/></label></>}
  <button disabled={busy}>{busy?'Submitting…':'Submit for review'}</button>
 </form></section></div>
}

function Detail({request,canReview,close,review}:{request:ServiceRequest;canReview:boolean;close:()=>void;review:(action:'approve'|'return',notes:string)=>Promise<void>}){
 const [notes,setNotes]=useState(request.review_notes||'')
 return <div className="x-intake-shade" onClick={close}><section className="x-intake-modal x-intake-detail" onClick={e=>e.stopPropagation()}><button className="x-intake-close" onClick={close}><X/></button><span className="x-kicker">{request.request_number} · {typeLabels[request.request_type]}</span><h2>{request.site_name}</h2><p>{request.site_address}</p><dl><dt>Unit serial</dt><dd>{request.unit_serial_number}</dd><dt>Site contact</dt><dd>{request.site_contact_name}<br/>{request.site_contact_details}</dd><dt>Requested date</dt><dd>{request.requested_service_date}</dd><dt>Scope</dt><dd>{request.requested_scope}</dd>{request.po_number&&<><dt>PO</dt><dd>{request.po_number}</dd></>}{request.payment_evidence&&<><dt>Payment authorization</dt><dd>{request.payment_evidence}</dd></>}{request.contract_language&&<><dt>Contract language</dt><dd>{request.contract_language}</dd></>}{request.c2_number&&<><dt>C-2</dt><dd>{request.c2_number}</dd></>}{request.warranty_details&&<><dt>Warranty</dt><dd>{request.warranty_details}</dd></>}</dl>{canReview&&request.status==='pending_review'&&<div className="x-review"><label>Review notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Required when returning a request"/></label><div><button className="return" onClick={()=>void review('return',notes)}><RotateCcw size={16}/>Return incomplete</button><button onClick={()=>void review('approve',notes)}><CheckCircle2 size={16}/>Approve and create work order</button></div></div>}</section></div>
}
