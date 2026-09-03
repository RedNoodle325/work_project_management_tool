import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sql from './db'

type SeedJob = {
  jobNumber: string
  projectCode: string
  representativeCode: string | null
  name: string
}

let ready: Promise<void> | null = null

export function ensureProjectJobs() {
  if (!ready) ready = setup().catch(error => { ready = null; throw error })
  return ready
}

async function setup() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.project_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_number text NOT NULL,
      project_code text NOT NULL UNIQUE,
      representative_code text,
      name text NOT NULL,
      assigned_pm_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`ALTER TABLE public.project_jobs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL`
  await sql`CREATE INDEX IF NOT EXISTS project_jobs_number_idx ON public.project_jobs(job_number)`
  await sql`CREATE INDEX IF NOT EXISTS project_jobs_pm_idx ON public.project_jobs(assigned_pm_id)`
  await sql`CREATE INDEX IF NOT EXISTS project_jobs_site_idx ON public.project_jobs(site_id)`

  const jobs = await loadSeedJobs()
  for (const job of jobs) {
    await sql`
      INSERT INTO public.project_jobs (job_number, project_code, representative_code, name)
      VALUES (${job.jobNumber}, ${job.projectCode}, ${job.representativeCode}, ${job.name})
      ON CONFLICT (project_code) DO UPDATE SET
        job_number = EXCLUDED.job_number,
        representative_code = EXCLUDED.representative_code,
        name = EXCLUDED.name
    `
  }
}

async function loadSeedJobs(): Promise<SeedJob[]> {
  const source = join(process.cwd(), 'imports', 'sharepoint-released-project-job-list-2026-07-15.csv')
  const csv = await readFile(source, 'utf8')
  return csv.split(/\r?\n/).slice(1).flatMap(line => {
    const fields = line.match(/^"([^"]*)","([^"]*)","((?:[^"]|"")*)","([^"]*)"/)
    if (!fields || fields[4] !== 'Job / project folder' || !fields[2]) return []
    const projectCode = fields[3].replace(/""/g, '"')
    const details = projectDetails(fields[2], projectCode)
    return [{ jobNumber: fields[2], projectCode, ...details }]
  })
}

function projectDetails(jobNumber: string, projectCode: string) {
  const remainder = projectCode.replace(new RegExp(`^${jobNumber}(?:[- ](?:\\d+|\\(RD[^)]*\\)))?[ _-]*`, 'i'), '')
  const parts = remainder.split('_').filter(Boolean)
  if (parts.length >= 2) {
    return { representativeCode: parts[0].trim(), name: parts.slice(1).join(' ').replace(/\s+/g, ' ').trim() }
  }
  return { representativeCode: null, name: remainder.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || projectCode }
}

export async function currentProjectManager(claims: { sub: string; email: string }) {
  const byId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(claims.sub)
    ? await sql`SELECT id, email, display_name, access_role FROM public.users WHERE id = ${claims.sub} LIMIT 1`
    : []
  if (byId[0]) return byId[0]
  const byEmail = claims.email
    ? await sql`SELECT id, email, display_name, access_role FROM public.users WHERE lower(email) = ${claims.email.toLowerCase()} LIMIT 1`
    : []
  if (byEmail[0]) return byEmail[0]
  const fallback = await sql`
    SELECT id, email, display_name, access_role FROM public.users
    ORDER BY CASE WHEN access_role = 'owner' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
  `
  return fallback[0] ?? null
}
