# Hermes Mobile

Misho's ADHD coach as an Android app. Brings the original Hermes/Telegram coach
into a phone-native experience: morning kickoff, quick capture, evening
shutdown, all backed by Supabase, with optional Google Tasks sync so the same
list shows up in Google Tasks / Tasks-on-Android-home / Wear OS.

Built with Expo (React Native + TypeScript). Single-user, runs on your own
device with your own API keys.

## What's in here

```
app/                            Expo Router screens (Android phone app)
src/lib/                        Supabase, Anthropic, Google Tasks, notifications
src/coach/                      Coach prompt, skill primers, runner, gateway client
src/components/                 Reusable UI bits
vps_gateway/                    FastAPI sidecar that runs next to hermes-gateway
supabase/schema.sql             Fresh Supabase schema (combined v1-v4)
supabase/migration_mobile.sql   Migration if you already have v1-v4 applied
hermes_source/                  Original Hermes/Telegram bot files (reference)
docs/SETUP.md                   Phone app setup
vps_gateway/SETUP.md            VPS sidecar setup
```

## Two deployment modes

**Direct mode** (no VPS work):
phone → Anthropic API → Supabase. Standalone, useful for quick prototyping.

**Gateway mode** (recommended once your VPS is up):
phone → VPS FastAPI sidecar → Anthropic API → Supabase.
Telegram bot and phone share the same coach brain, same chat history, same
skill files. Edit `~/.hermes/skills/morning_kickoff/SKILL.md` once and both
surfaces pick up the change.

```
   ┌──────────┐    ┌──────────┐
   │ Telegram │    │  Phone   │
   └────┬─────┘    └────┬─────┘
        │               │ HTTPS POST /coach
        ▼               ▼
   ┌─────────────────────────────┐    ┌──────────────┐
   │ hermes-gateway              │───▶│ Anthropic    │
   │ + hermes-coach-gateway      │    └──────────────┘
   │   (FastAPI, this repo)      │
   └──────────┬──────────────────┘
              │
              ▼
         ┌──────────┐
         │ Supabase │
         └──────────┘
```

## Quick start

If you already have Hermes running on a VPS (Telegram bot, Supabase, the works):

1. Run `supabase/migration_mobile.sql` in Supabase SQL Editor
2. Deploy the VPS sidecar: [`vps_gateway/SETUP.md`](vps_gateway/SETUP.md)
3. `npm install` on your laptop, `cp .env.example .env`, fill in
   `EXPO_PUBLIC_GATEWAY_URL` and `EXPO_PUBLIC_GATEWAY_TOKEN`
4. `npx expo start --android`, scan QR with Expo Go

Starting fresh (no VPS yet): [`docs/SETUP.md`](docs/SETUP.md) walks the direct mode.

## How it differs from the original Hermes

- **No Telegram, no VPS, no cron.** Notifications are local on the phone.
- **AI calls go straight from the device** to the Anthropic API (acceptable
  for a single-user personal app — proxy through a backend if you ever share).
- **Google Tasks integration** lets the to-do list live in your existing
  Google ecosystem; the app is the "smart capture" layer on top.
- **Same Supabase schema** — all tasks, MITs, check-ins, decisions, and
  patterns are stored in the same shape as the original, so any analytics or
  Phase 2 plans you had still work.

## Phase boundaries

This is Phase 1: capture, surface, run rituals, log silently. The coach does
NOT challenge late-night decisions or surface shiny-object patterns yet —
that's intentional, per the original coach design. After 30 days of real
data, flip on Phase 2 by editing `src/coach/systemPrompt.ts` and
`src/coach/skills.ts`.
