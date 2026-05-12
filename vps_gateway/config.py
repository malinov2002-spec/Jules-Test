"""Config + lazy loaders for prompts and skills.

Reads the SAME files the Hermes Telegram gateway reads (system_prompt.md,
skills/*/SKILL.md) so when you edit a skill, both surfaces pick it up on
the next request.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing env var {name}. See .env.example.")
    return v


HERMES_ROOT = Path(os.getenv("HERMES_ROOT", "/root/.hermes")).expanduser()
SUPABASE_URL = _require("SUPABASE_URL")
SUPABASE_SERVICE_KEY = _require("SUPABASE_SERVICE_KEY")
USER_ID = os.getenv("USER_ID", "11111111-1111-1111-1111-111111111111")
GATEWAY_TOKEN = _require("GATEWAY_TOKEN")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6")

if not (ANTHROPIC_API_KEY or OPENROUTER_API_KEY):
    raise RuntimeError("Set either ANTHROPIC_API_KEY or OPENROUTER_API_KEY in .env")

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8787"))


@lru_cache(maxsize=1)
def system_prompt() -> str:
    p = HERMES_ROOT / "system_prompt.md"
    if not p.exists():
        raise RuntimeError(f"system_prompt.md not found at {p}")
    return p.read_text()


@lru_cache(maxsize=32)
def skill_primer(skill: str) -> str:
    p = HERMES_ROOT / "skills" / skill / "SKILL.md"
    if not p.exists():
        # Free chat / unknown skill — fall back to system prompt only
        return ""
    return p.read_text()


def reload_prompts() -> None:
    """Drop the LRU caches so the next request rereads files from disk."""
    system_prompt.cache_clear()
    skill_primer.cache_clear()
