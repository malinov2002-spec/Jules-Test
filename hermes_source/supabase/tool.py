"""
Supabase Tool for Hermes Agent
Place at ~/.hermes/tools/supabase_tool.py

This is the custom tool Hermes loads to read/write Misho's coach data.
Hermes registers tools at runtime — the function signatures and docstrings
become the LLM's tool schema, so write them carefully.
"""

import os
from datetime import datetime, date, timedelta
from typing import Optional, Literal
from supabase import create_client, Client


# ─── Configuration ────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
MISHO_USER_ID = "11111111-1111-1111-1111-111111111111"  # seeded in schema.sql

_client: Optional[Client] = None

def _get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment. "
                "Set these in your Hermes systemd unit or .env file."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def _time_bucket(dt: Optional[datetime] = None) -> str:
    """Return the time-of-day bucket for a datetime."""
    h = (dt or datetime.now()).hour
    if 5 <= h < 12:
        return "morning"
    if 12 <= h < 17:
        return "midday"
    if 17 <= h < 22:
        return "evening"
    return "late_night"


Business = Literal["geo_logistics", "nestlink", "crownstone", "personal"]
TaskStatus = Literal["open", "captured_for_review", "in_progress", "done", "dropped", "pushed"]


# ─── Task operations ──────────────────────────────────────────────────────────

def create_task(
    description: str,
    business: Business,
    type: Literal["task", "idea", "decision", "waiting_for"] = "task",
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None,
    deadline: Optional[str] = None,  # ISO date "YYYY-MM-DD"
    estimated_minutes: Optional[int] = None,
    source: str = "telegram_capture",
    notes: Optional[str] = None,
) -> dict:
    """
    Create a new task in Supabase. Use this whenever Misho captures
    a task, idea, decision he wants to remember, or thing he's waiting on.

    Args:
        description: What the task is, in Misho's own words if possible.
        business: One of "geo_logistics", "nestlink", "crownstone", "personal".
        type: "task" (default), "idea", "decision", or "waiting_for".
        priority: "low", "medium", "high", or "urgent". Leave None if unclear.
        deadline: ISO date string "YYYY-MM-DD". Leave None if no deadline.
        estimated_minutes: Time estimate. Leave None if unknown.
        source: Where the task came from. Default "telegram_capture".
        notes: Any extra context.

    Returns:
        The created task row.
    """
    client = _get_client()
    payload = {
        "user_id": MISHO_USER_ID,
        "description": description,
        "business": business,
        "type": type,
        "status": "open",
        "priority": priority,
        "deadline": deadline,
        "estimated_minutes": estimated_minutes,
        "created_time_bucket": _time_bucket(),
        "source": source,
        "notes": notes,
    }
    result = client.table("tasks").insert(payload).execute()
    return result.data[0] if result.data else {}


def list_open_tasks(
    business: Optional[Business] = None,
    limit: int = 20,
) -> list[dict]:
    """
    List Misho's open tasks. Filter by business if specified.
    Returns sorted by deadline ascending (urgent first), then priority desc.

    Args:
        business: Optional. If None, returns all open tasks across businesses.
        limit: Max number to return. Default 20.
    """
    client = _get_client()
    q = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "open")
        .order("deadline", desc=False, nullsfirst=False)
        .order("priority", desc=True)
        .limit(limit)
    )
    if business:
        q = q.eq("business", business)
    result = q.execute()
    return result.data or []


def list_tasks_by_status(
    status: TaskStatus,
    since_days: int = 7,
    business: Optional[Business] = None,
) -> list[dict]:
    """
    List tasks by status, with a recency filter.

    Args:
        status: One of "open", "captured_for_review", "in_progress", "done", "dropped", "pushed".
        since_days: Only return tasks updated in the last N days. Default 7.
        business: Optional business filter.
    """
    client = _get_client()
    since = (datetime.now() - timedelta(days=since_days)).isoformat()
    q = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", status)
        .gte("updated_at", since)
        .order("updated_at", desc=True)
    )
    if business:
        q = q.eq("business", business)
    result = q.execute()
    return result.data or []


def update_task_status(
    task_id: str,
    new_status: TaskStatus,
    drop_reason: Optional[str] = None,
    new_deadline: Optional[str] = None,
    actual_minutes: Optional[int] = None,
) -> dict:
    """
    Update a task's status. Use this for completing, dropping, pushing tasks.

    Args:
        task_id: The task UUID.
        new_status: New status.
        drop_reason: If dropping, optional reason category.
        new_deadline: If pushing, new ISO date "YYYY-MM-DD".
        actual_minutes: If completing, actual time spent.
    """
    client = _get_client()
    payload: dict = {
        "status": new_status,
        "updated_at": datetime.now().isoformat(),
    }
    if new_status == "done":
        payload["completed_at"] = datetime.now().isoformat()
        if actual_minutes is not None:
            payload["actual_minutes"] = actual_minutes
    if new_status == "dropped":
        payload["dropped_at"] = datetime.now().isoformat()
        if drop_reason:
            payload["dropped_reason"] = drop_reason
    if new_status == "pushed" and new_deadline:
        payload["deadline"] = new_deadline
        # Increment push_count — for Phase 2 commitment loop detection
        existing = client.table("tasks").select("push_count").eq("id", task_id).execute()
        if existing.data:
            payload["push_count"] = (existing.data[0].get("push_count") or 0) + 1
    result = client.table("tasks").update(payload).eq("id", task_id).execute()
    return result.data[0] if result.data else {}


def search_tasks(query: str, limit: int = 10) -> list[dict]:
    """
    Search tasks by description (case-insensitive partial match).
    Use this to check for duplicates before creating, or to find
    a task Misho mentions vaguely ('the IFTA thing', 'the vendor thing').

    Args:
        query: Search string.
        limit: Max results. Default 10.
    """
    client = _get_client()
    result = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .ilike("description", f"%{query}%")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ─── MITs (Most Important Tasks) ──────────────────────────────────────────────

def set_mit(
    business: Business,
    task_id: str,
    target_time_block: Optional[str] = None,
    for_date: Optional[str] = None,  # ISO date, defaults to today
) -> dict:
    """
    Set today's MIT (Most Important Task) for a business.
    Called during morning kickoff. Max 1 per business per day.

    Args:
        business: Which business this MIT is for.
        task_id: The task to designate as MIT.
        target_time_block: Optional ("morning", "after lunch", etc).
        for_date: Optional ISO date, defaults to today.
    """
    client = _get_client()
    d = for_date or date.today().isoformat()
    payload = {
        "user_id": MISHO_USER_ID,
        "date": d,
        "business": business,
        "task_id": task_id,
        "target_time_block": target_time_block,
    }
    # Upsert in case the kickoff ran twice
    result = (
        client.table("mits")
        .upsert(payload, on_conflict="user_id,date,business")
        .execute()
    )
    return result.data[0] if result.data else {}


def get_todays_mits() -> list[dict]:
    """Get today's MITs across all businesses with task details joined."""
    client = _get_client()
    today = date.today().isoformat()
    result = (
        client.table("mits")
        .select("*, tasks(description, business, status, deadline)")
        .eq("user_id", MISHO_USER_ID)
        .eq("date", today)
        .execute()
    )
    return result.data or []


def mark_mit_done(business: Business, for_date: Optional[str] = None) -> dict:
    """Mark a business's MIT as completed for the day."""
    client = _get_client()
    d = for_date or date.today().isoformat()
    result = (
        client.table("mits")
        .update({"completed": True, "completed_at": datetime.now().isoformat()})
        .eq("user_id", MISHO_USER_ID)
        .eq("date", d)
        .eq("business", business)
        .execute()
    )
    return result.data[0] if result.data else {}


# ─── Check-ins (rituals) ──────────────────────────────────────────────────────

def start_check_in(
    type: Literal["morning_kickoff", "evening_shutdown", "midday_refocus", "weekly_review"],
) -> dict:
    """Start a check-in ritual. Returns a check_in_id for subsequent updates."""
    client = _get_client()
    payload = {
        "user_id": MISHO_USER_ID,
        "type": type,
        "date": date.today().isoformat(),
        "time_started": datetime.now().isoformat(),
        "completed": False,
    }
    result = client.table("check_ins").insert(payload).execute()
    return result.data[0] if result.data else {}


def update_check_in(check_in_id: str, **fields) -> dict:
    """
    Update a check-in's fields as the ritual progresses.

    Common fields:
        energy: 1-10
        mood_notes: free text
        daily_intention: free text (morning)
        ravikant_completed: bool
        daily_win: free text (evening)
        intention_met: bool
        intention_met_notes: free text
        mits_completed_count: int
        tasks_pushed_count: int
        tasks_dropped_count: int
        notes: any extra context
    """
    client = _get_client()
    result = client.table("check_ins").update(fields).eq("id", check_in_id).execute()
    return result.data[0] if result.data else {}


def complete_check_in(check_in_id: str) -> dict:
    """Mark a check-in complete. Calculates duration."""
    client = _get_client()
    existing = client.table("check_ins").select("time_started").eq("id", check_in_id).execute()
    duration = None
    if existing.data:
        started = datetime.fromisoformat(existing.data[0]["time_started"].replace("Z", "+00:00"))
        duration = int((datetime.now(started.tzinfo) - started).total_seconds())
    payload = {
        "completed": True,
        "time_ended": datetime.now().isoformat(),
        "duration_seconds": duration,
    }
    result = client.table("check_ins").update(payload).eq("id", check_in_id).execute()
    return result.data[0] if result.data else {}


def get_last_check_in(type: str) -> Optional[dict]:
    """Get the most recent check-in of a given type. Used to recall yesterday's intention."""
    client = _get_client()
    result = (
        client.table("check_ins")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("type", type)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


# ─── Decisions (silent logging in Phase 1) ────────────────────────────────────

def log_decision(
    description: str,
    decision_type: Literal[
        "financial_commitment",
        "project_start",
        "project_drop",
        "commitment_made",
        "commitment_changed",
        "priority_shift",
        "other",
    ],
    business: Optional[Business] = None,
    amount_usd: Optional[float] = None,
    energy_at_decision: Optional[int] = None,
    notes: Optional[str] = None,
) -> dict:
    """
    Log a major decision Misho is making. Phase 1: silent. Do NOT challenge.
    Phase 2 will use this data for Devil's Advocate triggers.

    Use this when Misho:
    - Commits financial money above ~$500
    - Starts or drops a project
    - Changes a stated priority
    - Makes any decision that future-Misho might want to revisit
    """
    client = _get_client()
    payload = {
        "user_id": MISHO_USER_ID,
        "description": description,
        "decision_type": decision_type,
        "business": business,
        "amount_usd": amount_usd,
        "energy_at_decision": energy_at_decision,
        "time_of_day_bucket": _time_bucket(),
        "notes": notes,
    }
    result = client.table("decisions").insert(payload).execute()
    return result.data[0] if result.data else {}


# ─── Commitment loops (silent tracking) ───────────────────────────────────────

def track_commitment_loop(description: str, task_id: Optional[str] = None) -> dict:
    """
    Silently track that the same commitment has been restated.
    If it's the first time: create a new loop entry with times_restated=1.
    If it's a re-statement: increment times_restated.

    Phase 1: this just accumulates data. Phase 2 will surface loops with
    times_restated >= 3 as Devil's Advocate trigger #5.
    """
    client = _get_client()
    # Crude match: look for an existing loop with similar description
    existing = (
        client.table("commitment_loops")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("resolution", "still_open")
        .ilike("description", f"%{description[:30]}%")
        .limit(1)
        .execute()
    )
    if existing.data:
        # Increment existing
        loop = existing.data[0]
        result = (
            client.table("commitment_loops")
            .update({
                "times_restated": loop["times_restated"] + 1,
                "last_restated_at": datetime.now().isoformat(),
            })
            .eq("id", loop["id"])
            .execute()
        )
        return result.data[0] if result.data else {}
    # New loop
    payload = {
        "user_id": MISHO_USER_ID,
        "description": description,
        "task_id": task_id,
        "times_restated": 1,
    }
    result = client.table("commitment_loops").insert(payload).execute()
    return result.data[0] if result.data else {}


# ─── Summary helpers (for kickoff/shutdown) ───────────────────────────────────

def get_business_summary() -> dict:
    """
    Returns count of open tasks per business and the most urgent task in each.
    Used at the start of morning kickoff to surface the day's landscape.
    """
    client = _get_client()
    summary = {}
    for biz in ["geo_logistics", "nestlink", "crownstone", "personal"]:
        tasks = list_open_tasks(business=biz, limit=5)
        summary[biz] = {
            "open_count": len(tasks),
            "most_urgent": tasks[0] if tasks else None,
            "top_three": tasks[:3],
        }
    return summary


def get_today_completed_tasks() -> list[dict]:
    """Get tasks Misho completed today. Used at evening shutdown."""
    client = _get_client()
    today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
    result = (
        client.table("tasks")
        .select("*")
        .eq("user_id", MISHO_USER_ID)
        .eq("status", "done")
        .gte("completed_at", today_start)
        .execute()
    )
    return result.data or []
