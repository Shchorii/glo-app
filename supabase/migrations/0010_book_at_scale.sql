-- IDA-13 / IDA-14: the /book screen picker runs against the database, not a
-- browser-side copy of the inventory. Every function is bounded: the browser
-- never receives more than ~500 map items or 120 list rows per call.

-- Planar bbox index. Geography envelopes misbehave once a viewport spans a
-- continent, so viewport queries use geometry.
create index if not exists screens_geom_gix on public.screens using gist ((geog::geometry));

-- Map viewport, pixel-aware: screens closer than ~48px on screen merge into a
-- bubble; lone screens render as dots. Dots can never stack into a blob.
create or replace function public.book_map(
  min_lat double precision, min_lng double precision,
  max_lat double precision, max_lng double precision,
  zoom integer, p_city text default null, p_venue text default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  box geometry := st_makeenvelope(
    greatest(min_lng, -180), greatest(min_lat, -85),
    least(max_lng, 180), least(max_lat, 85), 4326);
  z integer := greatest(least(zoom, 20), 0);
  -- 48px expressed in degrees at this zoom (256px tiles); latitude cells shrink with cos(lat)
  cell_lng double precision := 48.0 * 360.0 / (256.0 * power(2, z));
  cell_lat double precision := cell_lng * greatest(cos(radians((greatest(min_lat, -85) + least(max_lat, 85)) / 2)), 0.05);
  v_total integer;
  v_live boolean;
begin
  select count(*)::int, coalesce(bool_or(s.source = 'live'), false)
    into v_total, v_live
    from screens s
   where s.geog::geometry && box and s.is_available
     and (p_city is null or s.city = p_city)
     and (p_venue is null or s.venue_type = p_venue);

  -- Street level: every screen individually (capped), cheapest first.
  if z >= 17 then
    return jsonb_build_object(
      'mode', 'mixed', 'total', v_total, 'live', v_live, 'truncated', v_total > 500,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('kind', 'screen', 'screen', to_jsonb(r))) from (
          select s.id, s.name, s.venue_type, s.city, s.neighborhood, s.lat, s.lng,
                 s.daily_price_usd::float8 as daily_price_usd, s.max_duration_s, s.source
            from screens s
           where s.geog::geometry && box and s.is_available
             and (p_city is null or s.city = p_city)
             and (p_venue is null or s.venue_type = p_venue)
           order by s.daily_price_usd, s.id
           limit 500
        ) r), '[]'::jsonb));
  end if;

  return jsonb_build_object(
    'mode', 'mixed', 'total', v_total, 'live', v_live, 'truncated', false,
    'items', coalesce((
      select jsonb_agg(
               case when c.n = 1
                 then jsonb_build_object('kind', 'screen', 'screen', jsonb_build_object(
                        'id', s.id, 'name', s.name, 'venue_type', s.venue_type, 'city', s.city,
                        'neighborhood', s.neighborhood, 'lat', s.lat, 'lng', s.lng,
                        'daily_price_usd', s.daily_price_usd::float8, 'max_duration_s', s.max_duration_s,
                        'source', s.source))
                 else jsonb_build_object('kind', 'cluster', 'n', c.n, 'lat', c.lat, 'lng', c.lng,
                        'min_price', c.min_price, 'min_lat', c.min_lat, 'min_lng', c.min_lng,
                        'max_lat', c.max_lat, 'max_lng', c.max_lng)
               end)
        from (
          select count(*)::int as n, avg(s.lat) as lat, avg(s.lng) as lng,
                 min(s.daily_price_usd)::float8 as min_price,
                 min(s.lat) as min_lat, min(s.lng) as min_lng,
                 max(s.lat) as max_lat, max(s.lng) as max_lng,
                 min(s.id::text) as one_id
            from screens s
           where s.geog::geometry && box and s.is_available
             and (p_city is null or s.city = p_city)
             and (p_venue is null or s.venue_type = p_venue)
           group by floor(s.lat / cell_lat), floor(s.lng / cell_lng)
        ) c
        left join screens s on c.n = 1 and s.id = c.one_id::uuid
    ), '[]'::jsonb));
end $$;

-- Radius / Area selection. Returns ids + prices (compact arrays) and an aggregate,
-- never full rows. Polygon is [[lat,lng], ...].
create or replace function public.book_select_area(
  p_lat double precision default null, p_lng double precision default null,
  p_radius_m double precision default null, p_polygon jsonb default null,
  p_city text default null, p_venue text default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  poly geometry;
  cap constant integer := 5000;
begin
  if p_polygon is not null then
    if jsonb_array_length(p_polygon) < 3 then
      raise exception 'Area needs at least 3 corners';
    end if;
    with pts as (
      select st_makepoint((e->>1)::float8, (e->>0)::float8) as g, ord
        from jsonb_array_elements(p_polygon) with ordinality t(e, ord)
    )
    select st_makevalid(st_setsrid(st_makepolygon(
             st_addpoint(st_makeline(array_agg(g order by ord)), (array_agg(g order by ord))[1])), 4326))
      into poly from pts;
  elsif p_lat is null or p_lng is null or p_radius_m is null then
    raise exception 'Provide a radius or a polygon';
  end if;

  return (
    with sel as (
      select s.id, s.daily_price_usd::float8 as price
        from screens s
       where s.is_available
         and (p_city is null or s.city = p_city)
         and (p_venue is null or s.venue_type = p_venue)
         and case
               when poly is not null then s.geog::geometry && poly and st_covers(poly, s.geog::geometry)
               else st_dwithin(s.geog, st_makepoint(p_lng, p_lat)::geography, least(p_radius_m, 50000))
             end
    ), agg as (
      select count(*)::int as n, coalesce(sum(price), 0) as total from sel
    ), capped as (
      select id, price from sel order by price, id limit cap
    )
    select jsonb_build_object(
      'n', agg.n,
      'truncated', agg.n > cap,
      'total_daily', agg.total,
      'ids', coalesce((select jsonb_agg(id order by price, id) from capped), '[]'::jsonb),
      'prices', coalesce((select jsonb_agg(price order by price, id) from capped), '[]'::jsonb))
    from agg);
end $$;

-- List view: same viewport + filters as the map, paginated.
create or replace function public.book_list(
  min_lat double precision, min_lng double precision,
  max_lat double precision, max_lng double precision,
  p_city text default null, p_venue text default null,
  p_offset integer default 0, p_limit integer default 60
) returns jsonb
language sql stable security definer set search_path = public as $$
  with box as (
    select st_makeenvelope(greatest(min_lng, -180), greatest(min_lat, -85),
                           least(max_lng, 180), least(max_lat, 85), 4326) as g
  ), hits as (
    select s.* from screens s, box
     where s.geog::geometry && box.g and s.is_available
       and (p_city is null or s.city = p_city)
       and (p_venue is null or s.venue_type = p_venue)
  )
  select jsonb_build_object(
    'total', (select count(*)::int from hits),
    'rows', coalesce((
      select jsonb_agg(r) from (
        select id, name, venue_type, city, neighborhood, lat, lng,
               daily_price_usd::float8 as daily_price_usd, max_duration_s, source
          from hits
         order by daily_price_usd, id
        offset greatest(p_offset, 0)
         limit least(greatest(p_limit, 1), 120)
      ) r), '[]'::jsonb));
$$;

-- Filter options: cities (with state + bounds so the map can fly there) and the
-- venue types that exist in the chosen city.
create or replace function public.book_filters(p_city text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'cities', coalesce((
      select jsonb_agg(c order by c.state, c.city) from (
        select city,
               max(dma) as dma,
               coalesce(substring(max(dma) from ' ([A-Z]{2})$'), '') as state,
               count(*)::int as n,
               min(lat) as min_lat, min(lng) as min_lng, max(lat) as max_lat, max(lng) as max_lng
          from screens where is_available
         group by city
      ) c), '[]'::jsonb),
    'venues', coalesce((
      select jsonb_agg(v order by v.venue_type) from (
        select venue_type, count(*)::int as n
          from screens
         where is_available and (p_city is null or city = p_city)
         group by venue_type
      ) v), '[]'::jsonb));
$$;

-- Free-text place search: neighborhood prefix, then city prefix, then contains.
create or replace function public.book_place_search(q text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with needle as (
    select replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') as t
  ), m as (
    select 'neighborhood' as kind, s.neighborhood as label, s.city, count(*)::int as n,
           min(s.lat) as min_lat, min(s.lng) as min_lng, max(s.lat) as max_lat, max(s.lng) as max_lng, 1 as pri
      from screens s, needle where s.is_available and s.neighborhood ilike needle.t || '%'
     group by s.neighborhood, s.city
    union all
    select 'city', s.city, s.city, count(*)::int, min(s.lat), min(s.lng), max(s.lat), max(s.lng), 2
      from screens s, needle where s.is_available and s.city ilike needle.t || '%'
     group by s.city
    union all
    select 'neighborhood', coalesce(s.neighborhood, s.city), s.city, count(*)::int,
           min(s.lat), min(s.lng), max(s.lat), max(s.lng), 3
      from screens s, needle
     where s.is_available
       and (s.neighborhood ilike '%' || needle.t || '%' or s.city ilike '%' || needle.t || '%')
     group by coalesce(s.neighborhood, s.city), s.city
  )
  select to_jsonb(x) from (
    select * from m where length(trim(q)) >= 2 order by pri, n desc limit 1
  ) x;
$$;

-- Details for a handful of selected screens (chips). Capped.
create or replace function public.book_screens_by_ids(p_ids uuid[])
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select id, name, venue_type, city, neighborhood, lat, lng,
           daily_price_usd::float8 as daily_price_usd, max_duration_s, source
      from screens where id = any(p_ids[1:200])
  ) r;
$$;

grant execute on function public.book_map(double precision, double precision, double precision, double precision, integer, text, text) to anon, authenticated;
grant execute on function public.book_select_area(double precision, double precision, double precision, jsonb, text, text) to anon, authenticated;
grant execute on function public.book_list(double precision, double precision, double precision, double precision, text, text, integer, integer) to anon, authenticated;
grant execute on function public.book_filters(text) to anon, authenticated;
grant execute on function public.book_place_search(text) to anon, authenticated;
grant execute on function public.book_screens_by_ids(uuid[]) to anon, authenticated;
