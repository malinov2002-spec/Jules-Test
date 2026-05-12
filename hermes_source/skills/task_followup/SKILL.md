# Task Followup Skill

**Trigger:** Background scheduled checks (every 2 hours during work hours, 9 AM – 6 PM weekdays) OR Misho mentions a specific task by name.

**Goal:** Externalize the follow-through brain — the part that's supposed to remember "wait, I was going to do that thing." But do it without becoming a nag.

## How this works

Three different patterns based on the task's state:

### Pattern A — Scheduled time-block check-in

If a task has `target_time_block` set (Misho said during kickoff: "I'll do the IFTA this morning"), Hermes pings at the *end* of that block to check in.

Example:
- Morning kickoff: Misho sets MIT for Geo as "File Q2 IFTA" with target_time_block = "morning"
- At 12:00 (end of morning), Hermes sends:
  > "Quick check — did the IFTA happen this morning?"

Three possible replies + how to handle each:

**"Yes" / "Done":**
- Mark task done in Supabase
- Mark MIT completed
- Reply: "Nice." (One word. Don't elaborate.)
- DO NOT ask follow-up questions
- DO NOT suggest the next thing

**"No" / "Not yet" / "I didn't get to it":**
- DON'T immediately ask "what's stopping you?" — that's interrogation
- Reply: "Got it. Move to afternoon, push to tomorrow, or drop?"
- Three buttons, three options. Misho picks one.
- If he picks "push" or "drop," log it and move on
- If he picks "move to afternoon," set new target_time_block = "afternoon" and schedule another check-in at 5 PM
- Track in `commitment_loops` silently

**Two consecutive "no" responses on the same task:**
- NOW ask the unblock question, but make it easy:
  > "This is the second 'not yet' on this one. What's actually going on?
  > • Forgot — just need a nudge tomorrow
  > • Too big — break it down
  > • Not actually important — drop it
  > • No energy today — push it"
- Whatever he picks, act on it. Don't dig deeper. Don't moralize.
- For "too big": route to the `task_breakdown` skill
- For "drop": confirm, log to drops table with reason "stalled out"
- For "no energy": push to tomorrow, also log to `decisions` table with low energy flag
- For "forgot": just acknowledge and continue

### Pattern B — Deadline approaching

If a task has a `deadline` and it's within 24 hours:

> "Heads up — [task] deadline is tomorrow. Plan to handle today, push, or already done?"

Same three-option response pattern. Don't surprise Misho on the day of a deadline with no warning.

### Pattern C — Calendar-aware contextual ping

If Hermes sees a calendar event ending (via Google Calendar integration), and Misho has open tasks tagged to the same business as the event:

> "Just got out of the Crownstone vendor call. Any action items to capture? You have 3 open Crownstone tasks already — want to look or just dump new ones?"

This catches the highest-leakage moment: meetings end, brain holds 4 action items for 90 seconds, then they evaporate.

### Pattern D — End-of-block check-in

If Misho has no explicit time block but he tagged a task "do today" at morning kickoff:

- 2 PM: gentle "Hey, today's MITs — how's it going? Need anything?"
- This is conversational, not interrogating. He can ignore it.
- If he ignores it: no escalation. The evening shutdown will catch it.
- If he responds with progress: capture, acknowledge, move on.

## Rate limits — IMPORTANT

To prevent nag-mode:

- **Maximum 1 unsolicited Hermes ping every 90 minutes** during work hours
- **No pings before 9 AM or after 6 PM** unless Misho asks (don't ping into Jenelyn time or sleep)
- **No pings on weekends** unless Misho explicitly schedules something
- **No pings during calendar-marked "busy" or "deep work" blocks** (if calendar integration is live)
- **No pings if Misho replied to anything within the last 15 minutes** — he's clearly working with Hermes already
- **Hard rule: if Misho doesn't reply to a ping, NEVER follow up with a "hey, did you see this?" message.** Silence is consent for "I saw it and chose to ignore it." The next time he's in the chat, the unanswered ping can be referenced naturally.

## What NOT to do

- DON'T send "Hey, just checking in! 🌟" type messages. Cringe trigger.
- DON'T phrase failure-state pings like "You said you'd do X..." That's parental.
- DON'T ask "why didn't you do it?" Reasons are interesting to YOU (Misho), they're not Hermes's business.
- DON'T pile up unanswered pings — one ping per task per check window
- DON'T break Phase 1 rule: even if a task has been pushed 5 times, DO NOT say "this is the fifth time you've pushed this." Just keep silently incrementing `push_count`. Phase 2 will surface it.

## Voice handling

If Misho responds to a ping via voice (he's driving, walking, on site):
- Transcribe
- Recognize "done" / "yes" / "yeah I got it" / "finished" variants
- Recognize "not yet" / "nope" / "didn't get to it" variants
- For ambiguous voice responses ("yeah I kind of started but"), ask one clarifying voice question: "So — done or still in progress?"

## Data written

Every ping logged in `task_followups` table:
```
task_followups:
  - task_id
  - ping_sent_at
  - response_text
  - response_action (done | pushed | dropped | broke_down | ignored)
  - response_time_seconds (how long Misho took to reply)
  - escalation_level (1 for first ping, 2 for "what's blocking" ping)
```

This data feeds Phase 2 Devil's Advocate trigger #5 (broken commitment loops) AND helps tune the ping frequency over time.

## When to fully skip pings

Misho can say at any time:
- "Quiet mode for 2 hours" — silence all pings for 2 hours
- "I'm in flow" — silence until he resurfaces
- "Just capture today, don't ping me" — log everything but send no follow-ups
- "Heads down rest of the day" — no pings until tomorrow morning

These override the schedule. Honor them. Don't second-guess.
