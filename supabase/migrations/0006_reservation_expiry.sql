-- 5-minute payment window: reserved_at stamps the clock, a minutely cron releases unpaid slots.
alter table public.campaigns add column reserved_at timestamptz;

create or replace function public.stamp_reserved_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'pending_payment' and (old.status is distinct from 'pending_payment') then
    new.reserved_at := now();
  end if;
  return new;
end $$;

create trigger campaigns_stamp_reserved_at
  before update on public.campaigns
  for each row execute function public.stamp_reserved_at();

-- Existing reserved campaigns get a fresh window from now
update public.campaigns set reserved_at = now() where status = 'pending_payment';

-- Release unpaid reservations after 5 minutes (runs every minute)
select cron.schedule('glo-reservation-expiry', '* * * * *', $$
  update public.campaigns
    set status = 'cancelled'
    where status = 'pending_payment'
      and reserved_at is not null
      and reserved_at < now() - interval '5 minutes';
$$);
