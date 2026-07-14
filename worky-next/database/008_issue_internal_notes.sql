-- Private notes kept in the XNRGY issue tracker; never sent to CxAlloy.
begin;

alter table public.issues
  add column if not exists internal_notes text;

commit;
