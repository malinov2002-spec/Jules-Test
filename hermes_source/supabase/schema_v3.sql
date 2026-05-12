-- Additional schema for time suggestions
-- Run AFTER schema.sql and schema_v2.sql

-- ─── Suggestions log ─────────────────────────────────────────────────────────
-- Every "what should I do now?" interaction logged for pattern detection
create table if not exists suggestions_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  triggered_at timestamptz default now(),
  triggered_by text check (triggered_by in ('user_asked', 'auto_quiet_day')) not null,

  -- Context at time of suggestion
  available_minutes integer,
  energy_at_request integer check (energy_at_request between 1 and 10),
  time_of_day_bucket text check (time_of_day_bucket in ('morning', 'midday', 'evening', 'late_night')),
  day_of_week integer check (day_of_week between 0 and 6),
  tasks_completed_today integer default 0,
  hours_since_last_message numeric,

  -- The options offered
  suggestions_offered jsonb not null, -- [{pool: "A|B|C|D|E", text, estimated_minutes}]
  primary_pick_pool text, -- which pool the AI's top pick came from

  -- The user's response
  user_chose text, -- "1" | "2" | "3" | "other" | "none" | "ignored"
  user_chose_text text, -- if "other", what he actually did
  user_chose_at timestamptz,
  response_time_seconds integer
);

create index idx_suggestions_user_time on suggestions_log(user_id, triggered_at desc);
create index idx_suggestions_unanswered on suggestions_log(user_id)
  where user_chose is null;

-- ─── User preferences ────────────────────────────────────────────────────────
-- Single row for Misho's preference toggles
create table if not exists user_preferences (
  user_id uuid primary key references users(id),
  auto_suggest_on_quiet_days boolean default true,
  preferred_book_or_content text, -- "Atomic Habits chapter X", "currently reading: Y"
  last_jenelyn_contact timestamptz, -- so suggestions can check this
  daily_walk_target_minutes integer default 30,
  updated_at timestamptz default now()
);

-- Seed Misho's preferences row
insert into user_preferences (user_id, preferred_book_or_content)
values (
  '11111111-1111-1111-1111-111111111111',
  'Atomic Habits'
)
on conflict (user_id) do nothing;

-- ─── Helpful view: did we already auto-trigger today? ────────────────────────
create or replace view auto_triggered_today as
select count(*) as auto_count
from suggestions_log
where user_id = '11111111-1111-1111-1111-111111111111'
  and triggered_by = 'auto_quiet_day'
  and triggered_at >= current_date;

-- ─── Helpful view: declined suggestions today (don't re-offer) ───────────────
create or replace view declined_today as
select
  jsonb_array_elements(suggestions_offered) as option
from suggestions_log
where user_id = '11111111-1111-1111-1111-111111111111'
  and triggered_at >= current_date
  and user_chose = 'none';
