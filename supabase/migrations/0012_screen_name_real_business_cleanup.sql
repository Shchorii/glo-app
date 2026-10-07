-- IDA-21: demo screen names that collide with real businesses, and neighborhood
-- labels that are administrative areas rather than places people say.
--
-- Rewrites the offending rows, then rejects the same patterns on later writes.
-- Idempotent: every UPDATE still requires the current name or neighborhood to
-- violate the guard, so a second run changes 0 rows.
--
-- Does not delete. Does not touch source, prices, coordinates, availability,
-- campaigns, campaign_screens, payments, or public.screens_backup_20260917.
-- public.screens_rebuild_stage gets the same renames when it is present, so a
-- later copy of that table cannot put the old names back.

-- ---------------------------------------------------------------------------
-- Denylist: exact base name, case-insensitive, after stripping a trailing " #N".
-- Famous "{place} {noun}" businesses. Generic inventory nouns (Diner, Lounge,
-- Bakery, Ice Cream Parlor, Seafood Shack) are not listed: those rows are
-- ordinary demo names and must stay valid.
-- ---------------------------------------------------------------------------

create table if not exists public.screen_name_denylist (
  base_name text primary key,
  constraint screen_name_denylist_canonical check (
    base_name = btrim(base_name)
    and base_name <> ''
    and base_name !~ '\s+#[0-9]+\s*$'
  )
);

comment on table public.screen_name_denylist is
  'Screen base names that collide with a real business. Match is case-insensitive and ignores a trailing " #N".';

create unique index if not exists screen_name_denylist_lower_idx
  on public.screen_name_denylist (lower(base_name));

insert into public.screen_name_denylist (base_name) values
  ('Union Square Cafe'),
  ('Essex Market'),
  ('Essex Street Market'),
  ('Melrose Market'),
  ('Chelsea Market'),
  ('Pike Place Market'),
  ('Reading Terminal Market'),
  ('Grand Central Market'),
  ('Union Market'),
  ('Eastern Market'),
  ('Ferry Building Market'),
  ('Ferry Building Marketplace'),
  ('Findlay Market'),
  ('Lexington Market'),
  ('West Side Market'),
  ('French Market'),
  ('Soulard Market'),
  ('Quincy Market'),
  ('St. Lawrence Market'),
  ('Milwaukee Public Market'),
  ('Boston Public Market'),
  ('Ponce City Market'),
  ('Oxbow Public Market'),
  ('Liberty Public Market'),
  ('Granville Island Public Market'),
  ('DeKalb Market'),
  ('DeKalb Market Hall'),
  ('Time Out Market'),
  ('Borough Market'),
  ('Jean-Talon Market'),
  ('Atwater Market'),
  ('Dallas Farmers Market')
on conflict (base_name) do nothing;

alter table public.screen_name_denylist enable row level security;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'screen_name_denylist'
       and policyname = 'screen_name_denylist public read'
  ) then
    create policy "screen_name_denylist public read"
      on public.screen_name_denylist
      for select
      using (true);
  end if;
end
$policy$;

-- Base name: drop one trailing " #N" suffix. "Union Square Cafe #2" → "Union Square Cafe".
create or replace function public.screen_base_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+#[0-9]+\s*$', '')), '');
$fn$;

create or replace function public.screen_name_is_denied(p_name text)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (
    select 1
      from public.screen_name_denylist d
     where lower(d.base_name) = lower(public.screen_base_name(p_name))
  );
$fn$;

-- Administrative area → a recognizable neighborhood.
-- The span is the admin label itself (a neighborhood value, or the leading
-- label of a "{label} {noun}" screen name). Patterns are exact:
--   Manhattan Community Board N
--   "<place> Neighborhood Council District"
--   Pasadena Council District N
--   "<place> PID"
--   "Ward N" only when the city is Washington (not Washington Heights)
--   "Peterson Park (39th Ward)"
-- Names that merely contain Ward / District / Tract / County are not spans.
-- Fourth Ward, Old Fourth Ward, Lower Ninth Ward, Financial District,
-- Harmon Tract, and County Vista do not match.
create or replace function public.screen_admin_parts(
  p_text text,
  p_city text,
  out span text,
  out replacement text
)
language plpgsql
immutable
set search_path = public
as $fn$
declare
  base text := public.screen_base_name(p_text);
  n int;
  v_dc boolean := coalesce(p_city, '') ~* '^washington($|[^[:alpha:]])'
    and coalesce(p_city, '') !~* '^washington heights($|[^[:alpha:]])';
begin
  span := null;
  replacement := null;
  if base is null then
    return;
  end if;

  span := substring(base from '(?i)^(Peterson Park \(39th Ward\))($| )');
  if span is not null then
    replacement := 'Peterson Park';
  end if;

  if span is null then
    span := substring(base from '(?i)^(Manhattan Community Board [0-9]+)($| )');
    if span is not null then
      n := substring(span from '[0-9]+')::int;
      replacement := case n
        when 1 then 'Financial District'
        when 2 then 'Greenwich Village'
        when 3 then 'Lower East Side'
        when 4 then 'Chelsea'
        when 5 then 'Midtown'
        when 6 then 'Murray Hill'
        when 7 then 'Upper West Side'
        when 8 then 'Upper East Side'
        when 9 then 'Morningside Heights'
        when 10 then 'Harlem'
        when 11 then 'East Harlem'
        when 12 then 'Washington Heights'
        else 'Manhattan'
      end;
    end if;
  end if;

  if span is null then
    span := substring(base from '(?i)^(Pasadena Council District [0-9]+)($| )');
    if span is not null then
      n := substring(span from '[0-9]+')::int;
      replacement := case n
        when 1 then 'Northwest Pasadena'
        when 6 then 'West Pasadena'
        else 'Pasadena'
      end;
    end if;
  end if;

  if span is null and v_dc then
    span := substring(base from '(?i)^(Ward [0-9]+)($| )');
    if span is not null then
      n := substring(span from '[0-9]+')::int;
      replacement := case n
        when 1 then 'Adams Morgan'
        when 2 then 'Dupont Circle'
        when 3 then 'Cleveland Park'
        when 4 then 'Petworth'
        when 5 then 'Brookland'
        when 6 then 'Capitol Hill'
        when 7 then 'Deanwood'
        when 8 then 'Anacostia'
        else 'Washington'
      end;
    end if;
  end if;

  if span is null then
    span := substring(base from '(?i)^(.+ Neighborhood Council District)($| )');
    if span is not null then
      replacement := regexp_replace(span, '(?i)\s+Neighborhood Council District$', '');
    end if;
  end if;

  if span is null then
    span := substring(base from '(?i)^(.+ PID)($| )');
    if span is not null then
      replacement := regexp_replace(span, '(?i)\s+PID$', '');
    end if;
  end if;

  if span is not null then
    replacement := nullif(btrim(replacement), '');
    if replacement is null then
      raise exception 'no neighborhood replacement for admin label "%"', span;
    end if;
  end if;
end;
$fn$;

create or replace function public.screen_name_rejection(p_name text, p_neighborhood text, p_city text)
returns text
language plpgsql
stable
set search_path = public
as $fn$
declare
  base text := public.screen_base_name(p_name);
  hood_span text;
  name_span text;
begin
  if public.screen_name_is_denied(p_name) then
    return format('Screen name "%s" matches a real business and can''t be used.', base);
  end if;

  select span into hood_span from public.screen_admin_parts(p_neighborhood, p_city);
  if hood_span is not null then
    return format('Screen neighborhood "%s" is an administrative area, not a place name.', btrim(p_neighborhood));
  end if;

  select span into name_span from public.screen_admin_parts(p_name, p_city);
  if name_span is not null then
    return format('Screen name "%s" uses an administrative area, not a place name.', btrim(p_name));
  end if;

  return null;
end;
$fn$;

-- Swap the trailing venue noun on a denylisted base name.
-- Cafe → Espresso Bar, Market → Grocery. Not used by the guard.
create or replace function public.screen_safe_base(p_base text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select case
    when p_base ~* ' Marketplace$' then regexp_replace(p_base, '(?i) Marketplace$', ' Grocery')
    when p_base ~* ' Cafe$' then regexp_replace(p_base, '(?i) Cafe$', ' Espresso Bar')
    when p_base ~* ' Market$' then regexp_replace(p_base, '(?i) Market$', ' Grocery')
    else p_base || ' Spot'
  end;
$fn$;

-- Rewrites one inventory table. Dropped at the end of this migration.
create or replace function public.apply_screen_name_cleanup(p_table regclass)
returns integer
language plpgsql
set search_path = pg_temp, public
as $fn$
declare
  r record;
  v_name text;
  v_base text;
  v_suffix text;
  old_hood text;
  hood_span text;
  hood_repl text;
  store_hood text;
  new_base text;
  name_span text;
  name_repl text;
  candidate text;
  n int;
  updated int;
  v_dup text;
begin
  if to_regclass('_screen_name_plan') is not null then
    drop table _screen_name_plan;
  end if;
  if to_regclass('_screen_name_taken') is not null then
    drop table _screen_name_taken;
  end if;

  create temp table _screen_name_plan (
    id uuid primary key,
    city text not null,
    old_name text not null,
    old_neighborhood text,
    new_neighborhood text,
    base_name text not null,
    suffix text,
    preferred_name text not null,
    final_name text
  ) on commit drop;

  create temp table _screen_name_taken (
    city text not null,
    name text not null,
    primary key (city, name)
  ) on commit drop;

  v_dup := null;
  execute format(
    'select name || '' | '' || city from %s group by name, city having count(*) > 1 limit 1',
    p_table
  ) into v_dup;
  if v_dup is not null then
    raise exception 'duplicate (name, city) already present in %: %', p_table, v_dup;
  end if;

  for r in execute format(
    'select id, name, neighborhood, city from %s s
      where public.screen_name_rejection(s.name, s.neighborhood, s.city) is not null
      order by s.city, s.name, s.id',
    p_table
  )
  loop
    if r.city is null then
      raise exception 'screen % has no city; cannot keep (name, city) unique', r.id;
    end if;

    v_name := btrim(r.name);
    v_suffix := substring(v_name from '\s+#[0-9]+\s*$');
    v_base := public.screen_base_name(v_name);
    old_hood := btrim(r.neighborhood);
    store_hood := r.neighborhood;

    select span, replacement into hood_span, hood_repl
      from public.screen_admin_parts(r.neighborhood, r.city);
    if hood_span is not null then
      if old_hood is not null and btrim(hood_span) = old_hood then
        store_hood := btrim(hood_repl);
      else
        store_hood := btrim(
          btrim(hood_repl) || substring(coalesce(old_hood, '') from char_length(btrim(hood_span)) + 1)
        );
      end if;
    end if;

    if old_hood is not null and old_hood <> '' and (
      lower(v_base) = lower(old_hood)
      or left(lower(v_base), char_length(old_hood) + 1) = lower(old_hood) || ' '
    ) then
      if lower(v_base) = lower(old_hood) then
        new_base := btrim(store_hood);
      else
        new_base := btrim(store_hood) || substring(v_base from char_length(old_hood) + 1);
      end if;
    else
      select span, replacement into name_span, name_repl
        from public.screen_admin_parts(v_base, r.city);
      if name_span is not null then
        new_base := btrim(name_repl) || substring(v_base from char_length(name_span) + 1);
      else
        new_base := v_base;
      end if;
    end if;

    new_base := btrim(new_base);
    if new_base is null or new_base = '' then
      raise exception 'screen % rewrote to an empty name', r.id;
    end if;

    if public.screen_name_is_denied(new_base) then
      new_base := btrim(public.screen_safe_base(new_base));
    end if;

    if public.screen_name_is_denied(new_base)
       or (select span from public.screen_admin_parts(new_base, r.city)) is not null
       or (store_hood is not null and (select span from public.screen_admin_parts(store_hood, r.city)) is not null)
    then
      new_base := btrim(new_base || ' Spot');
    end if;

    if public.screen_name_is_denied(new_base)
       or (select span from public.screen_admin_parts(new_base, r.city)) is not null
       or (store_hood is not null and (select span from public.screen_admin_parts(store_hood, r.city)) is not null)
    then
      raise exception 'screen % (%) still violates the name guard after rewrite', r.id, new_base;
    end if;

    if new_base = v_base and store_hood is not distinct from r.neighborhood then
      raise exception 'screen % (%) was flagged but the rewrite did not change it', r.id, r.name;
    end if;

    insert into _screen_name_plan (
      id, city, old_name, old_neighborhood, new_neighborhood,
      base_name, suffix, preferred_name
    ) values (
      r.id, r.city, r.name, r.neighborhood, store_hood,
      new_base, v_suffix, new_base || coalesce(v_suffix, '')
    );
  end loop;

  execute format(
    'insert into _screen_name_taken (city, name)
     select s.city, s.name from %s s
     where not exists (select 1 from _screen_name_plan p where p.id = s.id)',
    p_table
  );

  for r in
    select * from _screen_name_plan
    order by city, base_name, suffix nulls first, id
  loop
    candidate := r.preferred_name;
    if exists (select 1 from _screen_name_taken t where t.city = r.city and t.name = candidate) then
      if not exists (select 1 from _screen_name_taken t where t.city = r.city and t.name = r.base_name) then
        candidate := r.base_name;
      else
        n := 1;
        loop
          candidate := r.base_name || ' #' || n;
          exit when not exists (
            select 1 from _screen_name_taken t where t.city = r.city and t.name = candidate
          );
          n := n + 1;
          if n > 100000 then
            raise exception 'could not allocate a unique name for screen % in %', r.id, r.city;
          end if;
        end loop;
      end if;
    end if;

    insert into _screen_name_taken (city, name) values (r.city, candidate);
    update _screen_name_plan set final_name = candidate where id = r.id;
  end loop;

  if exists (select 1 from _screen_name_plan where final_name is null or btrim(final_name) = '') then
    raise exception 'screen name cleanup on % left a blank name', p_table;
  end if;

  execute format($upd$
    update %s as s
       set name = p.final_name,
           neighborhood = p.new_neighborhood
      from _screen_name_plan p
     where s.id = p.id
       and s.name = p.old_name
       and s.neighborhood is not distinct from p.old_neighborhood
       and s.city is not distinct from p.city
       and public.screen_name_rejection(s.name, s.neighborhood, s.city) is not null
  $upd$, p_table);

  get diagnostics updated = row_count;

  if updated <> (select count(*) from _screen_name_plan) then
    raise exception 'screen name cleanup on % updated % of % planned rows',
      p_table, updated, (select count(*) from _screen_name_plan);
  end if;

  execute format(
    'select count(*)::int from (select 1 from %s group by name, city having count(*) > 1) d',
    p_table
  ) into n;
  if n <> 0 then
    raise exception '% has % duplicate (name, city) pair(s) after cleanup', p_table, n;
  end if;

  execute format(
    'select count(*)::int from %s s where public.screen_name_rejection(s.name, s.neighborhood, s.city) is not null',
    p_table
  ) into n;
  if n <> 0 then
    raise exception '% still has % screen-name violation(s) after cleanup', p_table, n;
  end if;

  raise notice 'screen name cleanup on % updated % row(s)', p_table, updated;
  return updated;
end;
$fn$;

do $apply$
declare
  stage_cols int;
begin
  perform public.apply_screen_name_cleanup('public.screens'::regclass);

  if to_regclass('public.screens_rebuild_stage') is null then
    raise notice 'public.screens_rebuild_stage is absent; no staged names to rewrite';
  else
    select count(*) into stage_cols
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'screens_rebuild_stage'
       and column_name in ('id', 'name', 'neighborhood', 'city');
    if stage_cols <> 4 then
      raise exception 'public.screens_rebuild_stage is missing id, name, neighborhood, or city';
    end if;
    perform public.apply_screen_name_cleanup('public.screens_rebuild_stage'::regclass);
  end if;
end
$apply$;

-- Reject a denylisted base name or an admin-area label. Installed after the
-- rewrites so the existing inventory already satisfies it.
create or replace function public.guard_screen_name()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  reason text;
begin
  reason := public.screen_name_rejection(new.name, new.neighborhood, new.city);
  if reason is not null then
    raise exception '%', reason;
  end if;
  return new;
end;
$fn$;

drop trigger if exists screens_guard_name on public.screens;
create trigger screens_guard_name
  before insert or update of name, neighborhood on public.screens
  for each row execute procedure public.guard_screen_name();

create or replace function public.screen_name_violations(p_limit integer default 20)
returns table (id uuid, name text, neighborhood text, city text, reason text)
language sql
stable
set search_path = public
as $fn$
  select id, name, neighborhood, city, reason
    from (
      select s.id, s.name, s.neighborhood, s.city,
             public.screen_name_rejection(s.name, s.neighborhood, s.city) as reason
        from public.screens s
    ) v
   where reason is not null
   order by city, name, id
   limit greatest(coalesce(p_limit, 20), 0);
$fn$;

create or replace function public.screen_name_violation_count()
returns integer
language sql
stable
set search_path = public
as $fn$
  select count(*)::integer
    from public.screens s
   where public.screen_name_rejection(s.name, s.neighborhood, s.city) is not null;
$fn$;

revoke insert, update, delete, truncate on public.screen_name_denylist from anon, authenticated;
grant select on public.screen_name_denylist to anon, authenticated;

grant execute on function public.screen_base_name(text) to anon, authenticated;
grant execute on function public.screen_name_is_denied(text) to anon, authenticated;
grant execute on function public.screen_admin_parts(text, text) to anon, authenticated;
grant execute on function public.screen_name_rejection(text, text, text) to anon, authenticated;
grant execute on function public.screen_name_violations(integer) to anon, authenticated;
grant execute on function public.screen_name_violation_count() to anon, authenticated;
grant execute on function public.guard_screen_name() to anon, authenticated;

drop function if exists public.apply_screen_name_cleanup(regclass);
drop function if exists public.screen_safe_base(text);
