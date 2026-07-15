-- Owners can edit/cancel anything unpaid, and delete drafts, unpaid reservations, and cancelled campaigns.
-- Paid campaigns (pending_review onward) stay immutable to owners; admin/service role only.
drop policy "campaigns owner update draft" on public.campaigns;

create policy "campaigns owner update unpaid" on public.campaigns
  for update
  using (user_id = auth.uid() and status in ('draft','pending_payment'))
  with check (user_id = auth.uid() and status in ('draft','pending_payment','cancelled'));

create policy "campaigns owner delete unpaid" on public.campaigns
  for delete
  using (user_id = auth.uid() and status in ('draft','pending_payment','cancelled'));
