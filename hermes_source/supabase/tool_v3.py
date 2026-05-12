"""
Suggestions logging functions for the time_suggestion skill.
Append to ~/.hermes/tools/supabase_tool.py or import separately.

Requires schema_v3.sql.
"""

from datetime import datetime, timedelta, date
from typing import Optional, Literal
from supabase_tool import _get_client, MISHO_USER_ID, _time_bucket


# ─── Logging suggestions ──────────────────────────────────────────────────────

def log_suggestion_offered(
    triggered_by: Literal["user_asked", "auto_quiet_day"],
    suggestions_offered: list[dict],
    primary_pick_pool: str,
    available_minutes: Optional[int] = None,
    energy_at_request: Optional[int] = None,
    tasks_completed_today: int = 0,
    hours_since_last_message: Optional[float] = None,
) -> dict:
    """
    Log that a suggestion set was offered. Returns the row id for later update.

    Args:
        triggered_by: How the suggestion was triggered.
        suggestions_offered: List of {pool, text, estimated_minutes}.
        primary_pick_pool: Which pool ("A"-"E") the top pick came from.
        available_minutes: How much time Misho had.
        energy_at_request: 1-10 if known.
        tasks_completed_today: For pattern analysis.
        hours_since_last_message: For idle detection.
    """
    client = _get_client()
    now = datetime.now()
    payload = {
        "user_id": MISHO_USER_ID,
        "triggered_at": now.isoformat(),
        "triggered_by": triggered_by,
        "available_minutes": available_minutes,
        "energy_at_request": energy_at_request,
        "time_of_day_bucket": _time_bucket(now),
        "day_of_week": now.weekday(),
        "tasks_completed_today": tasks_completed_today,
        "hours_since_last_message": hours_since_last_message,
        "suggestions_offered": suggestions_offered,
        "primary_pick_pool": primary_pick_pool,
    }
    result = client.table("suggestions_log").insert(payload).execute()
    return result.data[0] if result.data else {}


def record_suggestion_choice(
    suggestion_id: str,
    user_chose: Literal["1", "2", "3", "other", "none", "ignored"],
    user_chose_text: Optional[str] = None,
) -> dict:
    """Update a suggestion log with what Misho actually picked."""
    client = _get_client()
    existing = client.table("suggestions_log").select("triggered_at").eq("id", suggestion_id).execute()
    response_seconds = None
    if existing.data:
        triggered = datetime.fromisoformat(existing.data[0]["triggered_at"].replace("Z", "+00:00"))
        response_seconds = int((datetime.now(triggered.tzinfo) - triggered).total_seconds())
    payload = {
        "user_chose": user_chose,
        "user_chose_text": user_chose_text,
        "user_chose_at": datetime.now().isoformat(),
        "response_time_seconds": response_seconds,
    }
    result = client.table("suggestions_log").update(payload).eq("id", suggestion_id).execute()
    return result.data[0] if result.data else {}


# ─── Auto-trigger gating ──────────────────────────────────────────────────────

def can_auto_trigger_today() -> tuple[bool, Optional[str]]:
    """
    Check if we can send an auto-suggestion ("quiet day" prompt) right now.

    Returns (can_trigger, reason_if_blocked).

    All conditions must be true:
      1. User has auto_suggest_on_quiet_days = true in preferences
      2. We haven't auto-triggered today
      3. It's between 11 AM and 4 PM local
      4. Last message from Misho was 4+ hours ago
      5. Zero tasks completed today
      6. No active quiet period
      7. It's a weekday
    """
    client = _get_client()
    now = datetime.now()

    # 1. Preference check
    prefs = client.table("user_preferences").select("auto_suggest_on_quiet_days").eq(
        "user_id", MISHO_USER_ID
    ).execute()
    if prefs.data and prefs.data[0].get("auto_suggest_on_quiet_days") is False:
        return False, "user opted out"

    # 2. Already triggered today?
    already = client.table("auto_triggered_today").select("auto_count").execute()
    if already.data and already.data[0]["auto_count"] > 0:
        return False, "already auto-triggered today"

    # 3. Time of day
    if now.hour < 11 or now.hour >= 16:
        return False, "outside 11 AM – 4 PM window"

    # 7. Weekday
    if now.weekday() >= 5:
        return False, "weekend"

    # 6. Active quiet period
    quiet = client.table("active_quiet_periods").select("*").execute()
    if quiet.data:
        return False, "active quiet period"

    # 5. Tasks completed today
    today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
    done_today = (
        client.table("tasks")
        .select("id", count="exact")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "done")
        .gte("completed_at", today_start)
        .execute()
    )
    if (done_today.count or 0) > 0:
        return False, f"{done_today.count} tasks done today (not stuck)"

    # 4. Last message check — we need a "last message at" timestamp from Hermes.
    # If Hermes tracks last interaction timestamp, query it here.
    # For now, use latest check_in or task creation as a proxy.
    recent_activity = (
        client.table("tasks")
        .select("created_at")
        .eq("user_id", MISHO_USER_ID)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if recent_activity.data:
        last_active = datetime.fromisoformat(
            recent_activity.data[0]["created_at"].replace("Z", "+00:00")
        ).replace(tzinfo=None)
        hours_since = (now - last_active).total_seconds() / 3600
        if hours_since < 4:
            return False, f"only {hours_since:.1f} hours since last activity"

    return True, None


# ─── Suggestion building helpers ──────────────────────────────────────────────

def get_suggestion_context() -> dict:
    """
    Pull everything the AI needs to build a good suggestion.
    Call this once at the start of the time_suggestion skill.
    """
    client = _get_client()
    now = datetime.now()
    today = date.today().isoformat()
    today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()

    # Latest morning check-in for energy
    latest_kickoff = (
        client.table("check_ins")
        .select("energy, daily_intention")
        .eq("user_id", MISHO_USER_ID)
        .eq("type", "morning_kickoff")
        .eq("date", today)
        .order("time_started", desc=True)
        .limit(1)
        .execute()
    )
    energy = latest_kickoff.data[0].get("energy") if latest_kickoff.data else None
    intention = latest_kickoff.data[0].get("daily_intention") if latest_kickoff.data else None

    # Tasks completed today
    done_today = (
        client.table("tasks")
        .select("id, business, description", count="exact")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "done")
        .gte("completed_at", today_start)
        .execute()
    )

    # Open small tasks (≤30 min) per business
    small_open = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "open")
        .lte("estimated_minutes", 30)
        .lt("push_count", 3)  # skip stuck ones
        .order("deadline", desc=False, nullsfirst=False)
        .order("priority", desc=True)
        .limit(10)
        .execute()
    )

    # Open medium tasks (30-60 min)
    medium_open = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "open")
        .gte("estimated_minutes", 30)
        .lte("estimated_minutes", 60)
        .lt("push_count", 3)
        .order("deadline", desc=False, nullsfirst=False)
        .limit(10)
        .execute()
    )

    # User preferences (last Jenelyn contact, book, etc.)
    prefs = (
        client.table("user_preferences")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .execute()
    )

    # Things he's declined today (don't re-offer)
    declined = (
        client.table("declined_today")
        .select("option")
        .execute()
    )

    return {
        "now": now,
        "time_of_day_bucket": _time_bucket(now),
        "day_of_week": now.weekday(),
        "is_weekend": now.weekday() >= 5,
        "is_friday_afternoon": now.weekday() == 4 and now.hour >= 14,
        "energy": energy,
        "daily_intention": intention,
        "tasks_done_count": done_today.count or 0,
        "tasks_done_list": done_today.data or [],
        "small_open_tasks": small_open.data or [],
        "medium_open_tasks": medium_open.data or [],
        "preferences": prefs.data[0] if prefs.data else {},
        "declined_options_today": [d.get("option") for d in (declined.data or [])],
    }
