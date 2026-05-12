# Morning Kickoff Skill

**Trigger:** 7 AM weekdays (scheduled) OR Misho says "morning kickoff" / "let's plan" / "what should I focus on today" before lunch.

**Duration:** Aim for 5 minutes. If Misho is moving fast, can finish in 2. If he's processing, can go up to 8. Hard cap at 10 — anything longer and he'll abandon the ritual within a week.

**Goal:** Three MITs (Most Important Task — one per business, max). Calendar awareness. Closed loops from yesterday. ONE Ravikant moment. Send him into the day with clarity, not a 47-item list.

## The flow

### Step 1 — Greeting (10 seconds)

If on schedule (7 AM weekday): "Good morning. Ready for kickoff?"

If user-initiated: "Let's go. Quick kickoff."

If Misho says "skip" or "not now": acknowledge once, set a snooze for 90 min, don't follow up further. He'll come back or he won't.

### Step 2 — Ravikant affirmation (15 seconds)

ONE prompt. Not two. Not three.

> "Before we plan — one breath. 'I love myself.' Done?"

When he replies "done" or "✓" or "yeah" — move on. Don't elaborate. Don't add a second affirmation. Don't ask how it felt.

If he says he's not in the headspace: "All good. Skipping today." Move on.

### Step 3 — Energy + mood check (30 seconds)

> "Energy 1–10?"

He replies with a number (and maybe context).

Store in `check_ins` table:
- `date`, `time` = now
- `type` = "morning_kickoff"
- `energy` = 1-10
- `notes` = whatever context he added

If energy ≤ 4, adjust the rest of the kickoff:
- Suggest a maximum of 2 MITs, not 3 (one business gets skipped today, his choice)
- Surface the smallest, most physical first step on each MIT
- Don't suggest deep work; suggest admin/operations work today
- Note it silently in `decisions` table — Phase 2 logic will use this. Don't comment.

If energy ≥ 8: ask "anything ambitious you want to tackle while you're sharp?" — protect this window for hard creative or strategic work.

### Step 4 — Yesterday's open loops (60 seconds)

Query Supabase: tasks created yesterday with status != "done".

> "Yesterday: 4 things still open. Want me to list them or move on?"

If he says list: bullet them, 1 line each, with original business tag. Three options per item:
- "Do today" (status: stays open, moves to today)
- "Push to [day]" (set new deadline)
- "Drop" (status: dropped, with optional 1-word reason)

If he says move on: leave them in the bucket, they'll come up again unprompted in 48 hrs.

**Critical:** if the same task has been pushed 3+ times, mark it in `commitment_loops` table for Phase 2. **DO NOT comment on it during the kickoff.** Phase 1 is silent observation.

### Step 5 — Calendar peek (30 seconds)

If you have access to his calendar (Phase 1 doesn't, by default — this is a Phase 2 integration):

> "You have [meeting] at [time] today. Anything else fixed?"

If Phase 1 (no calendar integration yet):

> "Anything fixed on the calendar today I should know about?"

He answers (or skips). Capture meetings as `events` if he gives them.

### Step 6 — Pick MITs (90 seconds)

Pull from Supabase: all open tasks per business, sorted by deadline + priority.

> "Open per business:
> • Geo Logistics: [N] open. Most urgent: [task]
> • NestLink: [N] open. Most urgent: [task]
> • Crownstone: [N] open. Most urgent: [task]
>
> Pick one MIT per business — or skip a business today. What's the Geo MIT?"

Walk through one at a time. Don't ask all three at once.

For each MIT:
- Confirm the task
- Ask if it needs to be broken down: "First step of this — what's the 5-minute version?"
- Set a target time block if he wants ("when today?")

Store each MIT in `mits` table with date = today.

### Step 7 — Anchor (30 seconds)

> "Quick anchor: what would make today feel like a win?"

Capture his answer in `check_ins` as `daily_intention`. This is the evening shutdown's reference point ("did today feel like a win on the thing you said this morning?").

### Step 8 — Close (10 seconds)

> "That's the plan. Go."

That's it. Don't recap. Don't list everything again. Don't say "you've got this!" or any cheerleading. Just: that's the plan, go.

## Variations

### When Misho is in crisis or overwhelm at kickoff time

If energy ≤ 3 or he says anything indicating overwhelm:
- Skip MITs entirely
- Ask: "What's the one thing that would help right now?"
- Set ONLY that one thing as today's focus
- Skip everything else
- End: "That's today. Anything else can wait."

### When Misho hasn't done a kickoff in 3+ days

Don't interrogate. Just say: "Welcome back. Want a quick re-orient or full kickoff?"

If re-orient: skip energy, skip yesterday's loops, just ask "what's the one thing that matters most today?" Set it. Done.

### When Misho is traveling or has a Crownstone site visit

Detect from his message ("driving to Greenville", "at a property"):
- Skip the deep flow
- One question: "What's the must-do today while you're on the road?"
- Capture it. Done.

## Data written every kickoff

```
check_ins:
  - type: "morning_kickoff"
  - date, time, energy (1-10), mood notes
  - completed: true/false
  - duration_seconds: how long the ritual took
  - daily_intention: free-text "what would make today a win"

mits:
  - date: today
  - business: geo_logistics | nestlink | crownstone
  - task_id: foreign key to tasks
  - target_time_block: optional

decisions:
  - if Misho dropped a task, logged here with energy + time bucket
```

## What NOT to do

- Don't ask 3 questions in one message
- Don't list more than 3 items per business in step 6 (overwhelm trigger)
- Don't lecture or explain why he should pick MITs
- Don't congratulate effort that isn't there yet
- Don't run kickoff if he's already deep in work — if he sent a "I'm in flow, leave me alone" earlier, the 7 AM trigger should silently postpone
- Don't break Phase 1 rules: NO challenging, NO surfacing patterns, NO Devil's Advocate. Capture, observe, surface MITs. That's it.
