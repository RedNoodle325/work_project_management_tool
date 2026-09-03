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
  const [schema] = await sql`
    SELECT
      to_regclass('public.project_jobs') IS NOT NULL AS has_jobs,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_jobs' AND column_name = 'site_id') AS has_job_site,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_jobs' AND column_name = 'customer_id') AS has_job_customer,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_jobs' AND column_name = 'representative_id') AS has_job_representative,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'project_job_id') AS has_issue_job,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_updates' AND column_name = 'project_job_id') AS has_milestone_job
  `
  if (!schema.has_jobs || !schema.has_job_site || !schema.has_job_customer || !schema.has_job_representative || !schema.has_issue_job || !schema.has_milestone_job) {
    await sql`
      CREATE TABLE IF NOT EXISTS public.project_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_number text NOT NULL,
        project_code text NOT NULL UNIQUE,
        representative_code text,
        name text NOT NULL,
        assigned_pm_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
        site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
        customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
        representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `
    await sql`ALTER TABLE public.project_jobs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL`
    await sql`ALTER TABLE public.project_jobs ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL`
    await sql`ALTER TABLE public.project_jobs ADD COLUMN IF NOT EXISTS representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL`
    await sql`CREATE INDEX IF NOT EXISTS project_jobs_number_idx ON public.project_jobs(job_number)`
    await sql`CREATE INDEX IF NOT EXISTS project_jobs_pm_idx ON public.project_jobs(assigned_pm_id)`
    await sql`CREATE INDEX IF NOT EXISTS project_jobs_site_idx ON public.project_jobs(site_id)`
    await sql`CREATE INDEX IF NOT EXISTS project_jobs_customer_idx ON public.project_jobs(customer_id)`
    await sql`CREATE INDEX IF NOT EXISTS project_jobs_representative_idx ON public.project_jobs(representative_id)`
    await sql`ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS project_job_id uuid REFERENCES public.project_jobs(id) ON DELETE RESTRICT`
    await sql`ALTER TABLE public.site_updates ADD COLUMN IF NOT EXISTS project_job_id uuid REFERENCES public.project_jobs(id) ON DELETE SET NULL`
    await sql`CREATE INDEX IF NOT EXISTS issues_project_job_idx ON public.issues(project_job_id)`
    await sql`CREATE INDEX IF NOT EXISTS site_updates_project_job_idx ON public.site_updates(project_job_id)`
  }

  const jobs = await loadSeedJobs()
  const [catalog] = await sql`
    SELECT
      (SELECT count(*)::int FROM public.project_jobs) AS job_count,
      (SELECT count(*)::int FROM public.project_jobs WHERE representative_id IS NULL AND representative_code IS NOT NULL AND btrim(representative_code) <> '') AS missing_representatives,
      (SELECT count(*)::int FROM public.project_jobs j JOIN public.sites s ON s.id = j.site_id WHERE j.customer_id IS DISTINCT FROM s.customer_id) AS mismatched_customers,
      (SELECT count(*)::int FROM public.issues i WHERE project_job_id IS NULL AND site_id IS NOT NULL AND (SELECT count(*) FROM public.project_jobs j WHERE j.site_id = i.site_id) = 1) AS legacy_issues
  `
  const catalogNeedsSeed = Number(catalog.job_count) < jobs.length
  if (catalogNeedsSeed) {
    const seed = jobs.map(job => ({
      job_number: job.jobNumber,
      project_code: job.projectCode,
      representative_code: job.representativeCode,
      name: job.name,
    }))
    await sql`
      INSERT INTO public.project_jobs (job_number, project_code, representative_code, name)
      SELECT row.job_number, row.project_code, row.representative_code, row.name
      FROM jsonb_to_recordset(${JSON.stringify(seed)}::jsonb) AS row(
        job_number text, project_code text, representative_code text, name text
      )
      ON CONFLICT (project_code) DO UPDATE SET
        job_number = EXCLUDED.job_number,
        representative_code = EXCLUDED.representative_code,
        name = EXCLUDED.name
    `
  }

  if (catalogNeedsSeed || Number(catalog.missing_representatives) > 0) {
    await sql`
      INSERT INTO public.representatives (name, code)
      SELECT DISTINCT representative_code, representative_code
      FROM public.project_jobs
      WHERE representative_code IS NOT NULL AND btrim(representative_code) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM public.representatives r
          WHERE lower(r.code) = lower(project_jobs.representative_code)
             OR lower(r.name) = lower(project_jobs.representative_code)
        )
      ON CONFLICT DO NOTHING
    `
    await sql`
      UPDATE public.project_jobs j
      SET representative_id = r.id
      FROM public.representatives r
      WHERE j.representative_id IS NULL
        AND (lower(r.code) = lower(j.representative_code) OR lower(r.name) = lower(j.representative_code))
    `
  }
  if (Number(catalog.mismatched_customers) > 0) {
    await sql`
      UPDATE public.project_jobs j
      SET customer_id = s.customer_id
      FROM public.sites s
      WHERE j.site_id = s.id AND j.customer_id IS DISTINCT FROM s.customer_id
    `
  }
  if (Number(catalog.legacy_issues) > 0) {
    await sql`
      UPDATE public.issues i
      SET project_job_id = j.id
      FROM public.project_jobs j
      WHERE i.project_job_id IS NULL
        AND j.site_id = i.site_id
        AND NOT EXISTS (
          SELECT 1 FROM public.project_jobs other_job
          WHERE other_job.site_id = j.site_id AND other_job.id <> j.id
        )
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
