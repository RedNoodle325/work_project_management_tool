import sql from './db'
import type { JobSchedule } from '@/types/ops'

export async function listJobSchedule(): Promise<JobSchedule[]> {
  const rows = await sql`
    SELECT j.*, s.name AS site_name, s.city AS site_city, s.state AS site_state,
      COALESCE((SELECT min(l.start_date) FROM public.job_schedule_lines l WHERE l.job_id = j.id), j.start_date) AS start_date,
      COALESCE((SELECT max(l.end_date) FROM public.job_schedule_lines l WHERE l.job_id = j.id), j.end_date) AS end_date,
      COALESCE((
        SELECT json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FROM public.job_schedule_lines l
        JOIN public.job_schedule_line_techs lt ON lt.line_id = l.id
        JOIN public.technicians t ON t.id = lt.technician_id
        WHERE l.job_id = j.id
      ), '[]') AS technicians,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', l.id, 'job_id', l.job_id, 'line_number', l.line_number,
          'start_date', l.start_date, 'end_date', l.end_date, 'techs_needed', l.techs_needed,
          'scope', l.scope, 'notes', l.notes, 'created_at', l.created_at, 'updated_at', l.updated_at,
          'technicians', COALESCE((
            SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
            FROM public.job_schedule_line_techs lt JOIN public.technicians t ON t.id = lt.technician_id
            WHERE lt.line_id = l.id
          ), '[]'::json)
        ) ORDER BY l.line_number)
        FROM public.job_schedule_lines l WHERE l.job_id = j.id
      ), '[]') AS assignment_lines
    FROM public.job_schedule j JOIN public.sites s ON s.id = j.site_id
    ORDER BY COALESCE((SELECT min(l.start_date) FROM public.job_schedule_lines l WHERE l.job_id = j.id), j.start_date) ASC NULLS LAST,
      j.created_at DESC
  `
  return rows as unknown as JobSchedule[]
}

export async function getJobSchedule(id: string) {
  return (await listJobSchedule()).find(job => job.id === id) ?? null
}
