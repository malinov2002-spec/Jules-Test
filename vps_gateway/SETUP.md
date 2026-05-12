# VPS Coach Gateway — Setup

A small FastAPI sidecar that runs next to your existing `hermes-gateway`
systemd service. It reads the same `~/.hermes/system_prompt.md` and skill
files, writes to the same Supabase, uses the same Anthropic key. The phone
app talks to this, not to Anthropic directly.

You install this once. ~20 minutes.

## Why

- **Single coach brain.** Edit `~/.hermes/skills/morning_kickoff/SKILL.md` →
  both Telegram and phone use the new version on their next call.
- **Anthropic key stays on the VPS.** The phone holds only a gateway token.
- **Shared chat history** in the `coach_messages` table — Telegram threads
  show up on the phone Coach screen and vice versa.
- **Ritual dedup.** If you do morning kickoff on Telegram, opening it on the
  phone says "you already did this on Telegram" and short-circuits.

## 0. Run the migration

Open the Supabase SQL Editor and run `supabase/migration_mobile.sql` from
this repo. Adds Google Tasks sync columns to `tasks`, `coach_messages`
table, `devices` table. Idempotent.

## 1. Install on the VPS

SSH into your Hermes VPS (the same box `hermes-gateway` runs on):

```bash
sudo mkdir -p /opt/hermes_mobile
sudo chown -R $USER:$USER /opt/hermes_mobile
cd /opt/hermes_mobile

# Clone this repo (or rsync just the vps_gateway/ dir)
git clone https://github.com/malinov2002-spec/Jules-Test.git .
git checkout claude/mobile-app-todo-integration-gIITL

python3 -m venv .venv
source .venv/bin/activate
pip install -r vps_gateway/requirements.txt
```

## 2. Configure

```bash
cp vps_gateway/.env.example vps_gateway/.env
# Open the file and fill in:
#  HERMES_ROOT=/root/.hermes              (or wherever ~/.hermes lives)
#  SUPABASE_URL=...                       (same as Hermes uses)
#  SUPABASE_SERVICE_KEY=...               (service-role, not anon)
#  ANTHROPIC_API_KEY=...                  (same key Hermes uses)
#  GATEWAY_TOKEN=<long random string>     (e.g. `openssl rand -hex 32`)
nano vps_gateway/.env
```

> If your Hermes uses OpenRouter (the original config.yaml does), set
> `OPENROUTER_API_KEY` instead of `ANTHROPIC_API_KEY`. The gateway picks
> whichever is set.

## 3. Run as a service

```bash
sudo cp vps_gateway/hermes-coach-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-coach-gateway
sudo systemctl status hermes-coach-gateway
```

Tail logs:

```bash
sudo journalctl -u hermes-coach-gateway -f
```

## 4. Expose via reverse proxy

The service binds to `127.0.0.1:8787` so the open internet can't hit it
directly. Put nginx or Caddy in front for TLS:

**Caddy** (`/etc/caddy/Caddyfile`):

```
coach.your-domain.com {
    reverse_proxy 127.0.0.1:8787
}
```

```bash
sudo systemctl reload caddy
```

## 5. Smoke test

From your laptop:

```bash
# Health (no auth required)
curl https://coach.your-domain.com/health

# Coach call (auth required)
curl -X POST https://coach.your-domain.com/coach \
  -H "Authorization: Bearer <GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"thread":"smoke","skill":"free_chat","message":"ping","surface":"cli"}'
```

You should get back a JSON `{"text": "...", "actions": [], "skipped": false}`.

## 6. Point the phone app at it

In the phone app's `.env` (the one you `cp`'d from `.env.example` at the
repo root for the Expo app):

```
EXPO_PUBLIC_GATEWAY_URL=https://coach.your-domain.com
EXPO_PUBLIC_GATEWAY_TOKEN=<same GATEWAY_TOKEN as the VPS .env>
# Leave EXPO_PUBLIC_ANTHROPIC_API_KEY empty
```

Restart `npx expo start --android` to pick up the new env. From now on the
phone calls your VPS, not Anthropic.

## 7. Editing skills live

Edit any `~/.hermes/skills/*/SKILL.md` or `~/.hermes/system_prompt.md`, then:

```bash
curl -X POST https://coach.your-domain.com/reload \
  -H "Authorization: Bearer <GATEWAY_TOKEN>"
```

The next phone or Telegram request reads the new file. (Hermes itself
already hot-reloads on the Telegram side — this just keeps the sidecar in
sync.)

## 8. Ritual dedup

The gateway checks `check_ins` before running a kickoff or shutdown. If
today's was already completed on another surface, you get a short reply
("you already did this on telegram") instead of the full ritual.

For the Telegram side to respect the same rule, add this snippet to the
top of `~/.hermes/skills/morning_kickoff/SKILL.md` and the equivalent in
`evening_shutdown/SKILL.md`:

```
## Dedup check (first thing)
Before greeting Misho, query `check_ins` for today + type=morning_kickoff.
If a row exists with `completed = true` and the most recent coach_messages
row for skill=morning_kickoff has surface != 'telegram', reply:
"Already did kickoff on the phone. Want a free chat?" and stop.
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `curl /health` connects but `/coach` returns 401 | Authorization header isn't `Bearer <token>` or token doesn't match `.env`. |
| `RuntimeError: system_prompt.md not found at /root/.hermes/system_prompt.md` | `HERMES_ROOT` is wrong. Set to wherever the Telegram bot reads its config from. |
| `Action failed: duplicate key value violates unique constraint` on `devices` | Two devices registered with the same Expo push token. The push_token column is `unique`; pick a new install or delete the old row. |
| Logs show 401 from Anthropic | Wrong / expired key. Update `vps_gateway/.env` and `systemctl restart hermes-coach-gateway`. |
| Skill changes don't take effect | Hit `/reload` or restart the service. |

## Security note

`GATEWAY_TOKEN` is a static bearer token, which is fine for a single user
on one phone. If you ever expose this to more devices or share with someone,
swap it for a proper OAuth flow or a rotating signed-JWT scheme.
