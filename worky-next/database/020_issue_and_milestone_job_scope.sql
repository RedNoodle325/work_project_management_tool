-- Issues belong to a released job. Milestones may remain site-wide or target one job.
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS project_job_id uuid REFERENCES public.project_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.site_updates
  ADD COLUMN IF NOT EXISTS project_job_id uuid REFERENCES public.project_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS issues_project_job_idx ON public.issues(project_job_id);
CREATE INDEX IF NOT EXISTS site_updates_project_job_idx ON public.site_updates(project_job_id);

-- Preserve historical issues. Only infer the job when the site has exactly one.
UPDATE public.issues i
SET project_job_id = j.id
FROM public.project_jobs j
WHERE i.project_job_id IS NULL
  AND j.site_id = i.site_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_jobs other_job
    WHERE other_job.site_id = j.site_id
      AND other_job.id <> j.id
  );
