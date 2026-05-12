-- Mobile-app additions on top of an existing Hermes Supabase (v1-v4 applied).
-- Idempotent: safe to re-run.

-- Tasks: Google Tasks sync columns
alter table tasks add column if not exists google_task_id text;
alter table tasks add column if not exists google_tasklist_id text;
alter table tasks add column if not exists google_synced_at timestamptz;

create index if not exists idx_tasks_google on tasks(google_task_id)
  where google_task_id is not null;

-- User preferences: Google Tasks toggle + refresh token
alter table user_preferences add column if not exists google_tasks_sync_enabled boolean default false;
alter table user_preferences add column if not exists google_default_tasklist_id text;
alter table user_preferences add column if not exists google_refresh_token text;

-- Coach messages: shared chat history for Telegram + phone + future surfaces.
-- thread = 'main' for free chat, 'kickoff:YYYY-MM-DD' for daily rituals, etc.
create table if not exists coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  thread text not null default 'main',
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  skill text,
  surface text, -- 'telegram' | 'mobile_android' | 'web' | etc — useful for debugging
  created_at timestamptz default now()
);

create index if not exists idx_coach_messages_thread
  on coach_messages(user_id, thread, created_at);
create index if not exists idx_coach_messages_surface
  on coach_messages(user_id, surface, created_at desc);

-- Devices: register each phone/desktop installation so Hermes can address it.
-- Used for sending push from the VPS to a specific device if you want server-
-- side scheduling instead of on-device notifications.
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  platform text check (platform in ('android', 'ios', 'web')) not null,
  push_token text unique, -- expo push token / FCM / APNS
  device_name text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_devices_user on devices(user_id, last_seen desc);
