-- Studio: creatives get display names and owners can delete unused ones
alter table public.creatives add column name text;

create policy "creatives owner delete" on public.creatives
  for delete using (user_id = auth.uid());

-- Backfill names for existing creatives from their storage filename
update public.creatives
  set name = coalesce(name, initcap(source::text) || ' creative')
  where name is null;
