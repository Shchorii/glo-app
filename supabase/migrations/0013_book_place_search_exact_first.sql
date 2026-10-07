-- IDA-22: "Chicago" was landing on Chicago Ridge.
--
-- The previous ranking preferred any neighborhood prefix over a city prefix,
-- then broke ties by screen count, and returned a single row. Chicago Ridge
-- (11 screens) beat the city Chicago (1,627).
--
-- Rank, one row per place:
--   1. exact city          (case-insensitive)
--   2. exact neighborhood
--   3. prefix of a city or a neighborhood, larger available-screen count first
--   4. contains matches last
-- Ties within a tier: higher n, then label, then city.
-- Still requires 2 characters. The needle still escapes \, % and _.
--
-- Response stays a single jsonb object so a client deployed before this
-- migration still reads kind/label/city/n/bounds and jumps to the best hit.
-- Added keys (ignored by that client):
--   alternatives  the next 8 candidates, same fields, in rank order
--   ambiguous     true when the caller should ask instead of jumping:
--                 more than one exact city, or no exact city and more than
--                 one exact neighborhood, or no exact match and more than
--                 one candidate. One exact city is enough to jump, even when
--                 a neighborhood shares the name (Austin).

create or replace function public.book_place_search(q text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') as t
  ),
  hits as (
    select 'city'::text as kind,
           s.city as label,
           s.city as city,
           count(*)::int as n,
           min(s.lat) as min_lat,
           min(s.lng) as min_lng,
           max(s.lat) as max_lat,
           max(s.lng) as max_lng,
           case
             when s.city ilike needle.t then 1
             when s.city ilike needle.t || '%' then 3
             else 4
           end as pri
      from screens s
      cross join needle
     where s.is_available
       and length(trim(q)) >= 2
       and s.city ilike '%' || needle.t || '%'
     group by s.city, needle.t
    union all
    select 'neighborhood',
           s.neighborhood,
           s.city,
           count(*)::int,
           min(s.lat),
           min(s.lng),
           max(s.lat),
           max(s.lng),
           case
             when s.neighborhood ilike needle.t then 2
             when s.neighborhood ilike needle.t || '%' then 3
             else 4
           end
      from screens s
      cross join needle
     where s.is_available
       and s.neighborhood is not null
       and length(trim(q)) >= 2
       and s.neighborhood ilike '%' || needle.t || '%'
     group by s.neighborhood, s.city, needle.t
  ),
  ranked as (
    select kind, label, city, n, min_lat, min_lng, max_lat, max_lng, pri,
           row_number() over (order by pri, n desc, label, city) as rn
      from hits
  ),
  best as (
    select * from ranked where rn = 1
  ),
  alt as (
    select * from ranked where rn between 2 and 9
  )
  select (
    select jsonb_build_object(
      'kind', b.kind,
      'label', b.label,
      'city', b.city,
      'n', b.n,
      'min_lat', b.min_lat,
      'min_lng', b.min_lng,
      'max_lat', b.max_lat,
      'max_lng', b.max_lng,
      'ambiguous',
        case
          when (select count(*) from ranked where pri = 1) > 1 then true
          when (select count(*) from ranked where pri = 1) = 1 then false
          when (select count(*) from ranked where pri = 2) > 1 then true
          when (select count(*) from ranked where pri = 2) = 1 then false
          else (select count(*) from ranked) > 1
        end,
      'alternatives',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'kind', a.kind,
                'label', a.label,
                'city', a.city,
                'n', a.n,
                'min_lat', a.min_lat,
                'min_lng', a.min_lng,
                'max_lat', a.max_lat,
                'max_lng', a.max_lng
              )
              order by a.rn
            )
            from alt a
          ),
          '[]'::jsonb
        )
    )
    from best b
  );
$$;

grant execute on function public.book_place_search(text) to anon, authenticated;
