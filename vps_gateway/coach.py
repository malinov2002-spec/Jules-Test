"""Coach orchestration — load prompts, call LLM, parse ACTION lines, dispatch."""
from __future__ import annotations

import json
import re
from typing import Any

import httpx
from anthropic import Anthropic

from . import config, db


# ─── LLM client ───────────────────────────────────────────────────────────────

_anthropic_client: Anthropic | None = None


def _anthropic() -> Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _anthropic_client


SONNET = "claude-sonnet-4-6"
HAIKU = "claude-haiku-4-5-20251001"


def _call_anthropic(system_blocks: list[dict[str, Any]], messages: list[dict[str, Any]]) -> str:
    resp = _anthropic().messages.create(
        model=SONNET,
        max_tokens=1024,
        temperature=0.7,
        system=system_blocks,
        messages=messages,
    )
    return "".join(b.text for b in resp.content if b.type == "text")


def _call_openrouter(system_blocks: list[dict[str, Any]], messages: list[dict[str, Any]]) -> str:
    # OpenRouter takes a single 'system' string, not blocks.
    system_text = "\n\n".join(b["text"] for b in system_blocks)
    payload = {
        "model": config.OPENROUTER_MODEL,
        "max_tokens": 1024,
        "temperature": 0.7,
        "messages": [{"role": "system", "content": system_text}, *messages],
    }
    with httpx.Client(timeout=60) as client:
        res = client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {config.OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://github.com/malinov2002-spec/Jules-Test",
                "X-Title": "Hermes Mobile Gateway",
            },
            json=payload,
        )
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]


def call_llm(system_blocks: list[dict[str, Any]], messages: list[dict[str, Any]]) -> str:
    if config.ANTHROPIC_API_KEY:
        return _call_anthropic(system_blocks, messages)
    return _call_openrouter(system_blocks, messages)


# ─── Reply parsing ────────────────────────────────────────────────────────────

ACTION_RE = re.compile(r"^\s*ACTION:\s*(\{.*\})\s*$")


def parse_reply(raw: str) -> tuple[str, list[dict[str, Any]]]:
    actions: list[dict[str, Any]] = []
    text_lines: list[str] = []
    for line in raw.splitlines():
        m = ACTION_RE.match(line)
        if m:
            try:
                actions.append(json.loads(m.group(1)))
                continue
            except json.JSONDecodeError:
                pass
        text_lines.append(line)
    return "\n".join(text_lines).strip(), actions


# ─── Action dispatcher ────────────────────────────────────────────────────────

def execute_action(action: dict[str, Any], skill: str) -> None:
    kind = action.get("type")
    if kind == "create_task":
        db.create_task(
            description=action["description"],
            business=action["business"],
            deadline=action.get("deadline"),
            priority=action.get("priority"),
            estimated_minutes=action.get("estimated_minutes"),
            notes=action.get("notes"),
            source=f"coach:{skill}",
        )
    elif kind == "log_decision":
        db.log_decision(
            description=action["description"],
            decision_type=action.get("decision_type", "other"),
            business=action.get("business"),
            amount_usd=action.get("amount_usd"),
        )
    elif kind == "set_intention":
        ci = db.start_check_in("morning_kickoff")
        db.update_check_in(ci["id"], {"daily_intention": action["intention"]})
    elif kind == "set_energy":
        ci = db.start_check_in("morning_kickoff")
        db.update_check_in(
            ci["id"],
            {"energy": action["energy"], "mood_notes": action.get("notes")},
        )
    elif kind == "complete_kickoff":
        ci = db.today_check_in("morning_kickoff")
        if ci:
            db.complete_check_in(ci["id"], ci["time_started"])
    elif kind == "complete_shutdown":
        ci = db.today_check_in("evening_shutdown")
        if ci:
            db.complete_check_in(ci["id"], ci["time_started"])


# ─── Dedup ────────────────────────────────────────────────────────────────────

def ritual_already_done(skill: str, surface: str) -> str | None:
    """If today's kickoff/shutdown was already completed on the OTHER surface,
    return a short message to send back instead of running the ritual again.
    """
    skill_to_type = {
        "morning_kickoff": "morning_kickoff",
        "evening_shutdown": "evening_shutdown",
    }
    ci_type = skill_to_type.get(skill)
    if not ci_type:
        return None

    existing = db.today_check_in(ci_type)
    if not existing or not existing.get("completed"):
        return None

    last_msg = (
        db.client()
        .table("coach_messages")
        .select("surface")
        .eq("user_id", config.USER_ID)
        .eq("skill", skill)
        .gte("created_at", existing["time_started"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    where = (last_msg.data or [{}])[0].get("surface", "the other surface")
    if where == surface:
        # Same surface re-entering — let the model handle it normally.
        return None
    return (
        f"You already did {ci_type.replace('_', ' ')} today on {where}. "
        f"Nothing more here. Want a free chat instead?"
    )


# ─── Context builder ──────────────────────────────────────────────────────────

def build_context_block(skill: str) -> str:
    """Inject live Supabase data into the system context so the model gets
    fresh state on every call.
    """
    parts = [f"Today is {db.iso_date()}. Current bucket: {db.time_bucket()}."]
    if skill == "morning_kickoff":
        opens = db.list_open_tasks()
        parts.append(f"Open tasks: {len(opens)}.")
        for b in ("geo_logistics", "nestlink", "crownstone", "personal"):
            bucket = [t for t in opens if t["business"] == b][:3]
            if bucket:
                rows = "\n".join(
                    f"  - {t['description']}"
                    + (f" (due {t['deadline']})" if t.get("deadline") else "")
                    for t in bucket
                )
                parts.append(f"{b}: {len(bucket)} top\n{rows}")
    elif skill == "evening_shutdown":
        mits = (
            db.client()
            .table("mits")
            .select("*, task:tasks(description)")
            .eq("user_id", config.USER_ID)
            .eq("date", db.iso_date())
            .execute()
        )
        ci = db.today_check_in("morning_kickoff")
        if ci:
            parts.append(f"Morning intention: {ci.get('daily_intention') or '(none)'}")
            parts.append(f"Morning energy: {ci.get('energy') or '(none)'} / 10")
        if mits.data:
            parts.append("Today's MITs:")
            for m in mits.data:
                parts.append(
                    f"  - [{m['business']}] {m.get('task', {}).get('description', '(no task)')} "
                    f"{'done' if m['completed'] else 'open'}"
                )
    return "\n".join(parts)


# ─── Main entry point ────────────────────────────────────────────────────────

def run(thread: str, skill: str, user_message: str, surface: str) -> dict[str, Any]:
    db.append_message(thread, "user", user_message, skill, surface)

    short_circuit = ritual_already_done(skill, surface)
    if short_circuit:
        db.append_message(thread, "assistant", short_circuit, skill, surface)
        return {"text": short_circuit, "actions": [], "skipped": True}

    system_blocks: list[dict[str, Any]] = [
        {"type": "text", "text": config.system_prompt()},
    ]
    primer = config.skill_primer(skill)
    if primer:
        system_blocks.append({"type": "text", "text": primer})
    ctx = build_context_block(skill)
    if ctx:
        system_blocks.append({"type": "text", "text": ctx})

    history = db.load_thread(thread, limit=20)
    messages = [
        {"role": h["role"], "content": h["content"]}
        for h in history
        if h["role"] in ("user", "assistant")
    ]
    # Drop the duplicate last user message we just inserted
    if messages and messages[-1]["role"] == "user" and messages[-1]["content"] == user_message:
        messages = messages[:-1]
    messages.append({"role": "user", "content": user_message})

    raw = call_llm(system_blocks, messages)
    text, actions = parse_reply(raw)

    if text:
        db.append_message(thread, "assistant", text, skill, surface)

    for a in actions:
        try:
            execute_action(a, skill)
        except Exception as e:  # noqa: BLE001
            db.append_message(
                thread,
                "system",
                f"Action failed: {e}\n{json.dumps(a)}",
                skill,
                surface,
            )

    return {"text": text, "actions": actions, "skipped": False}
