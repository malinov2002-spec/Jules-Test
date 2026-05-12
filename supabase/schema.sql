-- Hermes Mobile — combined schema (v1 + v2 + v3 + v4 + mobile additions)
-- Run this once in the Supabase SQL Editor for your project.
-- Idempotent: safe to re-run.
-- Uses gen_random_uuid() — no extensions required (built-in on Postgres 13+).

-- ─── Users ───────────────────────────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text default 'America/New_York',
  created_at timestamptz default now()
);

-- Seed the single user. Update name/timezone if you'd like.
insert into users (id, name, timezone)
values ('11111111-1111-1111-1111-111111111111', 'Misho', 'America/New_York')
on conflict (id) do nothing;

-- ─── Tasks ───────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  description text not null,
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')) not null,
  type text check (type in ('task', 'idea', 'decision', 'waiting_for')) default 'task',
  status text check (status in ('open', 'captured_for_review', 'in_progress', 'done', 'dropped', 'pushed')) default 'open',
  priority text check (priority in ('low', 'medium', 'high', 'urgent')),
  deadline date,
  estimated_minutes integer,
  actual_minutes integer,
  created_time_bucket text check (created_time_bucket in ('morning', 'midday', 'evening', 'late_night')),
  source text,
  notes text,
  push_count integer default 0,
  original_created_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz,
  dropped_at timestamptz,
  dropped_reason text,
  -- Google Tasks sync fields (added for mobile app)
  google_task_id text,
  google_tasklist_id text,
  google_synced_at timestamptz
);

create index if not exists idx_tasks_user_status on tasks(user_id, status);
create index if not exists idx_tasks_business on tasks(business);
create index if not exists idx_tasks_deadline on tasks(deadline) where status = 'open';
create index if not exists idx_tasks_google on tasks(google_task_id) where google_task_id is not null;

-- ─── MITs ────────────────────────────────────────────────────────────────────
create table if not exists mits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  date date not null,
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')) not null,
  task_id uuid references tasks(id),
  target_time_block text,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, date, business)
);

create index if not exists idx_mits_user_date on mits(user_id, date);

-- ─── Check-ins ───────────────────────────────────────────────────────────────
create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  type text check (type in ('morning_kickoff', 'evening_shutdown', 'midday_refocus', 'weekly_review')) not null,
  date date not null,
  time_started timestamptz default now(),
  time_ended timestamptz,
  completed boolean default false,
  duration_seconds integer,
  energy integer check (energy >= 1 and energy <= 10),
  mood_notes text,
  daily_intention text,
  daily_intention_backup text,
  ravikant_completed boolean default false,
  daily_win text,
  intention_met boolean,
  intention_met_notes text,
  mits_completed_count integer,
  tasks_pushed_count integer,
  tasks_dropped_count integer,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_checkins_user_date_type on check_ins(user_id, date, type);

-- ─── Decisions ───────────────────────────────────────────────────────────────
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  description text not null,
  decision_type text check (decision_type in (
    'financial_commitment', 'project_start', 'project_drop',
    'commitment_made', 'commitment_changed', 'priority_shift', 'other'
  )),
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')),
  amount_usd numeric,
  energy_at_decision integer check (energy_at_decision >= 1 and energy_at_decision <= 10),
  time_of_day_bucket text check (time_of_day_bucket in ('morning', 'midday', 'evening', 'late_night')),
  challenge_fired boolean default false,
  challenge_trigger text,
  user_response text,
  check_in_scheduled_at timestamptz,
  outcome_logged_at timestamptz,
  outcome text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_decisions_user_created on decisions(user_id, created_at desc);

-- ─── Commitment loops ────────────────────────────────────────────────────────
create table if not exists commitment_loops (
  id uuid primary key default gen_random_uuid(),
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

create index if not exists idx_commitment_loops_user on commitment_loops(user_id, resolution);

-- ─── Patterns observed ──────────────────────────────────────────────────────
create table if not exists patterns_observed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  week_starting date not null,
  pattern_text text not null,
  data_source jsonb,
  user_confirmed boolean,
  user_correction text,
  created_at timestamptz default now()
);

-- ─── Task follow-ups ────────────────────────────────────────────────────────
create table if not exists task_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  task_id uuid references tasks(id) on delete cascade,
  ping_sent_at timestamptz default now(),
  ping_type text check (ping_type in (
    'time_block_end', 'deadline_approaching', 'post_meeting',
    'general_check_in', 'unblock_question'
  )),
  response_text text,
  response_action text check (response_action in (
    'done', 'pushed', 'dropped', 'broke_down', 'forgot',
    'no_energy', 'not_important', 'too_big', 'in_progress',
    'ignored', 'other'
  )),
  response_received_at timestamptz,
  response_time_seconds integer,
  escalation_level integer default 1,
  created_at timestamptz default now()
);

create index if not exists idx_followups_user_task on task_followups(user_id, task_id);

-- ─── Task breakdowns ────────────────────────────────────────────────────────
create table if not exists task_breakdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  task_id uuid references tasks(id) on delete cascade,
  steps jsonb not null,
  total_estimated_minutes integer,
  risky_step_number integer,
  risky_step_note text,
  generated_at timestamptz default now(),
  first_step_completed_at timestamptz,
  all_steps_completed_at timestamptz,
  abandoned_at timestamptz,
  abandoned_at_step integer
);

create index if not exists idx_breakdowns_user_task on task_breakdowns(user_id, task_id);

-- ─── Quiet periods ──────────────────────────────────────────────────────────
create table if not exists quiet_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  starts_at timestamptz default now(),
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_quiet_active on quiet_periods(user_id, ends_at);

-- ─── Suggestions log ────────────────────────────────────────────────────────
create table if not exists suggestions_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  triggered_at timestamptz default now(),
  triggered_by text check (triggered_by in ('user_asked', 'auto_quiet_day')) not null,
  available_minutes integer,
  energy_at_request integer check (energy_at_request between 1 and 10),
  time_of_day_bucket text check (time_of_day_bucket in ('morning', 'midday', 'evening', 'late_night')),
  day_of_week integer check (day_of_week between 0 and 6),
  tasks_completed_today integer default 0,
  hours_since_last_message numeric,
  suggestions_offered jsonb not null,
  primary_pick_pool text,
  user_chose text,
  user_chose_text text,
  user_chose_at timestamptz,
  response_time_seconds integer,
  was_task_from_list boolean,
  spiral_acknowledged boolean default false,
  backup_move_used boolean default false
);

create index if not exists idx_suggestions_user_time on suggestions_log(user_id, triggered_at desc);
create index if not exists idx_suggestions_spiral
  on suggestions_log(user_id, triggered_at desc)
  where spiral_acknowledged = true;

-- ─── User preferences ───────────────────────────────────────────────────────
create table if not exists user_preferences (
  user_id uuid primary key references users(id),
  auto_suggest_on_quiet_days boolean default true,
  preferred_book_or_content text,
  last_jenelyn_contact timestamptz,
  daily_walk_target_minutes integer default 30,
  -- Google Tasks sync settings (added for mobile app)
  google_tasks_sync_enabled boolean default false,
  google_default_tasklist_id text,
  google_refresh_token text,
  updated_at timestamptz default now()
);

insert into user_preferences (user_id, preferred_book_or_content)
values ('11111111-1111-1111-1111-111111111111', 'Atomic Habits')
on conflict (user_id) do nothing;

-- ─── Coach messages (shared chat history across Telegram + phone + future) ───
create table if not exists coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  thread text not null default 'main',
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  skill text,
  surface text, -- 'telegram' | 'mobile_android' | 'web' | etc.
  created_at timestamptz default now()
);

create index if not exists idx_coach_messages_thread on coach_messages(user_id, thread, created_at);
create index if not exists idx_coach_messages_surface on coach_messages(user_id, surface, created_at desc);

-- ─── Devices (Expo push tokens for server-side notifications) ───────────────
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  platform text check (platform in ('android', 'ios', 'web')) not null,
  push_token text unique,
  device_name text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_devices_user on devices(user_id, last_seen desc);

-- ─── Views ──────────────────────────────────────────────────────────────────
create or replace view today_open_tasks as
select business, count(*) as open_count,
  array_agg(description order by deadline nulls last, priority desc) as descriptions
from tasks
where status = 'open'
group by user_id, business;

create or replace view stuck_commitments as
select t.id, t.description, t.business, t.push_count, t.original_created_at,
  extract(day from now() - t.original_created_at) as days_open
from tasks t
where t.status = 'open' and t.push_count >= 3;
