-- Glo app v1 initial schema (spec section 3)
-- Applied via Supabase MCP on 2026-07-14 as migration glo_v1_init

create type delivery_method as enum ('vast', 'ssp', 'manual');
create type review_status as enum ('pending', 'approved', 'rejected');
create type campaign_status as enum ('draft', 'pending_payment', 'pending_review', 'scheduled', 'live', 'completed', 'cancelled', 'refunded');
create type order_status as enum ('pending', 'paid', 'refunded', 'partially_refunded');
create type creative_source as enum ('upload', 'template');
create type delivery_job_state as enum ('pending', 'handed_off', 'running', 'done', 'error');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  delivery_method delivery_method not null default 'manual',
  created_at timestamptz not null default now()
);

create table screens (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references publishers(id),
  name text not null,
  venue_type text not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  daily_price_usd numeric(10,2) not null check (daily_price_usd >= 29),
  width_px int not null default 1920,
  height_px int not null default 1080,
  max_duration_s int not null default 15,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table creatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  storage_path text not null,
  source creative_source not null default 'upload',
  width_px int,
  height_px int,
  duration_s int,
  review_status review_status not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  creative_id uuid references creatives(id),
  name text not null default 'My campaign',
  start_date date not null,
  end_date date not null,
  total_usd numeric(10,2) not null default 0,
  status campaign_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint valid_flight check (end_date >= start_date)
);

create table campaign_screens (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  screen_id uuid not null references screens(id),
  primary key (campaign_id, screen_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references campaigns(id),
  user_id uuid not null references profiles(id),
  stripe_payment_intent text,
  stripe_checkout_session text,
  amount_usd numeric(10,2) not null,
  status order_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  publisher_id uuid not null references publishers(id),
  adapter delivery_method not null,
  state delivery_job_state not null default 'pending',
  error text,
  plays bigint not null default 0,
  impressions bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (campaign_id, publisher_id)
);

-- Auto-create a profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row level security
alter table profiles enable row level security;
alter table publishers enable row level security;
alter table screens enable row level security;
alter table creatives enable row level security;
alter table campaigns enable row level security;
alter table campaign_screens enable row level security;
alter table orders enable row level security;
alter table delivery_jobs enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: own row; admins read all
create policy "own profile read" on profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile update" on profiles for update using (id = auth.uid());

-- public catalog
create policy "publishers public read" on publishers for select using (true);
create policy "screens public read" on screens for select using (true);
create policy "publishers admin write" on publishers for all using (public.is_admin());
create policy "screens admin write" on screens for all using (public.is_admin());

-- creatives: owner CRUD (no review self-approval: review_status changes only via admin policy or service role)
create policy "creatives owner read" on creatives for select using (user_id = auth.uid() or public.is_admin());
create policy "creatives owner insert" on creatives for insert with check (user_id = auth.uid());
create policy "creatives owner update" on creatives for update using (user_id = auth.uid()) with check (user_id = auth.uid() and review_status = 'pending');
create policy "creatives admin all" on creatives for all using (public.is_admin());

-- campaigns: owner CRUD while draft; read always
create policy "campaigns owner read" on campaigns for select using (user_id = auth.uid() or public.is_admin());
create policy "campaigns owner insert" on campaigns for insert with check (user_id = auth.uid());
create policy "campaigns owner update draft" on campaigns for update using (user_id = auth.uid() and status = 'draft');
create policy "campaigns admin all" on campaigns for all using (public.is_admin());

-- campaign_screens: via owning campaign
create policy "campaign_screens owner read" on campaign_screens for select
  using (exists (select 1 from campaigns c where c.id = campaign_id and (c.user_id = auth.uid() or public.is_admin())));
create policy "campaign_screens owner write" on campaign_screens for insert
  with check (exists (select 1 from campaigns c where c.id = campaign_id and c.user_id = auth.uid() and c.status = 'draft'));
create policy "campaign_screens owner delete" on campaign_screens for delete
  using (exists (select 1 from campaigns c where c.id = campaign_id and c.user_id = auth.uid() and c.status = 'draft'));

-- orders: owner read only (writes via Edge Functions with service role)
create policy "orders owner read" on orders for select using (user_id = auth.uid() or public.is_admin());

-- delivery_jobs: admin only
create policy "delivery_jobs admin" on delivery_jobs for all using (public.is_admin());

-- Storage bucket for creatives
insert into storage.buckets (id, name, public) values ('creatives', 'creatives', false)
on conflict (id) do nothing;

create policy "creatives storage owner rw" on storage.objects for all
  using (bucket_id = 'creatives' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()))
  with check (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);
