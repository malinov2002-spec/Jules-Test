# Phase 1: Hermes ADHD Coach Setup

This is your weekend setup. By Sunday night you should have a working ADHD coach you talk to via Telegram, running on a $5 VPS, with persistent memory in Supabase. Total cost: ~$10/month VPS + LLM API usage (probably $5-20/month for personal use).

## What this gets you (and what it doesn't)

**Gets you:**
- Voice or text capture from anywhere via Telegram (works on phone, desktop, anywhere)
- AI that classifies what you say into Geo Logistics / NestLink / Crownstone / Personal
- 7 AM morning kickoff message every weekday — picks your MITs with you
- 8 PM evening shutdown — closes the day, prevents loops
- Persistent storage in Supabase so nothing gets lost
- A coach voice tuned for ADHD entrepreneur context, not generic productivity bullshit

**Does NOT get you (yet):**
- Devil's Advocate / Challenge Mode (this is Phase 2 — 30 days from now)
- Visual dashboard, calendar view, or any UI beyond Telegram
- Midday refocus, weekly review, body-double sessions (these come after Phase 1 proves itself)
- Multi-user / shareable version

**This is intentional.** Phase 1's job is to prove the core loop works for you. Don't add anything until you've used it for 30 days.

## The four files you need

1. `setup.md` — step-by-step weekend setup (VPS, Hermes install, Telegram, Supabase)
2. `config/config.yaml` — Hermes configuration
3. `config/system_prompt.md` — the coach's personality and rules
4. `skills/` — three skills that define what the coach actually does:
   - `morning_kickoff/SKILL.md`
   - `quick_capture/SKILL.md`
   - `evening_shutdown/SKILL.md`
5. `supabase/schema.sql` — database schema for tasks, decisions, check-ins
6. `supabase/tool.py` — the custom Hermes tool that talks to Supabase

## The deal you're making with yourself

You said you'd be open and honest with the system. That starts now:
- When you skip a kickoff, tell it why. Don't ghost it.
- When you capture a task at 11 PM that you know you won't do, capture it anyway — let the data accumulate so the system learns your patterns.
- When the coach asks "how did yesterday actually go?" — answer truthfully, not aspirationally.

The system learns nothing from the version of you that has it all together. It learns from the real one.

## Order of operations this weekend

1. **Saturday morning (1 hr):** spin up VPS, install Hermes, get the CLI working
2. **Saturday afternoon (1 hr):** set up Supabase project, run schema
3. **Saturday evening (30 min):** create Telegram bot, connect Hermes gateway
4. **Sunday morning (1 hr):** drop in the three skills, configure system prompt, test morning kickoff
5. **Sunday evening:** run a real evening shutdown for the first time

If you hit a wall, stop, message me back with where you got stuck. Don't burn 6 hours debugging — that's the ADHD trap. Phase 1 should feel light.

## Then what

Use it for 30 days. Just use it. Don't tweak it. Don't add features. Don't switch models. Don't redesign the prompts mid-stream.

At day 30, we look at the Supabase data together and decide:
- Did the morning kickoff actually happen most days?
- Did capture-anywhere actually solve "I forget tasks"?
- Did evening shutdown actually close loops, or did you skip it?
- What's the real gap that Phase 2 needs to fill?

Then Phase 2 either adds Devil's Advocate to Hermes, or migrates to Flask/Supabase if you've outgrown the messaging UX. Decision based on data, not vibes.
