-- Assign each released job to a customer and representative while retaining
-- the many-jobs-to-one-site relationship.
BEGIN;

ALTER TABLE public.project_jobs
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_jobs_customer_idx ON public.project_jobs(customer_id);
CREATE INDEX IF NOT EXISTS project_jobs_representative_idx ON public.project_jobs(representative_id);

INSERT INTO public.representatives (name, code)
SELECT DISTINCT representative_code, representative_code
FROM public.project_jobs
WHERE representative_code IS NOT NULL AND btrim(representative_code) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.representatives r
    WHERE lower(r.code) = lower(project_jobs.representative_code)
       OR lower(r.name) = lower(project_jobs.representative_code)
  )
ON CONFLICT DO NOTHING;

UPDATE public.project_jobs j
SET representative_id = r.id
FROM public.representatives r
WHERE j.representative_id IS NULL
  AND (lower(r.code) = lower(j.representative_code) OR lower(r.name) = lower(j.representative_code));

UPDATE public.project_jobs j
SET customer_id = s.customer_id
FROM public.sites s
WHERE j.site_id = s.id AND j.customer_id IS DISTINCT FROM s.customer_id;

COMMIT;
