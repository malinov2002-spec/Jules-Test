# Google Calendar Integration

This adds time-awareness to your coach. Without it, Hermes knows your tasks but not your meetings, free blocks, or when you're heads-down vs. context-switching.

## Why bother

Three things become possible:

1. **Time-block-aware MITs** — when you say "I'll do the IFTA this morning" at kickoff, Hermes can see you have a 10 AM dispatch call and warn: "You've only got 90 min between now and that call. Is that enough for the IFTA, or want to schedule it for after?"
2. **Post-meeting capture prompts** — when a calendar event ends, Hermes pings: "Just got out of [meeting]. Any action items to dump?" This is the single highest-leakage moment in an ADHD entrepreneur's day.
3. **Don't-disturb during meetings** — Hermes automatically goes quiet during calendar-marked busy blocks.

## What to skip

- DON'T have Hermes auto-create calendar events from tasks. That's overreach. You decide what goes on the calendar.
- DON'T have Hermes reschedule meetings automatically. That's a great way to lose trust with vendors and Jenelyn.
- DON'T sync tasks two-way with calendar. Tasks live in Supabase, calendar shows time. They serve different functions.

## Setup (~30 min)

### Step 1: Google Cloud project

1. Go to https://console.cloud.google.com
2. Create a new project: "Hermes Coach"
3. APIs & Services → Library → enable "Google Calendar API"
4. APIs & Services → Credentials → Create credentials → OAuth client ID
   - Application type: Desktop app (simpler for personal use)
   - Name: "Hermes Calendar"
5. Download the credentials JSON. SCP it to your VPS:
   ```bash
   scp credentials.json misho@your-vps:~/.hermes/secrets/google_calendar_credentials.json
   chmod 600 ~/.hermes/secrets/google_calendar_credentials.json
   ```

### Step 2: First-time OAuth (interactive)

The first time you run the calendar tool, it'll print a URL. Open it on any device, sign in with your Google account, and paste the auth code back. After that, the token is cached and persists across restarts.

```bash
cd ~/.hermes
python3 -c "from tools.calendar_tool import authorize; authorize()"
# Follow the prompts. Once done, ~/.hermes/secrets/google_calendar_token.json exists.
```

### Step 3: Add tool to Hermes config

In `~/.hermes/config.yaml`, under `custom_tools`, add:

```yaml
custom_tools:
  - name: supabase
    path: "~/.hermes/tools/supabase_tool.py"
    config:
      url: "${SUPABASE_URL}"
      service_key: "${SUPABASE_SERVICE_KEY}"
  - name: calendar         # ← new
    path: "~/.hermes/tools/calendar_tool.py"
    config:
      credentials_path: "~/.hermes/secrets/google_calendar_credentials.json"
      token_path: "~/.hermes/secrets/google_calendar_token.json"
      timezone: "America/New_York"
```

Restart Hermes:
```bash
sudo systemctl restart hermes-gateway
```

### Step 4: Test

In Telegram:
> "What's on my calendar tomorrow?"

Hermes should call the calendar tool and reply with your actual events.

### Step 5: Enable post-meeting prompts (optional but high-value)

This requires Hermes to poll the calendar every ~5 minutes for events that just ended. Add to `~/.hermes/config.yaml`:

```yaml
scheduled_tasks:
  # ... existing tasks ...
  - name: "post_meeting_check"
    cron: "*/5 9-18 * * 1-5"  # every 5 min, 9 AM-6 PM weekdays
    timezone: "America/New_York"
    skill: "post_meeting_capture"
    action: "internal_check"  # checks calendar, only pings if event ended in last 5 min
```

Create a tiny skill file `~/.hermes/skills/post_meeting_capture/SKILL.md`:

```markdown
# Post-Meeting Capture Skill

Trigger: every 5 min check during work hours, fires only if a calendar event ended in the last 5 minutes AND wasn't an all-day event AND wasn't tagged "no-prompt".

Action:
1. Identify the event that just ended
2. Detect the business context from the event title (e.g., "Crownstone vendor call" → Crownstone)
3. Send ONE message:

> "Just out of [event title]. Anything to capture before it evaporates?"

If Misho responds with content: route through quick_capture skill.
If Misho responds "nothing" / "no" / "skip" / silence for 10 min: drop it. Never repeat.

Hard rule: ONLY ONE post-meeting prompt per event. No follow-ups.
```

## What this does NOT do

- It doesn't read other people's calendars (yours only)
- It doesn't write to your calendar (read-only for safety)
- It doesn't see private event details if you marked them private
- It doesn't store calendar events in Supabase — it just reads on demand

If you want events stored (for weekly review analytics), that's Phase 2.

## Privacy note

The calendar tool reads everything on your primary calendar. If you have meetings with sensitive titles (medical, legal, etc.), either:
- Mark them private in Google Calendar (Hermes will see "Busy" only)
- Put them on a separate calendar that you don't share with the tool

The Google OAuth scope can be restricted to a single calendar if needed — see Google's docs.
