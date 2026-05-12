-- ADHD Coach Phase 1 Schema
-- Run this in Supabase SQL Editor
-- Designed for single-user (Misho) but uses user_id for future multi-user

-- ─── Setup ───────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- Single-user setup: insert one user, use their UUID throughout.
-- For Phase 1, we'll just hardcode one user_id in the Hermes tool config.
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  timezone text default 'America/New_York',
  created_at timestamptz default now()
);

-- ─── Tasks ───────────────────────────────────────────────────────────────────
-- Every captured task. Updated as it moves through statuses.
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  description text not null,
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')) not null,
  type text check (type in ('task', 'idea', 'decision', 'waiting_for')) default 'task',
  status text check (status in ('open', 'captured_for_review', 'in_progress', 'done', 'dropped', 'pushed')) default 'open',
  priority text check (priority in ('low', 'medium', 'high', 'urgent')),
  deadline date,
  estimated_minutes integer,
  actual_minutes integer,
  -- Time bucket when this task was created (for pattern detection later)
  created_time_bucket text check (created_time_bucket in ('morning', 'midday', 'evening', 'late_night')),
  source text, -- 'telegram_capture', 'morning_kickoff', 'voice_note', etc
  notes text,
  -- For commitment loop tracking (Phase 2)
  push_count integer default 0,
  original_created_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz,
  dropped_at timestamptz,
  dropped_reason text
);

create index idx_tasks_user_status on tasks(user_id, status);
create index idx_tasks_business on tasks(business);
create index idx_tasks_deadline on tasks(deadline) where status = 'open';

-- ─── Daily MITs ──────────────────────────────────────────────────────────────
-- The 1-3 most important tasks picked at morning kickoff. Links to tasks table.
create table if not exists mits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  date date not null,
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')) not null,
  task_id uuid references tasks(id),
  target_time_block text, -- "morning" / "after lunch" / etc, free text
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, date, business)
);

create index idx_mits_user_date on mits(user_id, date);

-- ─── Check-ins ───────────────────────────────────────────────────────────────
-- Morning kickoffs and evening shutdowns. One per type per day.
create table if not exists check_ins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  type text check (type in ('morning_kickoff', 'evening_shutdown', 'midday_refocus', 'weekly_review')) not null,
  date date not null,
  time_started timestamptz default now(),
  time_ended timestamptz,
  completed boolean default false,
  duration_seconds integer,

  -- Morning fields
  energy integer check (energy >= 1 and energy <= 10),
  mood_notes text,
  daily_intention text,
  ravikant_completed boolean default false,

  -- Evening fields
  daily_win text,
  intention_met boolean,
  intention_met_notes text,
  mits_completed_count integer,
  tasks_pushed_count integer,
  tasks_dropped_count integer,

  -- Free text any time
  notes text,
  created_at timestamptz default now()
);

create index idx_checkins_user_date_type on check_ins(user_id, date, type);

-- ─── Decisions ───────────────────────────────────────────────────────────────
-- Major decisions Misho mentions. Logged silently in Phase 1.
-- Used for Devil's Advocate / Challenge Mode in Phase 2.
create table if not exists decisions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  description text not null,
  decision_type text check (decision_type in (
    'financial_commitment',
    'project_start',
    'project_drop',
    'commitment_made',
    'commitment_changed',
    'priority_shift',
    'other'
  )),
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')),
  amount_usd numeric,
  -- The context at time of decision — important for Phase 2 pattern detection
  energy_at_decision integer check (energy_at_decision >= 1 and energy_at_decision <= 10),
  time_of_day_bucket text check (time_of_day_bucket in ('morning', 'midday', 'evening', 'late_night')),
  -- These are for Phase 2 — leave null in Phase 1
  challenge_fired boolean default false,
  challenge_trigger text,
  user_response text,
  check_in_scheduled_at timestamptz,
  outcome_logged_at timestamptz,
  outcome text,
  notes text,
  created_at timestamptz default now()
);

create index idx_decisions_user_created on decisions(user_id, created_at desc);

-- ─── Commitment loops ────────────────────────────────────────────────────────
-- Tracks when the same intention gets restated across days.
-- Phase 1: silent logging only. Phase 2: surfaced as a Devil's Advocate trigger.
create table if not exists commitment_loops (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  description text not null,
  task_id uuid references tasks(id),
  first_stated_at timestamptz default now(),
  times_restated integer default 1,
  last_restated_at timestamptz default now(),
  resolution text check (resolution in ('completed', 'dropped', 'delegated', 'broken_down', 'still_open')) default 'still_open',
  notes text,
  created_at timestamptz default now()
);

create index idx_commitment_loops_user on commitment_loops(user_id, resolution);

-- ─── Patterns observed ───────────────────────────────────────────────────────
-- For Phase 2 weekly retrospective. Empty in Phase 1 — but ready when needed.
create table if not exists patterns_observed (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  week_starting date not null,
  pattern_text text not null,
  data_source jsonb,
  user_confirmed boolean,
  user_correction text,
  created_at timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Since this is a single-user system, RLS is mostly belt-and-suspenders.
-- The Hermes tool uses the service_role key which bypasses RLS, but enabling
-- it is good practice in case you ever expose this to a real frontend.

alter table users enable row level security;
alter table tasks enable row level security;
alter table mits enable row level security;
alter table check_ins enable row level security;
alter table decisions enable row level security;
alter table commitment_loops enable row level security;
alter table patterns_observed enable row level security;

-- service_role bypasses RLS automatically; no policies needed for Phase 1
-- Add per-user policies in Phase 2+ if going multi-user

-- ─── Seed the user ───────────────────────────────────────────────────────────
insert into users (id, name, timezone)
values ('11111111-1111-1111-1111-111111111111', 'Misho', 'America/New_York')
on conflict (id) do nothing;

-- ─── Helpful views ───────────────────────────────────────────────────────────

-- Today's open tasks per business
create or replace view today_open_tasks as
select
  business,
  count(*) as open_count,
  array_agg(description order by deadline nulls last, priority desc) as descriptions
from tasks
where status = 'open'
  and user_id = '11111111-1111-1111-1111-111111111111'
group by business;

-- Tasks pushed 3+ times (Phase 2 signal)
create or replace view stuck_commitments as
select
  t.id,
  t.description,
  t.business,
  t.push_count,
  t.original_created_at,
  extract(day from now() - t.original_created_at) as days_open
from tasks t
where t.status = 'open'
  and t.push_count >= 3;

-- Weekly summary (Phase 2 weekly review)
create or replace view weekly_summary as
select
  date_trunc('week', date) as week_starting,
  type,
  count(*) as count,
  avg(energy) filter (where type = 'morning_kickoff') as avg_morning_energy,
  count(*) filter (where intention_met = true and type = 'evening_shutdown') as intentions_met
from check_ins
where user_id = '11111111-1111-1111-1111-111111111111'
group by week_starting, type
order by week_starting desc;
