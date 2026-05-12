# Hermes Mobile

Misho's ADHD coach as an Android app. Brings the original Hermes/Telegram coach
into a phone-native experience: morning kickoff, quick capture, evening
shutdown, all backed by Supabase, with optional Google Tasks sync so the same
list shows up in Google Tasks / Tasks-on-Android-home / Wear OS.

Built with Expo (React Native + TypeScript). Single-user, runs on your own
device with your own API keys.

## What's in here

```
app/                      Expo Router screens
src/lib/                  Supabase, Anthropic, Google Tasks, notifications
src/coach/                Coach prompt + skill primers + action runner
src/components/           Reusable UI bits
supabase/schema.sql       Combined v1-v4 schema, idempotent
hermes_source/            Original Hermes/Telegram bot files (reference)
docs/SETUP.md             Step-by-step setup
```

## Quick start

1. `npm install`
2. `cp .env.example .env` and fill in Supabase, Anthropic, Google client IDs
3. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor
4. `npx expo start --android` and scan the QR with Expo Go on your phone

Full walkthrough: [`docs/SETUP.md`](docs/SETUP.md).

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
