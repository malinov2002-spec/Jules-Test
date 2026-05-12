# Integrating with your existing VPS Hermes

You already have Hermes Phase 1 running on a VPS — Telegram bot, Supabase,
the scheduled morning/evening rituals. This doc tells you exactly what to do
to bring the phone app online without breaking anything that's working.

## Order of operations

### 1. Migrate Supabase (3 min)

Open the Supabase SQL Editor in the project Hermes already uses. Paste in
`supabase/migration_mobile.sql` and run it.

What this adds:
- `tasks.google_task_id`, `google_tasklist_id`, `google_synced_at`
- `user_preferences.google_tasks_sync_enabled`, `google_default_tasklist_id`, `google_refresh_token`
- New table `coach_messages` (shared chat history across surfaces)
- New table `devices` (Expo push tokens; for future server-side notifications)

Idempotent — safe to re-run.

### 2. Deploy the VPS sidecar (20 min)

SSH into the VPS Hermes already runs on. Follow
[`vps_gateway/SETUP.md`](../vps_gateway/SETUP.md). Summary:

```bash
sudo mkdir -p /opt/hermes_mobile && sudo chown -R $USER:$USER /opt/hermes_mobile
cd /opt/hermes_mobile
git clone https://github.com/malinov2002-spec/Jules-Test.git .
git checkout claude/mobile-app-todo-integration-gIITL
python3 -m venv .venv && source .venv/bin/activate
pip install -r vps_gateway/requirements.txt
cp vps_gateway/.env.example vps_gateway/.env
nano vps_gateway/.env       # fill in
sudo cp vps_gateway/hermes-coach-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-coach-gateway
```

Add a Caddy/nginx reverse proxy with TLS pointing `coach.your-domain.com`
at `127.0.0.1:8787`.

### 3. Update skill files for dedup (5 min)

So Telegram respects when you ran the kickoff on the phone (and vice versa),
prepend this snippet to `~/.hermes/skills/morning_kickoff/SKILL.md`:

```
## Dedup check (run before greeting)

Before Step 1, query the coach_messages table for today's most recent row
where skill = 'morning_kickoff'. If the surface is different from the
current surface AND check_ins shows today's morning_kickoff completed=true,
reply: "Already did kickoff on [other surface]. Want a free chat instead?"
and stop. Otherwise proceed to Step 1.
```

Same idea in `evening_shutdown/SKILL.md` with skill = 'evening_shutdown'.

The phone-side gateway already does this check in code; this snippet teaches
the Telegram-side skill to do it too.

### 4. Bring up the phone (10 min)

On your laptop, in this repo:

```bash
npm install
cp .env.example .env
nano .env
```

Set:
```
EXPO_PUBLIC_SUPABASE_URL=<same as VPS>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<from Supabase Settings → API>
EXPO_PUBLIC_GATEWAY_URL=https://coach.your-domain.com
EXPO_PUBLIC_GATEWAY_TOKEN=<same value as VPS GATEWAY_TOKEN>
EXPO_PUBLIC_USER_ID=11111111-1111-1111-1111-111111111111
```

Leave `EXPO_PUBLIC_ANTHROPIC_API_KEY` empty — the VPS holds the key now.

Install **Expo Go** on your Android phone, then:

```bash
npx expo start --android
```

Scan the QR. App loads. Open **Settings** — "Coach backend" should show
`Gateway → coach.your-domain.com` in green.

### 5. Smoke test the integration

1. **From the phone**, tap Coach → send "hello". You should get a reply.
   Check Supabase `coach_messages` — there should be 2 new rows with
   `surface = 'mobile_android'`.
2. **From Telegram**, send "hello". Reply comes back. Supabase has 2 more
   rows with `surface = 'telegram'`.
3. **From the phone**, tap Coach again. The previous Telegram conversation
   should be in the chat history. (Both surfaces read the same thread.)
4. **Dedup test**: do a morning kickoff via Telegram, complete it. Then
   tap Morning kickoff on the phone. You should get a short "already did
   this on telegram" message, not a fresh ritual.

### 6. Turn off any duplicate scheduling (optional)

The original Hermes config has cron entries for 7 AM kickoff and 8 PM
shutdown via Telegram. The phone app also schedules local notifications
at the same times. That means you'll get pinged twice each day.

Two options:

**Option A — Phone notifies, Telegram doesn't.** Edit
`~/.hermes/config.yaml`, set `scheduled_tasks: []` (or comment them out),
`sudo systemctl restart hermes-gateway`. The phone takes over scheduling.

**Option B — Telegram notifies, phone doesn't.** In the phone app,
Settings → Cancel under Daily rituals. The Telegram cron stays in charge.

**Option C — Both, with dedup.** Keep both. The dedup check in step 3
makes whichever you respond to "win" for that day. The other surface gets
a "already did this" reply and exits.

I'd start with **Option C** for the first week — see which surface you
actually engage with — then collapse to whichever you used more.

## What you should NOT do

- Don't try to modify `hermes-gateway` itself. The sidecar is a peer
  service that reads the same files; you don't have to fork Hermes.
- Don't put the `SUPABASE_SERVICE_KEY` on the phone. The phone uses the
  anon key. Service key lives only on the VPS.
- Don't disable the existing Telegram bot until you've used the phone app
  for a few days and confirmed it works. Keep it warm as a fallback.

## Quick reference

| What | Where it runs | What it reads | What it writes |
| --- | --- | --- | --- |
| `hermes-gateway` (existing) | VPS systemd | `~/.hermes/*` | Supabase |
| `hermes-coach-gateway` (new) | VPS systemd | `~/.hermes/*` (same files) | Supabase + coach_messages |
| Phone app | Your Android phone | Supabase + VPS gateway | Supabase via gateway |

When you edit a skill file: hit `/reload` on the VPS gateway, or restart
the service. Hermes's own Telegram side already hot-reloads.
