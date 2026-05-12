-- Additional schema for task follow-ups and task breakdowns
-- Run this AFTER the original schema.sql is applied
-- Adds support for the task_followup and task_breakdown skills

-- ─── Task follow-ups (every ping logged) ─────────────────────────────────────
create table if not exists task_followups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  task_id uuid references tasks(id) on delete cascade,
  ping_sent_at timestamptz default now(),
  ping_type text check (ping_type in (
    'time_block_end',        -- "end of morning, did the IFTA happen?"
    'deadline_approaching',  -- "deadline tomorrow heads up"
    'post_meeting',          -- "just out of [event], anything to capture"
    'general_check_in',      -- "how's today going?"
    'unblock_question'       -- second ping: "what's stopping you?"
  )),
  response_text text,
  response_action text check (response_action in (
    'done',
    'pushed',
    'dropped',
    'broke_down',
    'forgot',
    'no_energy',
    'not_important',
    'too_big',
    'in_progress',
    'ignored',
    'other'
  )),
  response_received_at timestamptz,
  response_time_seconds integer,
  escalation_level integer default 1, -- 1 first ping, 2 unblock follow-up
  created_at timestamptz default now()
);

create index idx_followups_user_task on task_followups(user_id, task_id);
create index idx_followups_unanswered on task_followups(user_id)
  where response_received_at is null;

-- ─── Task breakdowns ─────────────────────────────────────────────────────────
-- Cached breakdowns so we don't regenerate the same steps every time
create table if not exists task_breakdowns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  task_id uuid references tasks(id) on delete cascade,
  steps jsonb not null, -- [{step_number, description, estimated_minutes, completed, completed_at}]
  total_estimated_minutes integer,
  risky_step_number integer, -- which step is most likely to derail
  risky_step_note text,
  generated_at timestamptz default now(),
  first_step_completed_at timestamptz,
  all_steps_completed_at timestamptz,
  abandoned_at timestamptz,
  abandoned_at_step integer
);

create index idx_breakdowns_user_task on task_breakdowns(user_id, task_id);

-- ─── Quiet mode (silence rules) ──────────────────────────────────────────────
-- Misho can request "quiet mode for 2 hours" or "no pings rest of day"
-- This table lets Hermes check before sending any unsolicited message
create table if not exists quiet_periods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  starts_at timestamptz default now(),
  ends_at timestamptz not null,
  reason text, -- "flow", "headsdown", "meeting", "personal", "self_requested"
  created_at timestamptz default now()
);

create index idx_quiet_active on quiet_periods(user_id, ends_at);

-- ─── Calendar events (optional, for future analytics) ────────────────────────
-- Phase 1: not used. We read from Google Calendar live. But if you want to
-- log events for weekly review analytics later, this is ready.
create table if not exists calendar_events_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  google_event_id text,
  title text,
  business text check (business in ('geo_logistics', 'nestlink', 'crownstone', 'personal')),
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  prompted_post_meeting boolean default false,
  captured_action_items integer default 0,
  created_at timestamptz default now()
);

create index idx_calendar_log_user_date on calendar_events_log(user_id, starts_at);

-- ─── Helpful views for the skills ────────────────────────────────────────────

-- Active quiet period for the user (used to gate all unsolicited pings)
create or replace view active_quiet_periods as
select * from quiet_periods
where ends_at > now()
  and user_id = '11111111-1111-1111-1111-111111111111';

-- Tasks that have been pinged but not responded to (for rate-limiting)
create or replace view recent_unanswered_pings as
select
  tf.id,
  tf.task_id,
  tf.ping_sent_at,
  tf.ping_type,
  t.description as task_description,
  extract(epoch from (now() - tf.ping_sent_at))/60 as minutes_since_ping
from task_followups tf
join tasks t on t.id = tf.task_id
where tf.response_received_at is null
  and tf.ping_sent_at > now() - interval '24 hours'
  and tf.user_id = '11111111-1111-1111-1111-111111111111';

-- Tasks that have a saved breakdown
create or replace view tasks_with_breakdowns as
select
  t.id as task_id,
  t.description,
  t.business,
  t.status,
  tb.id as breakdown_id,
  tb.steps,
  tb.total_estimated_minutes,
  tb.generated_at,
  tb.all_steps_completed_at is not null as breakdown_completed
from tasks t
join task_breakdowns tb on tb.task_id = t.id
where t.user_id = '11111111-1111-1111-1111-111111111111'
order by tb.generated_at desc;
