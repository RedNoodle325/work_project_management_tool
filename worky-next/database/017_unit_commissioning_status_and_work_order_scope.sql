ALTER TABLE public.units ADD COLUMN IF NOT EXISTS commissioning_status text NOT NULL DEFAULT 'not_required'
  CHECK (commissioning_status IN ('not_required', 'pre_startup_testing', 'ready_for_startup', 'startup',
    'ready_for_commissioning', 'commissioning', 'commissioned', 'recommissioning_required', 'recommissioning'));

UPDATE public.units SET commissioning_status = 'commissioned'
WHERE build_stage = 'commissioned' AND commissioning_status = 'not_required';

ALTER TABLE public.job_schedule ADD COLUMN IF NOT EXISTS unit_scope_mode text NOT NULL DEFAULT 'site_wide'
  CHECK (unit_scope_mode IN ('site_wide', 'selected_units', 'all_units', 'all_fans'));

CREATE TABLE IF NOT EXISTS public.job_schedule_units (
  job_id uuid NOT NULL REFERENCES public.job_schedule(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (job_id, unit_id)
);
CREATE INDEX IF NOT EXISTS job_schedule_units_unit_idx ON public.job_schedule_units(unit_id);
CREATE INDEX IF NOT EXISTS units_commissioning_status_idx ON public.units(commissioning_status);
