-- M1 Studio: distinguish AI + embed sources; remember origin URL and model.
-- Postgres 17 allows ADD VALUE inside a transaction.

alter type public.creative_source add value if not exists 'ai';
alter type public.creative_source add value if not exists 'embed';

alter table public.creatives
  add column if not exists source_url text,
  add column if not exists provider text,
  add column if not exists model text;
