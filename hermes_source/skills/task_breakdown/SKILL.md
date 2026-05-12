# Task Breakdown Skill

**Trigger:** Misho says "break this down" / "help me start [task]" / "I don't know where to start with X" / "this feels too big" — OR — the task_followup skill routes here when a task gets a "too big" response.

**Goal:** Turn a vague, overwhelming task into 3–7 atomic steps where the FIRST STEP is physical, concrete, and takes ≤5 minutes. That's the only step that matters. The rest are scaffolding.

## The core principle

ADHD task initiation fails because "Organize desk" is a *project*, not a task. The brain can't pick a starting point, so it picks no point. The fix is to make the starting point so small and concrete that it's faster to do than to think about.

"Organize desk" becomes: "Stand up. Move the empty coffee cup. Sit back down." That's the first step. It's not the whole desk. It's not even meaningful progress. It's a starting point that breaks the inertia.

## How to break a task down

When Misho asks for breakdown, walk through this internally before responding:

**Step 1: Get the task as he stated it.** If he said "organize desk," that's the input. Don't expand it yet.

**Step 2: Estimate scope honestly.**
- < 15 min: don't break it down. Reply: "This is small. Just do it now. First step: [literal first physical action]."
- 15–60 min: break into 3–5 steps
- 1–3 hours: break into 5–7 steps PLUS suggest splitting across sessions
- 3+ hours: this isn't a task, it's a project. Reply: "This is a project, not a task. What's the FIRST 30-minute version that would make progress?"

**Step 3: Generate steps with these rules:**

- **Step 1 MUST be physical, concrete, and ≤5 minutes.** Verbs like "stand up," "open," "click," "write," "move," "find." NOT "think about" or "decide."
- **Each step gets a time estimate** in minutes.
- **No step longer than 15 minutes.** If it would be, split it.
- **Each step has ONE action.** Not "X and Y" — that's two steps.
- **The last step is "stop and assess"** — gives permission to pause.
- **Include a "skip ahead" path** for steps that might already be done.

**Step 4: Identify the riskiest step.** That's the one most likely to derail. Flag it so Misho knows where the trap is.

## Output format

Reply in Telegram-readable format. Short. Scannable. No headers, no bold (Telegram bolding doesn't render reliably).

```
"Organize desk" — broken down:

1. Stand up, move coffee cup to kitchen (1 min)
2. Set 15-min timer (30 sec)
3. Trash anything obviously trash (5 min)
4. Stack papers in one pile — don't sort, just stack (3 min)
5. Wipe the surface (2 min)
6. Stop. Assess. Done or one more round? (1 min)

Total: ~12 min for round 1.
The trap: step 4. Don't try to sort. Just stack.

Want me to start a timer for step 1?
```

That last line is the activation push. Make it easy to just start.

## Variations by task type

### Admin/paperwork tasks

Like "File Q2 IFTA for trucks 1047 and 1048":
1. Open the IFTA spreadsheet (1 min)
2. Find trucks 1047 and 1048 rows (1 min)
3. Pull Q2 fuel totals from Samsara dashboard (10 min)
4. Cross-reference with TCS card report — flag any discrepancy (10 min)
5. Fill in jurisdictional miles (10 min)
6. Save, stop, assess (1 min)

Total: ~35 min. Trap: step 4 (discrepancy hunting can spiral).

### Communication tasks

Like "Follow up with Crownstone contractor":
1. Find their last text/email (1 min)
2. Write one sentence: what you need (2 min)
3. Send it (30 sec)
4. Done.

Total: ~4 min. No trap. Just do it.

(Comms tasks are almost always smaller than they feel. Misho's resistance is usually 80% of the actual time. Acknowledge that — "Comms tasks always feel bigger than they are. This is a 4-minute thing.")

### Creative/strategy tasks

Like "Plan NestLink Q3 roadmap":
1. Open a blank doc (1 min)
2. Write 5 things you want NestLink to do better — bullet points, no judging (10 min)
3. Pick the top 3 by gut (3 min)
4. For each: what's the smallest version of this that could ship in 4 weeks? (15 min)
5. Stop. Walk away for an hour. Come back to refine. (1 min)

Total: ~30 min + later refinement. Trap: step 2 (perfectionism). Tell him "bullet points only, no full sentences."

### Decision-making tasks

Like "Decide whether to take the consulting offer":
1. Write down the offer in one sentence (2 min)
2. Write three reasons to say yes (5 min)
3. Write three reasons to say no (5 min)
4. Write what your gut said in the first 10 seconds (1 min)
5. Sleep on it. Decide tomorrow morning. (overnight)

Trap: step 4 — gut answer is usually right but ADHD brains override it. Tell him.

### Cleanup/declutter tasks

Like "Organize desk" or "Clear inbox":
1. Set a 15-min timer
2. Don't aim to finish — aim for one round
3. The "stop button" is the timer, not the task completion
4. If still energized after 15 min, set another timer
5. Mostly: ONE round only on day 1

These tasks ARE never finished. Reframe success as "made a dent" not "done."

## When to break down vs. when to NOT

**DO break down when:**
- Misho asks
- A task has been pushed 2+ times (silent signal that it's too big)
- The task description is vague ("clean up the Geo Logistics drivers folder")
- He's explicitly avoiding it ("I keep skipping this one")

**DON'T break down when:**
- The task is already < 15 min
- He's in flow on something else — don't interrupt for breakdown
- He just wants to vent — listen first, breakdown only if he asks
- He's done this exact task before — reuse the prior breakdown from memory

## Storing breakdowns

When a breakdown is generated, store in `task_breakdowns` table:
```
task_breakdowns:
  - task_id (foreign key)
  - steps (jsonb array: [{step_number, description, estimated_minutes, completed}])
  - generated_at
  - first_step_completed_at
  - all_steps_completed_at
  - generated_by_skill (always "task_breakdown" for now)
```

This serves two purposes:
1. If Misho asks "what was the breakdown again," pull it instead of regenerating
2. Phase 2: detects breakdown patterns — "you ask me to break down Geo Logistics admin tasks every time, want me to do this automatically?"

## Voice handling

For voice input ("hey can you break down getting the Q2 IFTA done"):
- Transcribe
- Generate breakdown
- Respond in voice with steps 1-3 only (voice can't handle long lists)
- Send full breakdown as text follow-up: "Full breakdown sent as text — voice has the first 3 steps."

## What NOT to do

- DON'T generate 12-step breakdowns. Max 7.
- DON'T put "think about" or "decide" as step 1. Always physical, always concrete.
- DON'T add "feel good about yourself" type steps. This is operational, not motivational.
- DON'T add a "review when done" step. Evening shutdown handles that.
- DON'T break down a task Misho didn't ask to be broken down. Capture-first, suggest-never (in Phase 1).
- DON'T over-explain why you broke it down this way. Just give the steps.

## Activation prompt at the end

Every breakdown ends with ONE of these (rotate to keep it fresh):

- "Want me to start a 15-min timer for step 1?"
- "Step 1 is 1 minute. Just do it now?"
- "Set a timer or skip and start?"
- "Block out 30 min for steps 1–3?"

If Misho says yes to a timer, schedule it via Hermes's scheduled_tasks. If he says no, just leave it. The breakdown is in Supabase, he can come back to it.

## The honest truth about task breakdown

It's not magic. It's just the executive function Misho doesn't have for that task right now, performed externally. It works because:
1. The starting point is so small that resistance can't grip it
2. The path is visible, so the brain stops trying to hold it
3. Momentum from step 1 carries into step 2 automatically (this is the actual mechanism — Newton's first law applies to executive function)

Don't pitch it as magic. Just provide the steps. Misho will figure out it works.
