"""API routes for reading and editing agent spec files (SOUL.md, MEMORY.md, etc.)

Routes through the local bridge for filesystem access, same pattern as skills_editor.py.
"""

from __future__ import annotations

from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, status
from sqlmodel import SQLModel

from app.api.deps import ORG_MEMBER_DEP
from app.core.config import settings
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/agent-files", tags=["agent-files"])

AGENT_SPEC_FILES = {
    "SOUL.md", "MEMORY.md", "USER.md", "IDENTITY.md", "HEARTBEAT.md",
    "TOOLS.md", "AGENTS.md", "PRIVACY.md", "SESSION-STATE.md",
    "USER.shared-reference.md",
}


class AgentFileInfo(SQLModel):
    name: str
    size: int
    last_modified: str | None = None
    is_memory: bool = False


class AgentFileContent(SQLModel):
    name: str
    content: str
    size: int
    last_modified: str | None = None


class AgentFileWrite(SQLModel):
    content: str


def _is_bridge_mode() -> bool:
    return bool(settings.bridge_url)


def _is_local_mode() -> bool:
    return bool(settings.openclaw_dir)


def _resolve_workspace(agent_id: str) -> Path:
    base = Path(settings.openclaw_dir)
    if agent_id == "main":
        return base / "workspace"
    return base / f"workspace-{agent_id}"


async def _bridge_get(path: str) -> dict | list:
    url = f"{settings.bridge_url.rstrip('/')}{path}"
    headers = {"X-Bridge-Token": settings.bridge_token}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


async def _bridge_put(path: str, json_body: dict) -> dict:
    url = f"{settings.bridge_url.rstrip('/')}{path}"
    headers = {"X-Bridge-Token": settings.bridge_token}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.put(url, headers=headers, json=json_body)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@router.get("/{agent_id}", response_model=list[AgentFileInfo])
async def list_agent_files(
    agent_id: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[AgentFileInfo]:
    """List spec files in an agent's workspace."""
    if _is_bridge_mode():
        data = await _bridge_get(f"/agent-files/{agent_id}")
        return [AgentFileInfo(**f) for f in data]
    if _is_local_mode():
        return _local_list(agent_id)
    return []


@router.get("/{agent_id}/{filename:path}", response_model=AgentFileContent)
async def read_agent_file(
    agent_id: str,
    filename: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> AgentFileContent:
    if _is_bridge_mode():
        data = await _bridge_get(f"/agent-files/{agent_id}/{filename}")
        return AgentFileContent(**data)
    if _is_local_mode():
        return _local_read(agent_id, filename)
    raise HTTPException(status_code=503, detail="No agent files backend available")


@router.put("/{agent_id}/{filename:path}", response_model=AgentFileContent)
async def write_agent_file(
    agent_id: str,
    filename: str,
    body: AgentFileWrite,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> AgentFileContent:
    if _is_bridge_mode():
        data = await _bridge_put(f"/agent-files/{agent_id}/{filename}", {"content": body.content})
        return AgentFileContent(**data)
    if _is_local_mode():
        return _local_write(agent_id, filename, body.content)
    raise HTTPException(status_code=503, detail="No agent files backend available")


# ─── Local Mode ───────────────────────────────────────────────────────

def _local_list(agent_id: str) -> list[AgentFileInfo]:
    from datetime import datetime, UTC
    ws = _resolve_workspace(agent_id)
    if not ws.is_dir():
        return []

    files: list[AgentFileInfo] = []
    for entry in sorted(ws.iterdir()):
        if entry.is_file() and entry.name in AGENT_SPEC_FILES:
            mtime = datetime.fromtimestamp(entry.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
            files.append(AgentFileInfo(name=entry.name, size=entry.stat().st_size, last_modified=mtime))

    memory_dir = ws / "memory"
    if memory_dir.is_dir():
        for entry in sorted(memory_dir.iterdir()):
            if entry.is_file() and entry.suffix == ".md":
                mtime = datetime.fromtimestamp(entry.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
                files.append(AgentFileInfo(name=f"memory/{entry.name}", size=entry.stat().st_size, last_modified=mtime, is_memory=True))

    return files


def _local_read(agent_id: str, filename: str) -> AgentFileContent:
    from datetime import datetime, UTC
    ws = _resolve_workspace(agent_id)
    fpath = ws / filename
    if not fpath.is_file():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    try:
        fpath.resolve().relative_to(ws.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal")

    content = fpath.read_text(encoding="utf-8", errors="replace")
    mtime = datetime.fromtimestamp(fpath.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
    return AgentFileContent(name=filename, content=content, size=len(content), last_modified=mtime)


def _local_write(agent_id: str, filename: str, content: str) -> AgentFileContent:
    from datetime import datetime, UTC
    ws = _resolve_workspace(agent_id)
    fpath = ws / filename
    try:
        fpath.resolve().relative_to(ws.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal")

    fpath.parent.mkdir(parents=True, exist_ok=True)
    fpath.write_text(content, encoding="utf-8")
    mtime = datetime.fromtimestamp(fpath.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
    return AgentFileContent(name=filename, content=content, size=len(content), last_modified=mtime)
