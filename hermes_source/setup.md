# Setup Guide — Weekend Plan

Follow in order. Don't skip ahead.

## Prerequisites (15 minutes, do this first)

You need accounts on:
- **Hetzner Cloud** or **DigitalOcean** (VPS) — Hetzner is cheaper, $4/month for what you need
- **Supabase** (free tier is fine for Phase 1) — already in your stack
- **OpenRouter** (LLM API access — gives you Claude, GPT, Gemini, all via one key) OR **Anthropic API** directly
- **Telegram** (you probably already have this; we'll create a bot via @BotFather)

Cost summary for Phase 1:
- VPS: $4–6/month
- Supabase: $0 (free tier)
- LLM API: ~$5–20/month for personal use depending on how much you talk to it
- Telegram: free

## Step 1: Spin up the VPS (Saturday morning, ~30 min)

Hetzner Cloud CX22 ($4.51/month) or DigitalOcean Basic Droplet ($6/month). Either is fine.

Pick:
- **OS**: Ubuntu 24.04 LTS
- **Location**: closest to you (US East if you're in Michigan)
- **SSH key**: add yours (don't use password auth)

SSH in:
```bash
ssh root@your-vps-ip
```

Create a non-root user:
```bash
adduser misho
usermod -aG sudo misho
su - misho
```

Update and install basics:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git curl
```

## Step 2: Install Hermes Agent (~15 min)

From their docs (verify the install command at https://hermes-agent.nousresearch.com/docs/ since this is a fast-moving project):

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | sh
```

After install, verify:
```bash
hermes --version
hermes doctor
```

If `hermes doctor` flags anything, fix it before continuing. Common issue: Python version. Hermes wants 3.11+.

Run the setup wizard:
```bash
hermes setup
```

This walks you through model provider selection. Pick **OpenRouter** (gives you flexibility to swap models later without re-auth). You'll need to paste an OpenRouter API key — get one at openrouter.ai/keys.

For the main model, pick `anthropic/claude-sonnet-4.6` (warmer tone than GPT-4o for coaching). For auxiliary tasks (compression, vision), let it default to `auto`.

Test the CLI:
```bash
hermes
```
You should land in an interactive prompt. Type "hi" — it should respond. Type `/exit` to leave.

## Step 3: Set up Supabase (~30 min)

You've used Supabase before so this is familiar.

1. Create a new project at supabase.com (free tier, name it `adhd-coach` or whatever)
2. Wait for it to provision (~2 min)
3. Go to SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run
4. Go to Project Settings → API → copy:
   - Project URL
   - `service_role` key (NOT the anon key — the coach needs full access)
5. Save these somewhere safe for the next step

## Step 4: Configure Hermes (~20 min)

Hermes config lives at `~/.hermes/config.yaml` on the VPS. SSH back in.

Drop in the `config/config.yaml` from this package. Edit these placeholders:
- `SUPABASE_URL` — your project URL from step 3
- `SUPABASE_SERVICE_KEY` — your service_role key
- `TELEGRAM_BOT_TOKEN` — we get this next

Then drop in the system prompt at `~/.hermes/system_prompt.md` from `config/system_prompt.md`.

Then drop in the three skill folders into `~/.hermes/skills/`:
```bash
mkdir -p ~/.hermes/skills
# Copy morning_kickoff/, quick_capture/, evening_shutdown/ folders here
```

## Step 5: Create the Telegram bot (~15 min)

1. Open Telegram, search for **@BotFather**, start a chat
2. Send `/newbot`
3. Pick a name (e.g., "Misho's Coach") and a username (must end in `bot`, e.g., `misho_coach_bot`)
4. BotFather replies with an HTTP API token — copy it
5. Paste it into `~/.hermes/config.yaml` as `TELEGRAM_BOT_TOKEN`

Lock the bot to only you:
1. Search for **@userinfobot**, send `/start` — it tells you your Telegram user ID (a number)
2. In `config.yaml`, add your user ID to the `allowed_users` list so randos can't talk to your coach

## Step 6: Start the gateway (~5 min)

On the VPS:
```bash
hermes gateway --service install
sudo systemctl start hermes-gateway
sudo systemctl enable hermes-gateway
sudo systemctl status hermes-gateway
```

You should see "active (running)." If not, check logs:
```bash
journalctl -u hermes-gateway -f
```

Open Telegram, find your bot, send `/start`. The coach should respond. Try saying "hi, are you working?"

## Step 7: Test the three skills (~30 min)

In Telegram, test each:

**Quick capture test:**
> "Remind me to file the Q2 IFTA for trucks 1047 and 1048 before Friday"

The coach should: confirm capture, classify as Geo Logistics, set a deadline, store in Supabase. Verify in Supabase by checking the `tasks` table.

**Morning kickoff test (manually trigger):**
> "Run morning kickoff"

The coach should: ask about energy/mood, surface yesterday's open items, walk you through picking one MIT per business.

**Evening shutdown test:**
> "Run evening shutdown"

The coach should: ask what got done, ask what didn't and why, end with closure.

## Step 8: Schedule the rituals (~10 min)

In Telegram, talk to the bot:
> "Schedule the morning kickoff for 7 AM every weekday and the evening shutdown for 8 PM every weekday. Eastern time."

Hermes has built-in cron via scheduled automations. It should confirm both are set. Verify with:
> "What's scheduled?"

## You're done

Use it Monday. Just use it. Don't tweak anything for 30 days.

## Troubleshooting

**The bot doesn't respond on Telegram**
Check `journalctl -u hermes-gateway -f` for errors. Most likely: bad TELEGRAM_BOT_TOKEN or wrong user ID in `allowed_users`.

**Skills aren't loading**
Run `hermes tools` and verify the skill names appear. Check that the `skills/` folder is at `~/.hermes/skills/` (Hermes default) and that each skill has a valid `SKILL.md`.

**Supabase calls fail**
The coach's response will probably mention it. Check your service_role key and URL. Test the connection manually with `curl`:
```bash
curl 'YOUR_SUPABASE_URL/rest/v1/tasks?select=*' \
  -H "apikey: YOUR_SERVICE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

**LLM costs spike**
Check OpenRouter dashboard. If it's >$1/day on personal use, something's looping. Tell the coach "stop" and check the logs.

**You skip a day**
Don't beat yourself up. Just open Telegram the next day and message "I skipped yesterday, let's pick back up." The coach is built to handle this.
