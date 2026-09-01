ALTER TABLE public.job_schedule ADD COLUMN IF NOT EXISTS work_order_number text;
UPDATE public.job_schedule SET status = 'closed' WHERE status = 'complete';

WITH numbered AS (
  SELECT id,
    'WO-' || to_char(created_at AT TIME ZONE 'America/New_York', 'YYYYMMDD') || '-' ||
    CASE lower(job_type) WHEN 'warranty' THEN 'WAR' WHEN 'billable service' THEN 'BSV'
      WHEN 'service' THEN 'BSV' WHEN 'billable startup' THEN 'BSU'
      WHEN 'commissioning' THEN 'BSU' ELSE 'OTH' END || '-' ||
    lpad(row_number() OVER (PARTITION BY (created_at AT TIME ZONE 'America/New_York')::date,
      CASE lower(job_type) WHEN 'warranty' THEN 'WAR' WHEN 'billable service' THEN 'BSV'
        WHEN 'service' THEN 'BSV' WHEN 'billable startup' THEN 'BSU'
        WHEN 'commissioning' THEN 'BSU' ELSE 'OTH' END ORDER BY created_at, id)::text, 3, '0') number
  FROM public.job_schedule WHERE work_order_number IS NULL
)
UPDATE public.job_schedule j SET work_order_number = numbered.number FROM numbered WHERE j.id = numbered.id;
CREATE UNIQUE INDEX IF NOT EXISTS job_schedule_work_order_number_uidx ON public.job_schedule(work_order_number);

CREATE TABLE IF NOT EXISTS public.job_schedule_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.job_schedule(id) ON DELETE CASCADE,
  line_number integer NOT NULL, start_date date NOT NULL, end_date date NOT NULL, techs_needed integer NOT NULL DEFAULT 1,
  scope text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, line_number), CHECK (end_date >= start_date), CHECK (techs_needed > 0)
);
CREATE TABLE IF NOT EXISTS public.job_schedule_line_techs (
  line_id uuid NOT NULL REFERENCES public.job_schedule_lines(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(line_id, technician_id)
);
CREATE INDEX IF NOT EXISTS job_schedule_lines_job_dates_idx ON public.job_schedule_lines(job_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS job_schedule_line_techs_tech_idx ON public.job_schedule_line_techs(technician_id);

INSERT INTO public.job_schedule_lines (job_id, line_number, start_date, end_date, techs_needed, scope, notes)
SELECT j.id, 1, coalesce(j.start_date, j.created_at::date), coalesce(j.end_date, j.start_date, j.created_at::date),
  j.techs_needed, j.scope, j.notes FROM public.job_schedule j
WHERE NOT EXISTS (SELECT 1 FROM public.job_schedule_lines l WHERE l.job_id = j.id)
  AND (j.start_date IS NOT NULL OR EXISTS (SELECT 1 FROM public.job_schedule_techs jt WHERE jt.job_id = j.id));
INSERT INTO public.job_schedule_line_techs (line_id, technician_id)
SELECT l.id, jt.technician_id FROM public.job_schedule_lines l JOIN public.job_schedule_techs jt ON jt.job_id = l.job_id
WHERE l.line_number = 1 ON CONFLICT DO NOTHING;
