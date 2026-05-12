# Setup

End-to-end setup for Hermes Mobile on Android. ~45 minutes the first time.

## 0. Prerequisites

- **Node.js 18+** on your laptop (`node -v`)
- **Android phone** with the **Expo Go** app installed (Play Store)
- A **Supabase** account (free tier is plenty)
- An **Anthropic API key** (https://console.anthropic.com — add a few dollars
  of credit; personal use is typically $5–20/month)
- A **Google Cloud** account (free) for Google Tasks OAuth

## 1. Clone & install

```bash
git clone <this-repo>
cd Jules-Test
npm install
```

## 2. Supabase

1. Go to https://supabase.com and create a new project. Pick a region close to
   you. Save the database password somewhere.
2. Once the project is provisioned, go to **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` from this repo, paste the whole thing into the
   editor, and run it. You should see "Success. No rows returned."
4. Go to **Settings → API**. Copy:
   - **Project URL** → goes into `EXPO_PUBLIC_SUPABASE_URL`
   - **Project API keys → `anon` `public`** → goes into `EXPO_PUBLIC_SUPABASE_ANON_KEY`

> Note on RLS: the schema doesn't enable strict RLS policies because this is a
> single-user app. If you ever want to share the database, add per-user
> policies before exposing the anon key beyond your own device.

## 3. Anthropic

1. Go to https://console.anthropic.com → **API Keys** → create a new key.
2. Copy it into `EXPO_PUBLIC_ANTHROPIC_API_KEY`.
3. The app uses `claude-sonnet-4-6` by default with `claude-haiku-4-5` as
   fallback. Edit `src/coach/anthropic.ts` to change models.

> Why on-device: this is a single-user personal app on your own phone. If you
> ever ship to others, move the API call to a small backend so the key isn't
> bundled into the binary.

## 4. Google Cloud (for Google Tasks sync)

1. Go to https://console.cloud.google.com → create a new project ("Hermes").
2. **APIs & Services → Library** → enable **Tasks API**.
3. **APIs & Services → OAuth consent screen** → External → fill in app name
   "Hermes" and your email. For scopes add `https://www.googleapis.com/auth/tasks`.
   Add yourself as a test user.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application** (for the Expo Go dev flow). Add
     `https://auth.expo.io/@your-expo-username/hermes-mobile` as an
     authorized redirect URI.
   - Copy the client ID → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
5. Create a second OAuth client ID:
   - Application type: **Android**.
   - Package name: `com.misho.hermes` (matches `app.json`).
   - SHA-1 certificate: for Expo Go, run `npx expo credentials:manager`
     OR follow https://docs.expo.dev/guides/google-authentication/ to get the
     fingerprint. For the dev build path, `eas credentials` prints it.
   - Copy the client ID → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

> If you want to skip Google Tasks for now, leave both `EXPO_PUBLIC_GOOGLE_*`
> empty. The app still works; the Settings screen will just show "Not
> connected" and the Sync button on Tasks will warn.

## 5. Environment

```bash
cp .env.example .env
# edit .env and paste in real values
```

## 6. Run on your phone

```bash
npx expo start --android
```

- A QR code appears in the terminal.
- Open **Expo Go** on your Android phone, tap **Scan QR code**, point at the QR.
- The app downloads and launches. Grant notification permissions when asked.

## 7. First-run smoke test

1. App opens on the **Home** screen. You should see "Morning kickoff /
   Evening shutdown" cards as "pending".
2. Tap **Settings** → **Test now** under Daily rituals. You should get a
   notification within a few seconds. If you don't, check Android settings
   → Apps → Expo Go → Notifications.
3. Tap **Reschedule**. The 7 AM kickoff and 8 PM shutdown notifications are
   now scheduled to repeat every day.
4. Tap **Capture** on the Home screen. Type a test task ("test task — try the
   coach"), tag it Personal, save. It should appear under **Tasks → Personal**.
5. (Optional) Tap **Settings → Connect Google Tasks**. After signing in, pick
   a list as default. Back on **Tasks**, tap **Sync** in the top right —
   your test task should appear in your Google Tasks app within seconds.
6. Tap **Coach** on Home. Send "ready for kickoff?" — Claude responds in the
   coach voice and starts running you through the morning ritual.

## 8. Daily use

- **7 AM**: notification fires → tap → `morning_kickoff` flow runs in chat
  with full context (yesterday's open loops, today's open tasks per business).
- **Anytime**: tap **Capture** to dump a thought, or use the Coach screen
  for a brain dump — multiple items get parsed and logged in one shot.
- **8 PM**: notification fires → tap → `evening_shutdown` walks you through
  closing the day.
- **Weekly**: tap **How am I doing?** for the 7-day rollup (kickoffs done,
  MIT completion rate, average morning energy).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing env var EXPO_PUBLIC_SUPABASE_URL` on app launch | You haven't created `.env`, or you're running `expo start` from the wrong directory. |
| Coach says "Error: 401" | Anthropic key is wrong or out of credit. |
| "Not signed in to Google" when tapping Sync | Settings → Connect Google Tasks first. |
| Notifications don't fire on schedule | Android Doze mode. Settings → Apps → Expo Go → Battery → Unrestricted. |
| Google sign-in says "redirect_uri_mismatch" | The web client redirect URI in Google Cloud must match `https://auth.expo.io/@your-username/hermes-mobile` exactly. |

## When to graduate from Expo Go

Expo Go is fine for personal daily use. You'd want to build a standalone APK
when:

- You want the app to keep running rituals even when Expo Go isn't installed
- You want a custom app icon and splash screen
- You want to share with someone else

Run `npx eas build --platform android --profile preview` to get an APK you
can install directly. See https://docs.expo.dev/build/introduction/.

## Customization

- **Coach voice**: `src/coach/systemPrompt.ts`
- **Skills (kickoff, shutdown, capture flows)**: `src/coach/skills.ts`
- **Notification times**: `src/lib/notifications.ts` (currently 7 AM / 8 PM)
- **Visual style**: `src/lib/theme.ts`
- **Phase 2 turn-on**: edit the system prompt to remove the "PHASE 1 ONLY"
  rule once you've got 30 days of data
