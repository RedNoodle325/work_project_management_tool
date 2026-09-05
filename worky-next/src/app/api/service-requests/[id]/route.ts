import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'

export async function PATCH(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireAuth(request,{permission:'service_requests:review'})
  if(auth.error)return auth.error
  const {id}=await params,body=await request.json(),action=String(body.action||'')
  const [record]=await sql`select * from public.service_requests where id=${id}`
  if(!record)return NextResponse.json({error:'Request not found'},{status:404})
  if(record.status!=='pending_review')return NextResponse.json({error:'This request has already been reviewed'},{status:409})
  if(action==='return'){
    const notes=String(body.review_notes||'').trim()
    if(!notes)return NextResponse.json({error:'Explain what the requester needs to correct'},{status:400})
    const [updated]=await sql`update public.service_requests set status='returned',reviewed_by=${auth.claims.sub},review_notes=${notes},updated_at=now() where id=${id} returning *`
    return NextResponse.json(updated)
  }
  if(action!=='approve')return NextResponse.json({error:'Invalid review action'},{status:400})
  if(!record.site_id)return NextResponse.json({error:'Link this request to an existing site before approval'},{status:400})
  const created=await sql.begin(async tx=>{
    const trx=tx as unknown as typeof sql
    const prefix=record.request_type==='warranty'?'WAR':record.request_type==='startup'?'BSU':'BSV'
    const [stamp]=await trx`select to_char(now() at time zone 'America/New_York','YYYYMMDD') as day`
    await trx`select pg_advisory_xact_lock(hashtext(${`work-order:${stamp.day}:${prefix}`}))`
    const [sequence]=await trx`select coalesce(max(right(work_order_number,3)::int),0)+1 as value from public.job_schedule where work_order_number like ${`WO-${stamp.day}-${prefix}-%`}`
    const workOrderNumber=`WO-${stamp.day}-${prefix}-${String(Number(sequence.value)).padStart(3,'0')}`
    const [job]=await trx`insert into public.job_schedule(site_id,pm_id,work_order_number,job_name,job_type,contract_number,priority,status,notes,scope) values(${record.site_id},${record.requested_by},${workOrderNumber},${record.site_name},${record.request_type==='warranty'?'Warranty':record.request_type==='startup'?'Billable startup':'Billable service'},${record.po_number||record.c2_number||null},3,'scheduled',${`Created from ${record.request_number}`},${record.requested_scope}) returning *`
    const [updated]=await trx`update public.service_requests set status='approved',reviewed_by=${auth.claims.sub},review_notes=${String(body.review_notes||'').trim()||null},resulting_job_id=${job.id},updated_at=now() where id=${id} returning *`
    return {request:updated,job}
  })
  return NextResponse.json(created)
}
