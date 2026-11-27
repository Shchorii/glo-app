-- Reject a new or edited unpaid flight whose start is more than one day
-- before the database date. One day of slack matches checkout: a same-day
-- booking near midnight must still insert when UTC is already tomorrow.
--
-- Not a CHECK constraint. Live, completed, and other paid rows can keep a
-- past start. The trigger watches start_date and end_date only, so the 0005
-- status machine (status updates) and reservation expiry do not fire it.

create or replace function public.guard_campaign_start_not_past()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status not in ('draft', 'pending_payment') then
    return new;
  end if;

  if new.start_date < (current_date - 1) then
    raise exception 'This campaign''s start date is in the past. Pick new dates.';
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_guard_start_not_past on public.campaigns;
create trigger campaigns_guard_start_not_past
  before insert or update of start_date, end_date on public.campaigns
  for each row execute function public.guard_campaign_start_not_past();
