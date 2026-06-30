-- Notes-first workspace and private site documents.
-- Safe, additive migration for the v2 operational schema.

begin;

alter table public.site_updates
  add column if not exists title text,
  add column if not exists update_type text not null default 'general',
  add column if not exists is_pinned boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_updates_update_type_check'
  ) then
    alter table public.site_updates add constraint site_updates_update_type_check
      check (update_type in ('general', 'status', 'service', 'parts', 'commercial', 'milestone'));
  end if;
end $$;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  update_id uuid references public.site_updates(id) on delete cascade,
  category text not null default 'other'
    check (category in ('po', 'quote', 'invoice', 'submittal', 'email', 'photo', 'report', 'other')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  description text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists attachments_site_created_idx
  on public.attachments(site_id, created_at desc);
create index if not exists attachments_update_idx
  on public.attachments(update_id) where update_id is not null;

-- Files remain private. The application issues short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('site-files', 'site-files', false, 52428800)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

commit;
