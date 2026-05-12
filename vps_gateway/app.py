"""FastAPI gateway. Run with:

    cd ~/hermes_mobile/vps_gateway
    uvicorn vps_gateway.app:app --host 127.0.0.1 --port 8787

In production, behind nginx/caddy with TLS termination. See SETUP.md.
"""
from __future__ import annotations

from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from . import config
from .coach import run
from .db import register_device


app = FastAPI(title="Hermes Coach Gateway", version="0.1.0")


def auth(authorization: str = Header(default="")) -> None:
    expected = f"Bearer {config.GATEWAY_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class CoachRequest(BaseModel):
    thread: str = "main"
    skill: Literal[
        "morning_kickoff",
        "evening_shutdown",
        "quick_capture",
        "task_breakdown",
        "time_suggestion",
        "free_chat",
    ] = "free_chat"
    message: str
    surface: Literal["mobile_android", "mobile_ios", "telegram", "web", "cli"] = "mobile_android"


class CoachResponse(BaseModel):
    text: str
    actions: list[dict]
    skipped: bool


class DeviceRequest(BaseModel):
    platform: Literal["android", "ios", "web"]
    push_token: str
    device_name: str | None = None


@app.get("/health")
def health() -> dict:
    return {"ok": True, "user_id": config.USER_ID}


@app.post("/coach", response_model=CoachResponse, dependencies=[Depends(auth)])
def coach(req: CoachRequest) -> CoachResponse:
    result = run(req.thread, req.skill, req.message, req.surface)
    return CoachResponse(**result)


@app.post("/devices", dependencies=[Depends(auth)])
def devices(req: DeviceRequest) -> dict:
    row = register_device(req.platform, req.push_token, req.device_name)
    return {"id": row["id"]}


@app.post("/reload", dependencies=[Depends(auth)])
def reload() -> dict:
    """Drop the prompt/skill file cache so the next /coach request rereads.

    Useful when you edit ~/.hermes/skills/.../SKILL.md and want the change
    to take effect immediately without restarting the service.
    """
    config.reload_prompts()
    return {"reloaded": True}
