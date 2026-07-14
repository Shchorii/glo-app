-- Phase 3.1: daypart targeting. 'all_day' or any subset of:
-- morning_rush (7-9am), daytime (9am-5pm), evening_rush (5-7pm), evening (7-10pm), late_night (10pm-12am)
alter table public.campaigns
  add column dayparts text[] not null default '{all_day}';
