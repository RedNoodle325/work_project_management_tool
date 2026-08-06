-- Run once after the existing operational-schema migrations.
-- Preserves the current access model: the oldest account is the owner and
-- existing additional accounts remain scheduler-only until the owner changes them.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS access_role text;

UPDATE public.users
SET access_role = CASE
  WHEN id = (SELECT id FROM public.users ORDER BY created_at ASC, id ASC LIMIT 1) THEN 'owner'
  ELSE 'scheduler'
END
WHERE access_role IS NULL;

ALTER TABLE public.users
  ALTER COLUMN access_role SET DEFAULT 'viewer';

ALTER TABLE public.users
  ALTER COLUMN access_role SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_access_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_access_role_check
  CHECK (access_role IN ('owner', 'admin', 'project_manager', 'technician', 'scheduler', 'viewer'));
