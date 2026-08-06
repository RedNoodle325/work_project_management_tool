-- Shared quick links for SharePoint locations, documents, tools, and references.
begin;

create table if not exists public.resource_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  category text not null default 'general',
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists resource_links_touch_updated_at on public.resource_links;
create trigger resource_links_touch_updated_at before update on public.resource_links
for each row execute function public.touch_updated_at();

commit;
