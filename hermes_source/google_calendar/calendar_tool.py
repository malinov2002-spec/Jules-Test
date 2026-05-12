"""
Google Calendar Tool for Hermes Agent
Place at ~/.hermes/tools/calendar_tool.py

Read-only calendar access. The coach can:
  - See today's/this week's events
  - Detect when an event just ended (for post-meeting capture prompts)
  - Find free blocks between events
  - Detect "busy" / "do not disturb" windows

We deliberately do NOT support creating, updating, or deleting events.
That's outside Phase 1 scope and the wrong layer of trust.

First-time setup: run `authorize()` interactively to OAuth.
"""

import os
import json
from datetime import datetime, timedelta, time
from typing import Optional
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Read-only — we never write to the calendar
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

CREDENTIALS_PATH = os.path.expanduser(
    os.environ.get(
        "GOOGLE_CALENDAR_CREDENTIALS",
        "~/.hermes/secrets/google_calendar_credentials.json",
    )
)
TOKEN_PATH = os.path.expanduser(
    os.environ.get(
        "GOOGLE_CALENDAR_TOKEN",
        "~/.hermes/secrets/google_calendar_token.json",
    )
)
TIMEZONE = os.environ.get("CALENDAR_TIMEZONE", "America/New_York")

_service = None


def authorize() -> None:
    """First-time OAuth. Run interactively once after install."""
    creds = None
    if Path(TOKEN_PATH).exists():
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            # Use console flow since we're on a VPS without a browser
            creds = flow.run_console()
        Path(TOKEN_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
    print(f"Authorized. Token saved to {TOKEN_PATH}")


def _get_service():
    """Lazy-load the Google Calendar service."""
    global _service
    if _service is not None:
        return _service
    if not Path(TOKEN_PATH).exists():
        raise RuntimeError(
            f"No token at {TOKEN_PATH}. Run authorize() interactively first."
        )
    creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PATH, "w") as f:
                f.write(creds.to_json())
        else:
            raise RuntimeError(
                "Token invalid and can't refresh. Run authorize() again."
            )
    _service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    return _service


def list_events_today() -> list[dict]:
    """List all events on the user's primary calendar for today."""
    return list_events_range(date_offset_days=0, end_offset_days=1)


def list_events_tomorrow() -> list[dict]:
    """List events for tomorrow."""
    return list_events_range(date_offset_days=1, end_offset_days=2)


def list_events_this_week() -> list[dict]:
    """List events from today through end of week."""
    today = datetime.now()
    end_offset = 7 - today.weekday()  # Days until end of Sunday
    return list_events_range(date_offset_days=0, end_offset_days=end_offset)


def list_events_range(
    date_offset_days: int = 0,
    end_offset_days: int = 1,
) -> list[dict]:
    """
    List events between (today + date_offset_days) and (today + end_offset_days).

    Args:
        date_offset_days: Start offset. 0 = today, 1 = tomorrow.
        end_offset_days: End offset (exclusive).

    Returns:
        List of events with keys: id, title, start, end, all_day, location, busy.
    """
    service = _get_service()
    now = datetime.now()
    start = (now + timedelta(days=date_offset_days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    end = (now + timedelta(days=end_offset_days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start.isoformat() + "Z",
            timeMax=end.isoformat() + "Z",
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])
    return [_normalize_event(e) for e in events]


def get_recently_ended_event(within_minutes: int = 5) -> Optional[dict]:
    """
    Find an event that ended within the last N minutes.
    Used by the post_meeting_capture skill.

    Returns the most recently ended event, or None.
    """
    service = _get_service()
    now = datetime.now()
    # Look back a bit further to catch all candidates
    start = (now - timedelta(minutes=within_minutes + 30)).isoformat() + "Z"
    end = (now + timedelta(minutes=5)).isoformat() + "Z"
    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start,
            timeMax=end,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])
    candidates = []
    for e in events:
        ne = _normalize_event(e)
        if ne["all_day"]:
            continue
        if ne["end"] <= now and (now - ne["end"]).total_seconds() <= within_minutes * 60:
            candidates.append(ne)
    if not candidates:
        return None
    # Most recently ended
    return max(candidates, key=lambda x: x["end"])


def get_current_event() -> Optional[dict]:
    """If there's an event happening right now, return it. Used for don't-disturb logic."""
    service = _get_service()
    now = datetime.now()
    start = (now - timedelta(hours=1)).isoformat() + "Z"
    end = (now + timedelta(minutes=5)).isoformat() + "Z"
    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start,
            timeMax=end,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])
    for e in events:
        ne = _normalize_event(e)
        if ne["all_day"]:
            continue
        if ne["start"] <= now <= ne["end"]:
            return ne
    return None


def find_free_blocks(
    date_offset_days: int = 0,
    min_block_minutes: int = 30,
    work_start_hour: int = 9,
    work_end_hour: int = 18,
) -> list[dict]:
    """
    Find free blocks during work hours on a given day.

    Args:
        date_offset_days: 0 = today, 1 = tomorrow.
        min_block_minutes: Ignore blocks shorter than this.
        work_start_hour: Start of work day.
        work_end_hour: End of work day.

    Returns:
        List of free blocks: [{start: datetime, end: datetime, minutes: int}]
    """
    events = list_events_range(date_offset_days, date_offset_days + 1)
    target_date = (datetime.now() + timedelta(days=date_offset_days)).date()
    work_start = datetime.combine(target_date, time(hour=work_start_hour))
    work_end = datetime.combine(target_date, time(hour=work_end_hour))

    # If today and we're past work_start, free time starts from now
    now = datetime.now()
    if date_offset_days == 0 and now > work_start:
        work_start = now

    # Only consider non-all-day, busy-status events
    busy = sorted(
        [
            (e["start"], e["end"])
            for e in events
            if not e["all_day"] and e["busy"] and e["start"] < work_end and e["end"] > work_start
        ],
        key=lambda x: x[0],
    )

    free_blocks = []
    cursor = work_start
    for s, e in busy:
        if s > cursor:
            gap = (s - cursor).total_seconds() / 60
            if gap >= min_block_minutes:
                free_blocks.append({
                    "start": cursor,
                    "end": s,
                    "minutes": int(gap),
                })
        cursor = max(cursor, e)
    if cursor < work_end:
        gap = (work_end - cursor).total_seconds() / 60
        if gap >= min_block_minutes:
            free_blocks.append({
                "start": cursor,
                "end": work_end,
                "minutes": int(gap),
            })
    return free_blocks


def is_user_in_meeting() -> bool:
    """Quick check: should Hermes go quiet right now?"""
    return get_current_event() is not None


def _normalize_event(event: dict) -> dict:
    """Convert a Google Calendar event into the shape the coach uses."""
    start_data = event.get("start", {})
    end_data = event.get("end", {})

    all_day = "date" in start_data
    if all_day:
        start_dt = datetime.fromisoformat(start_data["date"])
        end_dt = datetime.fromisoformat(end_data["date"])
    else:
        # Strip timezone for naive comparison with datetime.now()
        start_str = start_data.get("dateTime", "")
        end_str = end_data.get("dateTime", "")
        start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00")).replace(tzinfo=None)
        end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00")).replace(tzinfo=None)

    return {
        "id": event.get("id"),
        "title": event.get("summary", "(no title)"),
        "start": start_dt,
        "end": end_dt,
        "all_day": all_day,
        "location": event.get("location"),
        "busy": event.get("transparency", "opaque") != "transparent",
        "description": event.get("description", ""),
    }


# ─── Business context inference ───────────────────────────────────────────────

def infer_business_from_event(event: dict) -> Optional[str]:
    """
    Best-effort detection of which business an event relates to.
    Used to route post-meeting capture prompts.
    """
    text = f"{event.get('title', '')} {event.get('description', '')} {event.get('location', '')}".lower()

    geo_keywords = [
        "dispatch", "trucking", "carrier", "ifta", "samsara", "wex",
        "cherian", "geo logistics", "load board", "sylectus", "rxo"
    ]
    nestlink_keywords = [
        "nestlink", "property platform", "flask", "supabase", "deploy"
    ]
    crownstone_keywords = [
        "crownstone", "vendor", "contractor", "property", "greenville",
        "listing", "rental", "tenant"
    ]

    if any(k in text for k in geo_keywords):
        return "geo_logistics"
    if any(k in text for k in nestlink_keywords):
        return "nestlink"
    if any(k in text for k in crownstone_keywords):
        return "crownstone"
    return None


if __name__ == "__main__":
    # Run this script directly to authorize on first setup
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "authorize":
        authorize()
    else:
        print("Today's events:")
        for e in list_events_today():
            print(f"  {e['start']} – {e['end']}: {e['title']}")
