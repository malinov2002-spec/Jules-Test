"""Thin Supabase wrapper. Mirrors the JS client shape used by the mobile app
so behavior stays consistent across surfaces.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from supabase import Client, create_client

from . import config


_client: Optional[Client] = None


def client() -> Client:
    global _client
    if _client is None:
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    return _client


def time_bucket(d: datetime | None = None) -> str:
    d = d or datetime.now()
    h = d.hour
    if 5 <= h < 12:
        return "morning"
    if 12 <= h < 17:
        return "midday"
    if 17 <= h < 22:
        return "evening"
    return "late_night"


def iso_date(d: datetime | None = None) -> str:
    d = d or datetime.now()
    return d.strftime("%Y-%m-%d")


# ─── Chat history ─────────────────────────────────────────────────────────────

def append_message(thread: str, role: str, content: str, skill: str | None, surface: str) -> None:
    client().table("coach_messages").insert(
        {
            "user_id": config.USER_ID,
            "thread": thread,
            "role": role,
            "content": content,
            "skill": skill,
            "surface": surface,
        }
    ).execute()


def load_thread(thread: str, limit: int = 30) -> list[dict[str, Any]]:
    res = (
        client()
        .table("coach_messages")
        .select("role, content, skill, surface, created_at")
        .eq("user_id", config.USER_ID)
        .eq("thread", thread)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return res.data or []


# ─── Tasks ────────────────────────────────────────────────────────────────────

def create_task(**fields: Any) -> dict[str, Any]:
    payload = {
        "user_id": config.USER_ID,
        "status": "open",
        "type": "task",
        "created_time_bucket": time_bucket(),
        **fields,
    }
    res = client().table("tasks").insert(payload).execute()
    return res.data[0]


def list_open_tasks(business: str | None = None) -> list[dict[str, Any]]:
    q = (
        client()
        .table("tasks")
        .select("*")
        .eq("user_id", config.USER_ID)
        .in_("status", ["open", "captured_for_review", "in_progress"])
        .order("deadline", desc=False)
    )
    if business:
        q = q.eq("business", business)
    return (q.execute()).data or []


# ─── Check-ins ────────────────────────────────────────────────────────────────

def today_check_in(check_type: str) -> dict[str, Any] | None:
    res = (
        client()
        .table("check_ins")
        .select("*")
        .eq("user_id", config.USER_ID)
        .eq("date", iso_date())
        .eq("type", check_type)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def start_check_in(check_type: str) -> dict[str, Any]:
    existing = today_check_in(check_type)
    if existing:
        return existing
    res = (
        client()
        .table("check_ins")
        .insert({"user_id": config.USER_ID, "type": check_type, "date": iso_date()})
        .execute()
    )
    return res.data[0]


def update_check_in(check_in_id: str, patch: dict[str, Any]) -> None:
    client().table("check_ins").update(patch).eq("id", check_in_id).execute()


def complete_check_in(check_in_id: str, started_at: str) -> None:
    ended = datetime.now(timezone.utc)
    started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    duration = int((ended - started).total_seconds())
    client().table("check_ins").update(
        {
            "completed": True,
            "time_ended": ended.isoformat(),
            "duration_seconds": duration,
        }
    ).eq("id", check_in_id).execute()


# ─── Decisions ────────────────────────────────────────────────────────────────

def log_decision(**fields: Any) -> None:
    client().table("decisions").insert(
        {
            "user_id": config.USER_ID,
            "time_of_day_bucket": time_bucket(),
            **fields,
        }
    ).execute()


# ─── Devices ──────────────────────────────────────────────────────────────────

def register_device(platform: str, push_token: str, name: str | None) -> dict[str, Any]:
    res = (
        client()
        .table("devices")
        .upsert(
            {
                "user_id": config.USER_ID,
                "platform": platform,
                "push_token": push_token,
                "device_name": name,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="push_token",
        )
        .execute()
    )
    return res.data[0]
