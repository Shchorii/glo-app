-- Attach gate: rejected creatives never attach; pending/rejected cannot attach to paid/live campaigns.
-- Stripe status flips (pending_payment → pending_review) do not re-check the already-attached creative.

create or replace function public.guard_campaign_creative()
returns trigger language plpgsql set search_path = public as $$
declare
  rs public.review_status;
  reason text;
begin
  if new.creative_id is null then
    return new;
  end if;

  -- Status-only updates (checkout / webhook) keep the existing creative as-is.
  if tg_op = 'UPDATE' and new.creative_id is not distinct from old.creative_id then
    return new;
  end if;

  select review_status, rejection_reason into rs, reason
  from public.creatives where id = new.creative_id;
  if not found then
    raise exception 'Creative not found';
  end if;

  if rs = 'rejected' then
    raise exception 'This creative was rejected: %', coalesce(nullif(trim(reason), ''), 'Does not meet content guidelines');
  end if;

  if new.status in ('pending_review', 'scheduled', 'live') and rs <> 'approved' then
    raise exception 'This creative is still in review. It can attach to a paid campaign once approved.';
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_guard_creative on public.campaigns;
create trigger campaigns_guard_creative
  before insert or update of creative_id, status on public.campaigns
  for each row execute procedure public.guard_campaign_creative();

-- Owners can replace the creative on unpaid + in-review campaigns. Trigger enforces approved on paid/live.
-- Column-limited via this RPC so we do not widen the unpaid UPDATE policy.
create or replace function public.attach_campaign_creative(cid uuid, crid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  camp public.campaigns%rowtype;
  cr public.creatives%rowtype;
begin
  select * into camp from public.campaigns where id = cid;
  if not found then raise exception 'Campaign not found'; end if;
  if camp.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not your campaign';
  end if;

  select * into cr from public.creatives where id = crid;
  if not found then raise exception 'Creative not found'; end if;
  if cr.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not your creative';
  end if;

  if cr.review_status = 'rejected' then
    raise exception 'This creative was rejected: %', coalesce(nullif(trim(cr.rejection_reason), ''), 'Does not meet content guidelines');
  end if;

  if camp.status in ('pending_review', 'scheduled', 'live') and cr.review_status <> 'approved' then
    raise exception 'This creative is still in review. It can attach to a paid campaign once approved.';
  end if;

  if camp.status not in ('draft', 'pending_payment', 'pending_review') and not public.is_admin() then
    raise exception 'Cannot change the creative on this campaign';
  end if;

  update public.campaigns set creative_id = crid where id = cid;
end;
$$;
