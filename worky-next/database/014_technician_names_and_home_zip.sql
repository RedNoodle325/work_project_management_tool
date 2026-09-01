begin;

alter table public.technicians add column if not exists first_name text;
alter table public.technicians add column if not exists last_name text;
alter table public.technicians add column if not exists home_zip text;

update public.technicians
set
  first_name = coalesce(first_name, split_part(name, ' ', 1)),
  last_name = coalesce(last_name, case when position(' ' in name) > 0 then btrim(substr(name, position(' ' in name) + 1)) else '' end)
where first_name is null or last_name is null;

create index if not exists technicians_home_zip_idx on public.technicians(home_zip) where home_zip is not null;

commit;
