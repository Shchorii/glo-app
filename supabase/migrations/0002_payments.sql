-- Phase 3: payments + paid_at
create type public.payment_status as enum ('created','succeeded','expired','refunded');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_usd numeric(10,2) not null,
  currency text not null default 'usd',
  status public.payment_status not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "payments owner read" on public.payments
  for select using (auth.uid() = user_id);
-- no insert/update/delete policies: writes happen via service role in edge functions

create index payments_campaign_idx on public.payments(campaign_id);
create index payments_session_idx on public.payments(stripe_session_id);

alter table public.campaigns add column paid_at timestamptz;
