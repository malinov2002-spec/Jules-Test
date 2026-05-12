"""
Additional Supabase tool functions for task follow-ups, breakdowns, quiet mode.
Append these to ~/.hermes/tools/supabase_tool.py (or import this module separately).

Requires the schema_v2.sql to have been applied.
"""

from datetime import datetime, timedelta
from typing import Optional, Literal
from supabase_tool import _get_client, MISHO_USER_ID, _time_bucket


# ─── Task follow-ups ──────────────────────────────────────────────────────────

PingType = Literal[
    "time_block_end",
    "deadline_approaching",
    "post_meeting",
    "general_check_in",
    "unblock_question",
]

ResponseAction = Literal[
    "done", "pushed", "dropped", "broke_down", "forgot",
    "no_energy", "not_important", "too_big", "in_progress",
    "ignored", "other",
]


def log_followup_ping(
    task_id: str,
    ping_type: PingType,
    escalation_level: int = 1,
) -> dict:
    """
    Log that we just pinged Misho about a task. Call this BEFORE sending the message
    so we have a record even if the ping fails to deliver.

    Returns the followup row — keep the id to update it when Misho responds.
    """
    client = _get_client()
    payload = {
        "user_id": MISHO_USER_ID,
        "task_id": task_id,
        "ping_type": ping_type,
        "escalation_level": escalation_level,
    }
    result = client.table("task_followups").insert(payload).execute()
    return result.data[0] if result.data else {}


def record_followup_response(
    followup_id: str,
    response_text: str,
    response_action: ResponseAction,
) -> dict:
    """When Misho replies to a ping, log the response."""
    client = _get_client()
    # Calculate response time
    existing = client.table("task_followups").select("ping_sent_at").eq("id", followup_id).execute()
    response_seconds = None
    if existing.data:
        sent = datetime.fromisoformat(existing.data[0]["ping_sent_at"].replace("Z", "+00:00"))
        response_seconds = int((datetime.now(sent.tzinfo) - sent).total_seconds())
    payload = {
        "response_text": response_text,
        "response_action": response_action,
        "response_received_at": datetime.now().isoformat(),
        "response_time_seconds": response_seconds,
    }
    result = client.table("task_followups").update(payload).eq("id", followup_id).execute()
    return result.data[0] if result.data else {}


def get_recent_pings_for_task(task_id: str, hours: int = 24) -> list[dict]:
    """
    Get recent pings for a task. Used to determine escalation level —
    if there's already an unanswered ping, the next one is escalation_level 2.
    """
    client = _get_client()
    since = (datetime.now() - timedelta(hours=hours)).isoformat()
    result = (
        client.table("task_followups")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("task_id", task_id)
        .gte("ping_sent_at", since)
        .order("ping_sent_at", desc=True)
        .execute()
    )
    return result.data or []


def can_send_unsolicited_ping() -> tuple[bool, Optional[str]]:
    """
    Should we send an unsolicited ping right now?
    Returns (can_send, reason_if_blocked).

    Checks:
      - Active quiet period
      - Time of day (no pings before 9 AM or after 6 PM)
      - Recent unanswered pings (rate limiting)
      - Day of week (no weekend pings)
    """
    now = datetime.now()

    # Quiet period?
    client = _get_client()
    active_quiet = client.table("active_quiet_periods").select("*").execute()
    if active_quiet.data:
        return False, f"quiet period until {active_quiet.data[0]['ends_at']}"

    # Time of day?
    if now.hour < 9 or now.hour >= 18:
        return False, "outside work hours"

    # Weekend?
    if now.weekday() >= 5:  # 5 = Sat, 6 = Sun
        return False, "weekend"

    # Recent unanswered pings?
    unanswered = client.table("recent_unanswered_pings").select("*").execute()
    if unanswered.data and len(unanswered.data) >= 2:
        return False, f"{len(unanswered.data)} unanswered pings in last 24h"

    # Recent ping within last 90 min?
    ninety_min_ago = (now - timedelta(minutes=90)).isoformat()
    recent = (
        client.table("task_followups")
        .select("ping_sent_at")
        .eq("user_id", MISHO_USER_ID)
        .gte("ping_sent_at", ninety_min_ago)
        .limit(1)
        .execute()
    )
    if recent.data:
        return False, "ping rate limit (90 min cooldown)"

    return True, None


# ─── Quiet mode ───────────────────────────────────────────────────────────────

def start_quiet_period(
    duration_minutes: int,
    reason: str = "self_requested",
) -> dict:
    """
    Misho says "quiet for 2 hours" or "I'm in flow" — silence all unsolicited pings.

    Args:
        duration_minutes: How long to stay quiet.
        reason: One of "flow", "headsdown", "meeting", "personal", "self_requested".
    """
    client = _get_client()
    ends_at = (datetime.now() + timedelta(minutes=duration_minutes)).isoformat()
    payload = {
        "user_id": MISHO_USER_ID,
        "starts_at": datetime.now().isoformat(),
        "ends_at": ends_at,
        "reason": reason,
    }
    result = client.table("quiet_periods").insert(payload).execute()
    return result.data[0] if result.data else {}


def end_active_quiet_period() -> int:
    """End any active quiet periods. Returns count of ended periods."""
    client = _get_client()
    result = (
        client.table("quiet_periods")
        .update({"ends_at": datetime.now().isoformat()})
        .eq("user_id", MISHO_USER_ID)
        .gt("ends_at", datetime.now().isoformat())
        .execute()
    )
    return len(result.data or [])


# ─── Task breakdowns ──────────────────────────────────────────────────────────

def save_task_breakdown(
    task_id: str,
    steps: list[dict],
    risky_step_number: Optional[int] = None,
    risky_step_note: Optional[str] = None,
) -> dict:
    """
    Save a generated task breakdown for reuse.

    Args:
        task_id: The task being broken down.
        steps: List of {step_number, description, estimated_minutes}.
        risky_step_number: Which step is most likely to derail.
        risky_step_note: One line about why it's risky.
    """
    client = _get_client()
    total = sum(s.get("estimated_minutes", 0) for s in steps)
    payload = {
        "user_id": MISHO_USER_ID,
        "task_id": task_id,
        "steps": steps,
        "total_estimated_minutes": total,
        "risky_step_number": risky_step_number,
        "risky_step_note": risky_step_note,
    }
    result = client.table("task_breakdowns").insert(payload).execute()
    return result.data[0] if result.data else {}


def get_breakdown_for_task(task_id: str) -> Optional[dict]:
    """Get the most recent breakdown for a task, if one exists."""
    client = _get_client()
    result = (
        client.table("task_breakdowns")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("task_id", task_id)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def mark_breakdown_step_complete(
    breakdown_id: str,
    step_number: int,
) -> dict:
    """Misho completed a step in a breakdown. Update the steps array."""
    client = _get_client()
    existing = client.table("task_breakdowns").select("*").eq("id", breakdown_id).execute()
    if not existing.data:
        return {}
    bd = existing.data[0]
    steps = bd["steps"]
    for s in steps:
        if s.get("step_number") == step_number:
            s["completed"] = True
            s["completed_at"] = datetime.now().isoformat()
    payload = {"steps": steps}
    # Were all steps just completed?
    if all(s.get("completed") for s in steps):
        payload["all_steps_completed_at"] = datetime.now().isoformat()
    # First step?
    if step_number == 1 and bd.get("first_step_completed_at") is None:
        payload["first_step_completed_at"] = datetime.now().isoformat()
    result = client.table("task_breakdowns").update(payload).eq("id", breakdown_id).execute()
    return result.data[0] if result.data else {}


# ─── Tasks needing follow-up (used by scheduled checker) ──────────────────────

def find_tasks_needing_followup() -> list[dict]:
    """
    Find tasks that should get a check-in ping right now.

    Returns tasks where:
      - Status is "open"
      - One of:
        * Has a target_time_block that just ended
        * Has a deadline within 24 hours and no ping in last 12 hours
        * Was set as today's MIT and it's past 2 PM
    """
    client = _get_client()
    now = datetime.now()
    candidates: list[dict] = []

    # Get today's open MITs
    today_mits = (
        client.table("mits")
        .select("*, tasks(*)")
        .eq("user_id", MISHO_USER_ID)
        .eq("date", now.date().isoformat())
        .eq("completed", False)
        .execute()
    )

    for mit in (today_mits.data or []):
        task = mit.get("tasks")
        if not task or task.get("status") != "open":
            continue

        time_block = mit.get("target_time_block", "").lower() if mit.get("target_time_block") else ""

        # Time block end check
        should_ping = False
        ping_type = None

        if "morning" in time_block and now.hour >= 12 and now.hour < 13:
            should_ping = True
            ping_type = "time_block_end"
        elif "afternoon" in time_block and now.hour >= 17 and now.hour < 18:
            should_ping = True
            ping_type = "time_block_end"
        elif not time_block and now.hour == 14:
            # Generic 2 PM check on MITs without explicit blocks
            should_ping = True
            ping_type = "general_check_in"

        if should_ping:
            # Check we haven't already pinged this task today
            recent_pings = get_recent_pings_for_task(task["id"], hours=8)
            if not recent_pings:
                candidates.append({
                    "task": task,
                    "mit": mit,
                    "ping_type": ping_type,
                })

    # Deadline-approaching tasks
    tomorrow = (now + timedelta(days=1)).date().isoformat()
    deadline_soon = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "open")
        .lte("deadline", tomorrow)
        .gte("deadline", now.date().isoformat())
        .execute()
    )
    for task in (deadline_soon.data or []):
        recent_pings = get_recent_pings_for_task(task["id"], hours=12)
        if not recent_pings:
            candidates.append({
                "task": task,
                "ping_type": "deadline_approaching",
            })

    return candidates
