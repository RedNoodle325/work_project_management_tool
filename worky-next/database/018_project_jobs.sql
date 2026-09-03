-- Released-job directory and project-manager ownership.
-- The Jobs API idempotently imports the 240 released projects from the checked-in
-- SharePoint CSV so deployments and existing databases receive the same catalog.
CREATE TABLE IF NOT EXISTS public.project_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL,
  project_code text NOT NULL UNIQUE,
  representative_code text,
  name text NOT NULL,
  assigned_pm_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_jobs_number_idx ON public.project_jobs(job_number);
CREATE INDEX IF NOT EXISTS project_jobs_pm_idx ON public.project_jobs(assigned_pm_id);
