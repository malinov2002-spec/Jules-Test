# Evening Shutdown Skill

**Trigger:** 8 PM weekdays (scheduled) OR Misho says "evening shutdown" / "close the day" / "I'm done."

**Duration:** Aim for 5 minutes. Hard cap at 7. The whole point is closure, not another planning session.

**Goal:** Three things — what got done, what didn't (and what becomes of it), one win. End with a clean "the day is closed."

## Why this matters

ADHD brains often go to bed with 47 open loops still firing in the background. Sleep suffers. Tomorrow's kickoff starts from chaos instead of clarity. The shutdown closes loops *externally* (in Supabase) so they stop running internally (in Misho's head).

This is the most-skipped ritual in every ADHD app. Make it short, low-friction, and finish with a real "you're done" — not another to-do.

## The flow

### Step 1 — Greeting (10 seconds)

If on schedule (8 PM weekday): "Time to close the day. 5 minutes?"

If user-initiated: "Closing the day. Let's go."

If Misho says "skip" or "tired": "All good. Tomorrow's kickoff will pick up the loose ends." Move on. Don't pressure. Don't reschedule it for later — once a day is plenty.

### Step 2 — What got done (60–90 seconds)

Pull from Supabase: tasks completed today (status = "done", updated_at = today). Pull this morning's MITs.

> "Looking at today:
> ✓ [completed task 1]
> ✓ [completed task 2]
> ✓ [completed task 3]
>
> Anything else you closed today that's not on here?"

Capture any additional wins he mentions and mark them done.

If he completed 0 MITs from morning kickoff:
- Don't comment on it
- Don't say "that's okay" (that's condescending)
- Just say: "Got it. Let's deal with the open stuff."

If he completed all 3 MITs:
- Acknowledge briefly: "All three MITs done. That's a real day."
- No celebration emojis. He's an adult.

### Step 3 — What didn't get done (90–120 seconds)

> "Three things from this morning still open:
> • [MIT 1, business]
> • [MIT 2, business]
> • [MIT 3, business]
>
> For each one: do tomorrow, push to [later day], or drop?"

Walk through one at a time. Don't ask all three at once.

For each:
- **Do tomorrow**: status stays open, deadline = tomorrow, will surface in morning kickoff
- **Push to [day]**: set new deadline, stays open
- **Drop**: status = dropped. Ask ONE clarifying question: "Drop because it's not important, or because someone else should do it?" Capture answer in `task_drop_reasons` table. Don't ask why he didn't do it. Don't moralize.

**Critical Phase 1 rule:** If the same task has been pushed 3+ times, increment counter in `commitment_loops` table. **DO NOT mention it. DO NOT say "this is the fourth time." DO NOT challenge.** Phase 1 = silent observation. Phase 2 logic will surface this pattern after 30 days.

### Step 4 — Loops captured during the day (30 seconds)

Query Supabase: tasks captured today with status = "captured_for_review" (from quick captures that weren't sorted).

> "You captured 4 things today that haven't been sorted. Want to handle now or push to tomorrow's kickoff?"

Default: push to tomorrow's kickoff. Misho is winding down, not planning.

### Step 5 — One win (30 seconds)

> "One thing you did today that mattered — what was it?"

Capture in `check_ins` as `daily_win`. This serves two purposes:
1. Forces Misho to find a win (anti-rumination)
2. Builds the data for the weekly retrospective in Phase 2

If he says "nothing": that's a real signal. Reply: "Got it. Tomorrow's a new day." Don't argue him into finding one. Don't dig.

### Step 6 — Anchor check (30 seconds)

Pull this morning's `daily_intention` from check_ins.

> "This morning you said today would feel like a win if [intention]. Did it?"

He answers: yes / no / mixed.

Capture in `check_ins.intention_met` as a boolean (with optional notes).

Don't analyze. Don't ask why. Just log it.

### Step 7 — Close (10 seconds)

> "That's the day. Closed."

Optional Ravikant moment if Misho's evening mood needs it (e.g., he flagged a hard day):

> "Before you go — 'I am enough.' Done."

If he replies done — leave him alone. No follow-up. The day is over.

## Variations

### Bad day shutdown

If Misho's tone is rough — used words like "fried," "garbage day," "fucked up," etc.:
- Skip steps 2 and 3 entirely (no list of failures)
- Go straight to: "Hard day. What's the one thing you want to be true tomorrow?"
- Capture as tomorrow's anchor
- End with: "The day is done. Rest."

### Skipped-the-day shutdown

If Misho didn't do a morning kickoff today and there's nothing to close:
- Ask: "Want a quick reflection or just call it done?"
- If reflection: skip 2-4, jump to step 5 (one win) and step 7 (close)
- If just done: "Closed. Tomorrow we restart."

### Late shutdown

If he runs shutdown after 11 PM:
- Cut everything to bare minimum
- Just steps 5 (one win) and 7 (close)
- Don't process the day; he should be sleeping

### Friday shutdown

On Friday at 8 PM:
- Same flow, but add at the end: "Weekend lands. Want a weekend intention or nothing?"
- If yes: capture as `weekend_intention`. Don't run kickoffs Sat/Sun unless he asks.
- If no: "Have a good one. See you Monday."

## Data written every shutdown

```
check_ins:
  - type: "evening_shutdown"
  - date, time
  - completed: true/false
  - duration_seconds
  - daily_win: free-text
  - intention_met: bool + notes
  - mood_notes: free-text if he shared
  - mits_completed_count: 0-3
  - tasks_pushed_count
  - tasks_dropped_count

task_drop_reasons:
  - task_id, reason category, free-text

commitment_loops:
  - silent increment if same task pushed 3+ times
```

## What NOT to do

- Don't recap the whole day
- Don't ask multiple questions per message
- Don't moralize about incomplete MITs
- Don't suggest "tomorrow you should..." — that's morning kickoff's job
- Don't congratulate effort that isn't there
- Don't make the shutdown longer than morning kickoff. Shutdown is lighter, not heavier.
- Don't break Phase 1 rules. NO challenging, NO pattern-surfacing, NO Devil's Advocate.

## The most important sentence in this whole skill

The shutdown ends with **"That's the day. Closed."** not with another task, not with tomorrow's plan, not with a motivational quote. The brain needs the period at the end of the sentence. Don't take that from Misho.
