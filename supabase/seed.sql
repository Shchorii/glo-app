-- Glo v1 seed: 2 publishers, 10 screens (applied to Supabase 2026-07-14)
with pubs as (
  insert into publishers (name, contact_email, delivery_method) values
    ('Atmosphere', 'partners@atmosphere.tv', 'vast'),
    ('Glo Manual Ops', 'hi@glo.io', 'manual')
  returning id, name
)
insert into screens (publisher_id, name, venue_type, city, lat, lng, daily_price_usd, width_px, height_px, max_duration_s)
select p.id, s.name, s.venue_type, s.city, s.lat, s.lng, s.price, s.w, s.h, s.dur
from pubs p
join (values
  ('Atmosphere', 'Bryant Park Sports Bar', 'bar', 'New York', 40.7536, -73.9832, 39.00, 1920, 1080, 15),
  ('Atmosphere', 'SoHo Fitness Club', 'gym', 'New York', 40.7248, -74.0018, 34.00, 1920, 1080, 15),
  ('Atmosphere', 'Williamsburg Barcade', 'bar', 'New York', 40.7133, -73.9576, 29.00, 1920, 1080, 15),
  ('Atmosphere', 'Midtown Deli Row', 'restaurant', 'New York', 40.7549, -73.9840, 32.00, 1920, 1080, 15),
  ('Atmosphere', 'Venice Beach Smoothie Bar', 'restaurant', 'Los Angeles', 33.9850, -118.4695, 29.00, 1920, 1080, 15),
  ('Atmosphere', 'WeHo Fitness Studio', 'gym', 'Los Angeles', 34.0900, -118.3617, 31.00, 1920, 1080, 15),
  ('Glo Manual Ops', 'Flatiron Sidewalk Panel', 'street', 'New York', 40.7411, -73.9897, 89.00, 1080, 1920, 15),
  ('Glo Manual Ops', 'Lower East Side Bodega Screen', 'retail', 'New York', 40.7180, -73.9860, 45.00, 1080, 1920, 15),
  ('Glo Manual Ops', 'Silver Lake Coffee Window', 'retail', 'Los Angeles', 34.0870, -118.2702, 42.00, 1080, 1920, 15),
  ('Glo Manual Ops', 'Miami Wynwood Wall Screen', 'street', 'Miami', 25.8005, -80.1998, 95.00, 1080, 1920, 30)
) as s(pub, name, venue_type, city, lat, lng, price, w, h, dur)
on s.pub = p.name;
