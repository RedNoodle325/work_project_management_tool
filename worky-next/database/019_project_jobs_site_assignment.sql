-- Link released jobs to operational sites without changing existing project records.
ALTER TABLE public.project_jobs
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_jobs_site_idx ON public.project_jobs(site_id);
