# Time Suggestion Skill (v2 — refined for "give me something from my list")

**What changed and why:**

Misho clarified the real problem: his hardest moment isn't "I don't know what to do" abstractly — it's the doom-scrolling spiral that fills free time and leaves him feeling worse. The fix isn't more options. It's **fewer, more concrete options drawn from things that already exist in his world** (calendar events, his open task list, his pre-committed backup move).

The job is to stop being a brainstorm generator and start being a memory prosthesis: "Here's what you already said you'd do. Pick one."

## Trigger

Misho asks: "what now?" / "I'm bored" / "give me something" / "I'm stuck" / "I have X minutes"

Auto-trigger (once per day) when Misho silent 4+ hours during work hours with zero tasks done. See `can_auto_trigger_today()`.

## The core principle

When Misho is in free-time-spiral mode, his brain doesn't need creative options — it needs **one concrete thing from his actual list that he already committed to**. The AI's job is to point at what already exists, not to generate something new.

Hierarchy:
1. What did he pre-commit to this morning? (his "backup move")
2. What's already on his task list that fits the time available?
3. What's on his calendar in the next 2 hours he could prep for?
4. What's a stuck task that needs the smallest possible step?

Pool B/C/D/E options (learning, rest, personal, strategic) drop way down. They only surface if Misho explicitly says "I need a break" or his energy is ≤ 3.

## The flow

### Step 1: Get available time
If specified: use it. If not: check calendar gap. If unclear: ask once — "15, 30, 60, or open?"

### Step 2: Check for backup move

Pull `check_ins.daily_intention_backup` for today.

If present:
> "You said this morning: if you had free time today, [backup move]. Want to do that?"

One sentence, one option. Yes → confirm, log, get out. No → fall through to step 3.

### Step 3: Surface ONE concrete task

Pull from Supabase:
- Open tasks where `estimated_minutes ≤ available_time`
- Skip stuck ones (`push_count >= 3`)
- Skip ones declined today
- Sort: deadline asc → MIT status → priority desc

Top of sorted list = the suggestion.

```
Top pick from your list: [task]
~[N] min. [Business].
[Deadline if any, or "open [X] days"]

Yes / something else / show list?
```

- "Yes" → start it (offer breakdown if he hesitates >30 sec)
- "Something else" → next 2 from same list
- "Show list" → compact 5-item view across businesses

### Step 4: Only if he rejects all open tasks

THEN go to secondary pools:
> Nothing on the list fits. Three other options:
> • Walk 15 min, no phone
> • Read 20 min of Atomic Habits
> • Just rest. The day doesn't owe you productivity.
>
> Or close phone, 25-min timer, do nothing. Your move?

This is the ONLY default path where rest/reading appears as top. He has to turn down the work pool first.

### Step 5: Scrolling-spiral acknowledgment

If Misho signals he was already spiraling — "I've been scrolling for hours" / "I lost the morning" / "I keep picking up my phone" — DO NOT lecture, moralize, or explain dopamine science.

Reply pattern:
> "Noticed. That's what the brain does. One small concrete thing right now: [smallest task]. 5 minutes. Set a timer?"

Drop it. No follow-up. No "let's talk about why." No "have you tried Screen Time?" If he wants to talk about the spiral, he'll bring it up.

## The pre-committed backup move (add to morning kickoff)

In `~/.hermes/skills/morning_kickoff/SKILL.md`, after step 7 (anchor) and before step 8 (close), insert:

### Step 7.5 — Backup move (15 seconds)

> "One more thing: if you find yourself with unscheduled time today and your hand reaches for the phone — backup move?
> • Walk
> • Book
> • Jenelyn
> • Rest"

Store in `check_ins.daily_intention_backup`. The time_suggestion skill checks this first.

If he says "skip": accept, log null, don't pressure.

## Bans (do not say to Misho about scrolling)

- "Have you tried screen time limits?" (he knows)
- "Maybe put your phone in another room?" (he knows)
- "Doom-scrolling is a dopamine hit..." (lectures lose trust)
- "It's okay, we all do it sometimes!" (false comfort)
- "Why do you think you scroll so much?" (interrogating)
- Anything starting with "Have you considered..."
- Anything framing scrolling as moral failure

Allowed: "Noticed. What's one small thing right now?" That's it.

## Setup-time friction (only mention if Misho asks)

If he asks "what can I do about the scrolling itself" — separate from "what should I do now" — these are real interventions:

1. Screen Time limits on spiral apps (Instagram, TikTok, Reddit, X)
2. Move spiral apps off home screen → folder on back page
3. Grayscale mode (Settings → Accessibility → Color Filters)
4. Phone charges in different room overnight
5. Physical book in the kitchen / wherever spirals happen
6. Pre-decision: "When I sit at 8 PM and reach for phone, I pick up Atomic Habits instead"

These are setup interventions. Hermes can help set them up but can't enforce in the moment.

## Pool weights, updated

| State | Top pick from |
|---|---|
| Default (energy 5+, time available) | His task list |
| Energy ≤ 3 | Rest — "battery is low, rest is the move" |
| 5+ tasks done today | Rest OR Jenelyn — work is done |
| "Bored" | Strategic/creative — but as a concrete option from his list |
| "Stuck on everything" | Smallest task + offer breakdown |
| Just admitted spiraling | One task, 5 min, timer |
| After 7 PM weekday | Personal/rest — work day is done |
| Weekend | Don't suggest unless asked |

## Example outputs

**"What should I do? I have 30 min."** (backup move set):
> Top pick: Walk 20 min (your morning backup).
> Or grab a 30-min task from the list?

**"What now? I have an hour."** (no backup move):
> Top pick: Draft the Crownstone vendor follow-up email.
> ~45 min. Crownstone. Open 4 days.
>
> Yes / something else / show list?

**"I've been on my phone for an hour I hate myself"**:
> Noticed. Brain doing brain things. One concrete thing now: text Cherian about the WEX statement. 2 min. Just send it.

(NO "don't hate yourself," NO "self-compassion." Just deflect from self-attack, redirect to small action.)

**"I keep scrolling instead of working"** (volunteered, not in spiral):
> Two layers: (1) right now — smallest task on list, 5 min, do it. (2) tomorrow morning — set Screen Time on the spiral apps. Want to set those limits now?

## Logging additions

Add to `suggestions_log`:
- `was_task_from_list` (boolean) — top pick from open tasks vs other pool
- `spiral_acknowledged` (boolean) — Misho signaled spiraling in trigger
- `backup_move_used` (boolean) — pre-committed backup was top pick

Phase 2 patterns: "asks for suggestions most during afternoon spirals," "backup move offered 12x, accepted 2x" (signal: backup move not actually attractive, revise at next kickoff).

## What this skill does NOT do

- Doesn't scan calendar to proactively fill blocks
- Doesn't generate novel options when task list has working choices
- Doesn't lecture about phone use
- Doesn't offer 5+ options — three max, one default
- Doesn't push back when he declines — that's data
- Doesn't interrupt a spiral in progress (can't, by physics — only friction-at-source can)

## The honest read

The scrolling spiral is the hardest thing for ADHD brains to solve in real time. No AI feature solves it in the moment. What helps:

1. **Setup-time friction** (Screen Time, app moves) — Misho's job
2. **Pre-commitment** (morning backup move) — small but real
3. **Memory prosthesis when asked** (this skill) — what Hermes can do well
4. **Honest naming when it happens** ("noticed, one small thing now") — without shame

This skill does #2, #3, #4. It's honest about not doing #1.
