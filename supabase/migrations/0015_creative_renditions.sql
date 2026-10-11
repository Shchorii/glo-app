-- IDA-28: one design, every aspect ratio.
--
-- 80% of available inventory is 1920x1080 landscape and 20% is 1080x1920
-- portrait, but the template builder only ever exported 1080x1920. Four out
-- of five screens sold were therefore showing a portrait creative pillarboxed
-- onto a landscape display.
--
-- TemplateBuilder now renders at any size, so a single spec can produce every
-- ratio. This table holds those extra renders.
--
-- Deliberately additive. `creatives` is untouched and its row still points at
-- the 9:16 render, so every existing path keeps the exact behaviour it has
-- today: moderation still reviews the parent, attach_campaign_creative still
-- takes one creative id, and campaigns.creative_id still resolves to a single
-- file. Renditions hang off the parent and are read only by callers that ask
-- for them. Nothing breaks if this table is empty.
--
-- Per-screen selection at delivery is NOT wired up here, because there is no
-- delivery adapter to wire it into: delivery_jobs rows are created by the
-- trigger in 0005 and their state is advanced by SQL, and src/lib/scans.ts
-- marks real publisher delivery as Phase 4. When that lands it reads this
-- table, matching screens.width_px / screens.height_px to a rendition and
-- falling back to the parent creative when no rendition matches.

create table if not exists public.creative_renditions (
  id           uuid primary key default gen_random_uuid(),
  creative_id  uuid not null references public.creatives(id) on delete cascade,
  ratio        text not null check (ratio in ('16:9', '9:16', '1:1', '4:3')),
  storage_path text not null,
  width_px     int  not null check (width_px  > 0),
  height_px    int  not null check (height_px > 0),
  created_at   timestamptz not null default now(),
  unique (creative_id, ratio)
);

comment on table public.creative_renditions is
  'Extra aspect-ratio renders of a template creative. The parent creatives '
  'row remains the 9:16 render and the single source of truth for moderation '
  'and campaign attachment; these are additional files for screens whose '
  'shape differs. Empty is valid.';

create index if not exists creative_renditions_creative_idx
  on public.creative_renditions (creative_id);

alter table public.creative_renditions enable row level security;

-- Mirrors the creatives policy: you see the renditions of your own creatives.
drop policy if exists creative_renditions_owner_read on public.creative_renditions;
create policy creative_renditions_owner_read
  on public.creative_renditions for select
  using (
    exists (
      select 1 from public.creatives c
       where c.id = creative_renditions.creative_id
         and c.user_id = auth.uid()
    )
  );

drop policy if exists creative_renditions_owner_insert on public.creative_renditions;
create policy creative_renditions_owner_insert
  on public.creative_renditions for insert
  with check (
    exists (
      select 1 from public.creatives c
       where c.id = creative_renditions.creative_id
         and c.user_id = auth.uid()
    )
  );

grant select, insert on public.creative_renditions to authenticated;
