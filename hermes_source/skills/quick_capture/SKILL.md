# Quick Capture Skill

**Trigger:** Misho sends a message that contains a task, reminder, thought, idea, or decision. Could be voice or text. Could be one item or a brain-dump of many.

**Your job:** Capture everything, classify it, store it in Supabase. Don't lose anything.

## How to recognize this skill is needed

Auto-fires when Misho says things like:
- "Remind me to..."
- "I need to..."
- "Don't forget..."
- "Tomorrow I have to..."
- "Idea: ..."
- "Note to self..."
- A bare statement that sounds like a task: "File the IFTA for 1047." "Call the contractor."
- A brain-dump where he lists multiple things in one message

Does NOT auto-fire when:
- He's clearly asking a question ("what's on my list?")
- He's venting or processing emotion
- He's in the middle of a ritual (morning kickoff, evening shutdown — those have their own capture flow)

## How to handle it

### Single item

Misho: "Remind me to file the Q2 IFTA for trucks 1047 and 1048 before Friday."

You:
1. Classify business: Geo Logistics (IFTA = trucking)
2. Estimate time: 30–60 min based on past similar items if in memory, otherwise ask
3. Note deadline: Friday this week
4. Write to Supabase `tasks` table:
   ```
   business: "geo_logistics"
   description: "File Q2 IFTA for trucks 1047 and 1048"
   deadline: "2026-MM-DD" (this Friday)
   estimated_minutes: 60
   priority: "high" (deadline-driven)
   status: "open"
   created_at: now
   source: "telegram_capture"
   ```
5. Reply briefly: "Got it. Geo, due Friday. Anything else?"

### Brain dump

Misho: "Brain dump: need to follow up with the Crownstone vendor about the bathroom photos, also got an idea for NestLink to add bulk import for property records, Cherian needs the WEX statement reviewed, and I want to text Jenelyn about dinner Saturday."

You:
1. Don't interrupt mid-dump. Capture all four.
2. Reply with a single summary:
   > "Got four:
   > • Crownstone — follow up with vendor on bathroom photos
   > • NestLink — idea: bulk import for property records
   > • Geo — review WEX statement with Cherian
   > • Personal — text Jenelyn about Saturday dinner
   >
   > Want to set deadlines or just hold them for the morning kickoff?"
3. Write all four to Supabase with appropriate classifications.
4. If he says "just hold them," set status to "captured_for_review" so they surface in the next morning kickoff.

### Voice note

When Misho sends a voice message:
1. It's transcribed automatically by the gateway
2. Run the same capture logic on the transcription
3. Reply in voice too (TTS) — keep voice replies SHORT, max 2 sentences. Voice messages over 15 seconds are an ADHD trap.

### Ambiguous business classification

Misho: "Need to talk to the contractor."

You: "Got it. Crownstone or NestLink contractor?"

After he answers once in a session, remember it for the rest of that exchange. Don't ask again 30 seconds later.

### "Idea" vs "Task"

Some things aren't tasks, they're ideas Misho wants to remember. Classify:
- **Idea**: "What if NestLink added X" — store as `type: idea`, business tag, no deadline
- **Task**: has an implicit or explicit action verb and deadline
- **Decision**: "I'm going to drop the consulting offer" — store in `decisions` table with timestamp, time-of-day bucket, energy if known. DO NOT challenge or comment, even if it seems impulsive. Phase 1 is silent observation.
- **Waiting-for**: "Cherian's supposed to send me the WEX numbers by Tuesday" — store as `type: waiting_for` with the person and the expected date

## Time-of-day awareness

When capturing, note the time bucket:
- `morning` (5 AM – 11:59 AM)
- `midday` (12 PM – 4:59 PM)
- `evening` (5 PM – 9:59 PM)
- `late_night` (10 PM – 4:59 AM)

Store this on every task and decision. In Phase 2 this powers Devil's Advocate trigger #4. For now, just log it.

## What NOT to do

- Don't ask Misho to prioritize at capture time. Capture, dump, prioritize at kickoff.
- Don't suggest he "break this down further" unless he asks. That's a kickoff/MIT-prep step.
- Don't add tasks he didn't say. If he says "follow up with vendor," don't expand it to "email vendor, call vendor, schedule meeting with vendor."
- Don't editorialize. Capture only what he said.
- Don't reply with a wall of text. One short confirmation. He's busy.

## Confirmation pattern

For 1–3 items: confirm briefly in text, no list needed.
For 4+ items: bullet list, then ONE question at the end (deadline? hold for morning? priority?).
For voice in: voice reply, max 10 seconds, max 2 sentences.

## Edge cases

- **He says "scratch that" or "never mind" within 60 seconds of capturing:** delete the task from Supabase silently. Don't make him feel bad about reversing.
- **He duplicates a task:** check Supabase before creating. If the same description was captured in the last 7 days, reply: "I think this is already on the list. Want me to bump it up?"
- **He captures something that's actually a habit/recurring:** ask once — "is this a one-time thing or should I make it recurring?"
