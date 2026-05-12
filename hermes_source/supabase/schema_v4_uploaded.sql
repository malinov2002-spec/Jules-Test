-- Schema updates for the refined time_suggestion skill
-- Run AFTER schema_v3.sql

-- Add backup move field to check_ins (captured at morning kickoff step 7.5)
alter table check_ins
  add column if not exists daily_intention_backup text;
  -- One of: "walk", "book", "jenelyn", "rest", null
  -- Free text allowed for variations

-- Add new fields to suggestions_log for spiral-aware logging
alter table suggestions_log
  add column if not exists was_task_from_list boolean,
  add column if not exists spiral_acknowledged boolean default false,
  add column if not exists backup_move_used boolean default false;

-- Index for analyzing spiral patterns in Phase 2 weekly review
create index if not exists idx_suggestions_spiral
  on suggestions_log(user_id, triggered_at desc)
  where spiral_acknowledged = true;

-- View: backup move acceptance rate (Phase 2 metric)
create or replace view backup_move_acceptance as
select
  date_trunc('week', triggered_at) as week,
  count(*) filter (where backup_move_used = true) as offered_count,
  count(*) filter (where backup_move_used = true and user_chose = '1') as accepted_count
from suggestions_log
where user_id = '11111111-1111-1111-1111-111111111111'
group by week
order by week desc;

-- View: spiral acknowledgments by time of day (Phase 2 pattern)
create or replace view spiral_patterns as
select
  time_of_day_bucket,
  day_of_week,
  count(*) as spiral_count
from suggestions_log
where user_id = '11111111-1111-1111-1111-111111111111'
  and spiral_acknowledged = true
group by time_of_day_bucket, day_of_week
order by spiral_count desc;
