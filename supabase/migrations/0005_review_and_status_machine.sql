-- Phase 4a: owner visibility on delivery jobs, review RPCs, status machine cron, admin seed

create policy "delivery_jobs owner read" on public.delivery_jobs
  for select using (
    exists (select 1 from public.campaigns c where c.id = delivery_jobs.campaign_id and c.user_id = auth.uid())
  );

-- Approve: creative approved, campaign scheduled, delivery jobs created per publisher
create or replace function public.approve_campaign(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;

  update creatives set review_status = 'approved', rejection_reason = null
    where id = (select creative_id from campaigns where id = cid);

  update campaigns set status = 'scheduled' where id = cid and status = 'pending_review';
  if not found then raise exception 'campaign is not pending review'; end if;

  insert into delivery_jobs (campaign_id, publisher_id, adapter)
  select distinct cs.campaign_id, s.publisher_id, p.delivery_method
  from campaign_screens cs
  join screens s on s.id = cs.screen_id
  join publishers p on p.id = s.publisher_id
  where cs.campaign_id = cid
  on conflict (campaign_id, publisher_id) do nothing;
end $$;

-- Reject: creative rejected with reason; campaign stays pending_review for resubmission
create or replace function public.reject_creative(cid uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  update creatives set review_status = 'rejected', rejection_reason = coalesce(nullif(trim(reason), ''), 'Does not meet content guidelines')
    where id = (select creative_id from campaigns where id = cid);
  if not found then raise exception 'campaign has no creative to reject'; end if;
end $$;

-- Status machine: hourly cron
create extension if not exists pg_cron;
select cron.schedule('glo-status-machine', '17 * * * *', $$
  update public.campaigns set status = 'live' where status = 'scheduled' and start_date <= current_date;
  update public.campaigns set status = 'completed' where status = 'live' and end_date < current_date;
  update public.delivery_jobs dj set state = 'running', updated_at = now()
    from public.campaigns c where c.id = dj.campaign_id and c.status = 'live' and dj.state in ('pending','handed_off');
  update public.delivery_jobs dj set state = 'done', updated_at = now()
    from public.campaigns c where c.id = dj.campaign_id and c.status = 'completed' and dj.state = 'running';
$$);

-- Seed admin
update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'idan@we-are-glo.com');
