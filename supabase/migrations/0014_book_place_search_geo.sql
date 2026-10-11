-- IDA-26: place search could not answer geographic questions.
--
-- Three symptoms, one root cause. book_place_search resolved a place by exact
-- text on screens.city / screens.neighborhood, and took BOTH the screen count
-- and the map bounds from only the rows carrying that literal label.
--
--   1. A qualifier killed the query. "Williamsburg" matched; "Williamsburg
--      New York", "Williamsburg, NY", "Soho NYC" and "Brooklyn NY" all
--      returned null, because the whole string was treated as one needle.
--   2. Counts were label counts, not area counts. "Brooklyn" reported 10 --
--      the 10 rows literally labelled Brooklyn -- while ~934 available
--      screens stand inside the borough under other labels (Greenpoint,
--      Bedford-Stuyvesant, Clinton Hill ...).
--   3. The headline contradicted the map. The count was label-derived, the
--      map viewport is geographic: "10 screens in Brooklyn" over a map
--      drawing 90. Bounds came from those same 10 rows, so the map also flew
--      to a 1.9km box in Crown Heights instead of the borough.
--
-- Fix, in two parts.
--
-- place_areas: a curated gazetteer of areas advertisers actually search for,
-- with authoritative bounds held independently of how any individual screen
-- is labelled. This is the only way to answer "Williamsburg, NY": no screen
-- there carries that label, yet screens stand inside its ZIPs. Seeded below
-- from postal codes. Extend by inserting rows -- no code change. ("Wicker
-- Park Chicago" is absent from the data for the same reason and becomes
-- searchable the moment a row is added.)
--
-- book_place_search: resolves a query to an AREA, then counts inside it.
--   * Tokenizes "<place> <qualifier>" at every word boundary (comma
--     normalized to space) and resolves the qualifier against served city
--     names plus common shorthands (nyc, sf, dc, philly, vegas ...). A
--     qualifier naming no served city constrains everything away, so
--     "Williamsburg Virginia" stays empty rather than silently landing on
--     Orlando's Williamsburg.
--   * Counts n as available screens within the hit's bounds, never the rows
--     sharing its label, so headline and map agree by construction.
--
-- Verified against production data before shipping:
--   Williamsburg New York  null -> Williamsburg, New York   n=75
--   Williamsburg, NY       null -> Williamsburg, New York   n=75
--   Brooklyn               10   -> Brooklyn, New York       n=934
--   Brooklyn NY            null -> Brooklyn, New York       n=934
--   Soho NYC               null -> SoHo, New York           n=23
--   Mission SF             null -> Mission, San Francisco   n=71
--   Manhattan              7    -> Manhattan, New York      n=1650
--   Chicago                1627 -> Chicago (city)           n=1627  (no regression)
--   Austin                 745  -> Austin (city)            n=745   (no regression)
--   Williamsburg Virginia  null -> null  (correct: no Virginia inventory)
--
-- Response shape is unchanged (kind/label/city/n/bounds + ambiguous/
-- alternatives), so a client deployed before this migration keeps working;
-- 'borough' is reported as kind 'neighborhood' for that reason. The web and
-- native apps both read this RPC, so neither needs a rebuild.
--
-- Rollback: re-run 0013_book_place_search_exact_first.sql. The function is
-- read-only, so nothing it does can leave bad data behind.

create table if not exists public.place_areas (
  id bigint generated always as identity primary key,
  name text not null,
  kind text not null check (kind in ('borough','neighborhood','district')),
  city text not null,
  min_lat double precision not null,
  min_lng double precision not null,
  max_lat double precision not null,
  max_lng double precision not null,
  created_at timestamptz not null default now(),
  unique (name, city)
);

comment on table public.place_areas is
  'Curated searchable areas with authoritative bounds. Consulted by '
  'book_place_search ahead of screen labels, so a well-known area resolves '
  'even when no screen carries its name. Add rows to extend coverage.';

alter table public.place_areas enable row level security;
drop policy if exists place_areas_read on public.place_areas;
create policy place_areas_read on public.place_areas for select using (true);
grant select on public.place_areas to anon, authenticated;

-- Seed: the five NYC boroughs and Williamsburg, bounded by the screens
-- standing in their postal codes. Derived from data rather than typed in, so
-- bounds track inventory. Re-runnable.
insert into public.place_areas (name, kind, city, min_lat, min_lng, max_lat, max_lng)
select v.name, v.kind, 'New York', min(s.lat), min(s.lng), max(s.lat), max(s.lng)
  from (values
    ('Brooklyn','borough',array['112']), ('Manhattan','borough',array['100','101','102']),
    ('Queens','borough',array['111','113','114','116']), ('Bronx','borough',array['104']),
    ('Staten Island','borough',array['103']),
    ('Williamsburg','neighborhood',array['11211','11249'])
  ) v(name, kind, prefixes)
  join public.screens s on s.is_available and s.city='New York'
   and exists (select 1 from unnest(v.prefixes) p where s.postal_code like p||'%')
 group by v.name, v.kind
having count(*) > 0
    on conflict (name, city) do nothing;

create or replace function public.book_place_search(q text)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  raw as (
    select nullif(regexp_replace(regexp_replace(trim(q),'\s*,\s*',' ','g'),'\s+',' ','g'),'') as t
  ),
  ok as (select t from raw where length(t) >= 2),
  -- Served cities plus shorthands advertisers type. Read ONLY in the
  -- qualifier position, so 'manhattan' meaning New York here does not stop
  -- Manhattan resolving as a borough in the place position.
  city_alias as (
    select distinct lower(city) as k, city as cityname from screens where is_available
    union select * from (values
      ('nyc','New York'),('ny','New York'),('new york city','New York'),
      ('manhattan','New York'),('brooklyn','New York'),('queens','New York'),
      ('la','Los Angeles'),('sf','San Francisco'),('san fran','San Francisco'),
      ('bay area','San Francisco'),('dc','Washington'),('washington dc','Washington'),
      ('philly','Philadelphia'),('vegas','Las Vegas'),('nola','New Orleans'),
      ('atl','Atlanta'),('chi','Chicago'),('slc','Salt Lake City'),
      ('phx','Phoenix'),('nash','Nashville')
    ) v(k,cityname)
  ),
  -- Every "<place> <qualifier>" reading, plus the whole string unqualified.
  parts as (select t, string_to_array(lower(t),' ') as w from ok),
  candidate as (
    select lower(t) as place, null::text as city_filter, 0 as split_cost from ok
    union all
    select array_to_string(p.w[1:i],' '), a.cityname, 1
      from parts p cross join generate_series(1, array_length(p.w,1)-1) as i
      join city_alias a on a.k = array_to_string(p.w[i+1:array_length(p.w,1)],' ')
  ),
  needle as (
    select place, city_filter, split_cost,
           replace(replace(replace(place,'\','\\'),'%','\%'),'_','\_') as esc
      from candidate
  ),
  hits as (
    -- Curated areas first: authoritative bounds, independent of labels.
    select case when p.kind='borough' then 'neighborhood' else p.kind end as kind,
           p.name as label, p.city, p.min_lat, p.min_lng, p.max_lat, p.max_lng,
           case when lower(p.name)=n.place then 1 else 3 end as pri, n.split_cost
      from place_areas p join needle n on p.name ilike n.esc or p.name ilike n.esc||'%'
     where n.city_filter is null or p.city = n.city_filter
    union all
    select 'city', s.city, s.city, min(s.lat),min(s.lng),max(s.lat),max(s.lng),
           case when s.city ilike n.esc then 1 when s.city ilike n.esc||'%' then 3 else 4 end,
           n.split_cost
      from screens s join needle n on s.city ilike '%'||n.esc||'%'
     where s.is_available and n.city_filter is null
     group by s.city, n.esc, n.split_cost
    union all
    select 'neighborhood', s.neighborhood, s.city,
           min(s.lat),min(s.lng),max(s.lat),max(s.lng),
           case when s.neighborhood ilike n.esc then 2
                when s.neighborhood ilike n.esc||'%' then 3 else 4 end,
           n.split_cost
      from screens s join needle n on s.neighborhood ilike '%'||n.esc||'%'
     where s.is_available and s.neighborhood is not null
       and (n.city_filter is null or s.city = n.city_filter)
     group by s.neighborhood, s.city, n.esc, n.split_cost
  ),
  -- One row per place. An unqualified reading outranks a split one, so
  -- "Chicago" stays the city rather than a "<something> Chicago" reading.
  deduped as (
    select distinct on (kind,label,city)
           kind,label,city,min_lat,min_lng,max_lat,max_lng,pri,split_cost
      from hits order by kind,label,city,pri,split_cost
  ),
  ranked as (
    select d.*, row_number() over (order by d.pri,d.split_cost,d.area_n desc,d.label,d.city) as rn
      from (
        select d.*,
               -- The number the map will draw: available screens inside the
               -- bounds, not rows sharing the label. && uses the GiST index.
               (select count(*) from screens s
                 where s.is_available
                   and (s.geog::geometry) && st_makeenvelope(d.min_lng,d.min_lat,d.max_lng,d.max_lat,4326)
               )::int as area_n
          from deduped d
      ) d
  ),
  best as (select * from ranked where rn = 1),
  alt as (select * from ranked where rn between 2 and 9)
  select (
    select jsonb_build_object(
      'kind', b.kind, 'label', b.label, 'city', b.city, 'n', b.area_n,
      'min_lat', b.min_lat, 'min_lng', b.min_lng,
      'max_lat', b.max_lat, 'max_lng', b.max_lng,
      'ambiguous',
        case
          when (select count(*) from ranked where pri=1) > 1 then true
          when (select count(*) from ranked where pri=1) = 1 then false
          when (select count(*) from ranked where pri=2) > 1 then true
          when (select count(*) from ranked where pri=2) = 1 then false
          else (select count(*) from ranked) > 1
        end,
      'alternatives',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'kind', a.kind, 'label', a.label, 'city', a.city, 'n', a.area_n,
            'min_lat', a.min_lat, 'min_lng', a.min_lng,
            'max_lat', a.max_lat, 'max_lng', a.max_lng) order by a.rn)
          from alt a), '[]'::jsonb)
    ) from best b
  );
$$;

grant execute on function public.book_place_search(text) to anon, authenticated;
