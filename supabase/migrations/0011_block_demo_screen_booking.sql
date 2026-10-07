-- Demo inventory stays browsable and can sit on a draft. It cannot be booked or paid.
-- Does not update or delete existing campaigns or payments.

create or replace function public.demo_screen_count(p_campaign uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
    from public.campaign_screens cs
    join public.screens s on s.id = cs.screen_id
   where cs.campaign_id = p_campaign
     and s.source = 'demo';
$$;

-- Block the money path: a campaign with any demo screen cannot enter a booked status.
-- cancelled / completed / refunded, and edits that do not change status, stay allowed.
create or replace function public.guard_campaign_demo_booking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('pending_payment', 'pending_review', 'scheduled', 'live') then
    return new;
  end if;

  n := public.demo_screen_count(new.id);
  if n > 0 then
    raise exception 'This campaign includes % demo screen(s). Demo inventory can''t be booked or paid.', n;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_guard_demo_booking on public.campaigns;
create trigger campaigns_guard_demo_booking
  before insert or update of status on public.campaigns
  for each row execute procedure public.guard_campaign_demo_booking();

-- Drafts may hold demo screens. Anything past draft may not gain one.
-- Service role bypasses RLS, so this trigger is the guard.
create or replace function public.guard_campaign_screen_demo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  src text;
  st public.campaign_status;
begin
  select s.source::text into src from public.screens s where s.id = new.screen_id;
  if src is distinct from 'demo' then
    return new;
  end if;

  select c.status into st from public.campaigns c where c.id = new.campaign_id;
  if not found or st is distinct from 'draft' then
    raise exception 'Demo screens can''t be attached once a campaign is past draft. Demo inventory can''t be booked or paid.';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_screens_guard_demo on public.campaign_screens;
create trigger campaign_screens_guard_demo
  before insert or update on public.campaign_screens
  for each row execute procedure public.guard_campaign_screen_demo();

-- Payments are written by the service-role checkout function, which bypasses RLS.
create or replace function public.guard_payment_demo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  n := public.demo_screen_count(new.campaign_id);
  if n > 0 then
    raise exception 'This campaign includes % demo screen(s). Demo inventory can''t be booked or paid.', n;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_guard_demo on public.payments;
create trigger payments_guard_demo
  before insert on public.payments
  for each row execute procedure public.guard_payment_demo();
