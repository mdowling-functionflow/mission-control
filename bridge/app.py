"""
Local Bridge — a lightweight companion service for Mission Control.

Runs on Michael's machine alongside OpenClaw. Provides authenticated
filesystem access for skills editing and other local-only operations.
The cloud backend proxies requests here when BRIDGE_URL is configured.
"""

from __future__ import annotations

import base64
import os
from datetime import datetime, UTC
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Header, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
OPENCLAW_DIR = os.environ.get("OPENCLAW_DIR", str(Path.home() / ".openclaw"))

app = FastAPI(title="Mission Control Local Bridge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


async def verify_token(x_bridge_token: str = Header(...)):
    if not BRIDGE_TOKEN:
        raise HTTPException(status_code=500, detail="BRIDGE_TOKEN not configured")
    if x_bridge_token != BRIDGE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid bridge token")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

KEY_FILES = {"SKILL.md", "README.md", "AGENTS.md", "SOUL.md", "config.json", "config.yaml"}
READABLE_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".sh", ".py", ".js", ".ts"}
MAX_FILE_SIZE = 100_000


class SkillSummary(BaseModel):
    name: str
    path: str
    encoded_path: str
    summary: str | None = None
    source: str
    last_modified: str | None = None
    file_count: int = 0


class SkillFile(BaseModel):
    name: str
    path: str
    content: str
    size: int


class SkillDetail(BaseModel):
    name: str
    path: str
    encoded_path: str
    summary: str | None = None
    source: str
    files: list[SkillFile] = []
    all_files: list[str] = []


class ChangeRequest(BaseModel):
    request: str


class ChangeProposal(BaseModel):
    request: str
    affected_files: list[str] = []
    current_content: dict[str, str] = {}
    rationale: str = ""
    risks: list[str] = []


class ApplyRequest(BaseModel):
    file_path: str
    new_content: str


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    message: str


class ValidationResult(BaseModel):
    success: bool
    checks: list[ValidationCheck] = []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"ok": True, "openclaw_dir": OPENCLAW_DIR}


@app.get("/skills", response_model=list[SkillSummary], dependencies=[Depends(verify_token)])
async def list_skills():
    results: list[SkillSummary] = []
    for source_label, skill_dir in _get_skill_dirs():
        if not skill_dir.is_dir():
            continue
        for entry in sorted(skill_dir.iterdir()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            encoded = base64.urlsafe_b64encode(str(entry).encode()).decode()
            results.append(SkillSummary(
                name=entry.name,
                path=str(entry),
                encoded_path=encoded,
                summary=_read_skill_summary(entry),
                source=source_label,
                last_modified=_get_dir_mtime(entry),
                file_count=sum(1 for f in entry.iterdir() if f.is_file()),
            ))
    return results


@app.get("/skills/{encoded_path}", response_model=SkillDetail, dependencies=[Depends(verify_token)])
async def get_skill(encoded_path: str):
    skill_dir = _decode_path(encoded_path)
    files: list[SkillFile] = []
    all_files: list[str] = []

    for entry in sorted(skill_dir.iterdir()):
        if not entry.is_file():
            continue
        all_files.append(entry.name)
        if entry.name in KEY_FILES or (
            entry.suffix in READABLE_EXTENSIONS and entry.stat().st_size < MAX_FILE_SIZE
        ):
            try:
                content = entry.read_text(encoding="utf-8", errors="replace")
                files.append(SkillFile(name=entry.name, path=str(entry), content=content, size=len(content)))
            except OSError:
                pass

    source = "workspace/skills" if "workspace/skills" in str(skill_dir) else "skills"
    return SkillDetail(
        name=skill_dir.name,
        path=str(skill_dir),
        encoded_path=encoded_path,
        summary=_read_skill_summary(skill_dir),
        source=source,
        files=files,
        all_files=all_files,
    )


@app.post("/skills/{encoded_path}/propose-change", response_model=ChangeProposal, dependencies=[Depends(verify_token)])
async def propose_change(encoded_path: str, body: ChangeRequest):
    skill_dir = _decode_path(encoded_path)
    affected: list[str] = []
    content: dict[str, str] = {}

    for fname in ("SKILL.md", "README.md"):
        fpath = skill_dir / fname
        if fpath.exists():
            affected.append(fname)
            content[fname] = fpath.read_text(encoding="utf-8", errors="replace")

    return ChangeProposal(
        request=body.request,
        affected_files=affected,
        current_content=content,
        rationale=f"Change requested: {body.request}",
        risks=["Ensure the skill still functions after editing.", "Review for unintended prompt changes."],
    )


@app.post("/skills/{encoded_path}/apply-change", response_model=ValidationResult, dependencies=[Depends(verify_token)])
async def apply_change(encoded_path: str, body: ApplyRequest):
    skill_dir = _decode_path(encoded_path)
    target = skill_dir / body.file_path

    # Security: ensure within skill dir
    try:
        target.resolve().relative_to(skill_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Target outside skill directory")

    try:
        target.write_text(body.new_content, encoding="utf-8")
    except OSError as e:
        return ValidationResult(success=False, checks=[
            ValidationCheck(name="write", passed=False, message=str(e))
        ])

    checks: list[ValidationCheck] = []
    skill_md = skill_dir / "SKILL.md"
    checks.append(ValidationCheck(
        name="skill_md_exists",
        passed=skill_md.exists(),
        message="SKILL.md exists" if skill_md.exists() else "SKILL.md missing!",
    ))
    if skill_md.exists():
        try:
            text = skill_md.read_text(encoding="utf-8")
            checks.append(ValidationCheck(
                name="skill_md_readable",
                passed=len(text) > 0,
                message=f"SKILL.md readable ({len(text)} chars)",
            ))
        except OSError:
            checks.append(ValidationCheck(name="skill_md_readable", passed=False, message="Cannot read"))

    if target.exists():
        written = target.read_text(encoding="utf-8")
        checks.append(ValidationCheck(
            name="file_written",
            passed=written == body.new_content,
            message=f"{body.file_path} written ({len(written)} chars)",
        ))

    return ValidationResult(success=all(c.passed for c in checks), checks=checks)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_skill_dirs() -> list[tuple[str, Path]]:
    base = Path(OPENCLAW_DIR)
    return [("skills", base / "skills"), ("workspace/skills", base / "workspace" / "skills")]


def _decode_path(encoded: str) -> Path:
    try:
        decoded = base64.urlsafe_b64decode(encoded).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path encoding")
    p = Path(decoded)
    if not p.is_dir():
        raise HTTPException(status_code=404, detail="Skill not found")
    try:
        p.resolve().relative_to(Path(OPENCLAW_DIR).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path outside OpenClaw directory")
    return p


def _read_skill_summary(d: Path) -> str | None:
    f = d / "SKILL.md"
    if not f.exists():
        return None
    try:
        for line in f.read_text(encoding="utf-8", errors="replace").split("\n"):
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("---"):
                return line[:200]
    except OSError:
        pass
    return None


def _get_dir_mtime(d: Path) -> str | None:
    try:
        mtimes = [f.stat().st_mtime for f in d.iterdir() if f.is_file()]
        if mtimes:
            return datetime.fromtimestamp(max(mtimes), tz=UTC).replace(tzinfo=None).isoformat()
    except OSError:
        pass
    return None


# ---------------------------------------------------------------------------
# Agent Chat — execute agent via OpenClaw CLI
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    agent_id: str  # openclaw agent id like "main", "sales"
    message: str
    session_id: str | None = None  # optional thread-specific session


class ChatResponse(BaseModel):
    response: str | None = None
    error: str | None = None


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_token)])
async def chat_with_agent(body: ChatRequest):
    """Send a message to an agent via OpenClaw CLI and return the response."""
    import asyncio
    import json as json_lib

    cmd = [
        "openclaw", "agent",
        "--agent", body.agent_id,
        "--message", body.message,
        "--session-id", body.session_id or f"mc-{body.agent_id}",
        "--json",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
    except asyncio.TimeoutError:
        return ChatResponse(error="Agent timed out (300s)")
    except FileNotFoundError:
        return ChatResponse(error="openclaw CLI not found")

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        return ChatResponse(error=err[:500] if err else "Agent execution failed")

    output = stdout.decode("utf-8", errors="replace").strip()
    if not output:
        return ChatResponse(response=None)

    try:
        data = json_lib.loads(output)
        if isinstance(data, dict):
            payloads = data.get("result", {}).get("payloads", [])
            if payloads:
                texts = [p.get("text", "") for p in payloads if p.get("text")]
                if texts:
                    return ChatResponse(response="\n\n".join(texts))
        return ChatResponse(response=output)
    except json_lib.JSONDecodeError:
        return ChatResponse(response=output)


# ---------------------------------------------------------------------------
# Chat File Upload
# ---------------------------------------------------------------------------

@app.post("/chat/upload", dependencies=[Depends(verify_token)])
async def upload_chat_file(file: UploadFile = File(...)):
    """Upload a file for chat attachments. Saves to ~/.openclaw/uploads/."""
    import uuid as uuid_mod
    uploads_dir = Path.home() / ".openclaw" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename or "attachment"
    dest = uploads_dir / f"{uuid_mod.uuid4().hex[:8]}_{safe_name}"
    content = await file.read()
    dest.write_bytes(content)

    return {
        "path": str(dest),
        "name": safe_name,
        "mime": file.content_type or "application/octet-stream",
        "size": len(content),
    }


# ---------------------------------------------------------------------------
# Agent Creation — create new OpenClaw agents via CLI
# ---------------------------------------------------------------------------

class AgentCreateRequest(BaseModel):
    agent_id: str  # slug like "research-assistant"
    workspace: str | None = None  # optional custom workspace path


class AgentCreateResponse(BaseModel):
    success: bool
    agent_id: str
    workspace: str | None = None
    error: str | None = None


@app.post("/agents/create", response_model=AgentCreateResponse, dependencies=[Depends(verify_token)])
async def create_agent(body: AgentCreateRequest):
    """Create a new OpenClaw agent via CLI."""
    workspace = body.workspace or str(Path(OPENCLAW_DIR) / f"workspace-{body.agent_id}")

    cmd = [
        "openclaw", "agents", "add", body.agent_id,
        "--workspace", workspace,
        "--non-interactive",
        "--json",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    except asyncio.TimeoutError:
        return AgentCreateResponse(success=False, agent_id=body.agent_id, error="Timed out")
    except FileNotFoundError:
        return AgentCreateResponse(success=False, agent_id=body.agent_id, error="openclaw CLI not found")

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        return AgentCreateResponse(success=False, agent_id=body.agent_id, error=err[:500])

    return AgentCreateResponse(success=True, agent_id=body.agent_id, workspace=workspace)


# ---------------------------------------------------------------------------
# Cron / Schedules — manage OpenClaw cron jobs via CLI
# ---------------------------------------------------------------------------

class CronJobCreate(BaseModel):
    name: str
    agent_id: str | None = None
    cron_expr: str | None = None  # 5-field cron expression
    every: str | None = None  # e.g. "10m", "1h"
    message: str = ""
    description: str | None = None
    tz: str = "Europe/Dublin"
    session: str = "isolated"
    model: str | None = None
    timeout_seconds: int | None = None
    thinking: str | None = None


class CronJobEdit(BaseModel):
    name: str | None = None
    cron_expr: str | None = None
    every: str | None = None
    message: str | None = None
    description: str | None = None
    tz: str | None = None
    model: str | None = None
    timeout_seconds: int | None = None
    thinking: str | None = None
    enabled: bool | None = None


async def _run_cron_cmd(args: list[str], timeout: int = 30) -> dict | list | str:
    """Run an openclaw cron command and return parsed JSON output."""
    cmd = ["openclaw", "cron", *args, "--json"]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Cron command timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="openclaw CLI not found")

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        raise HTTPException(status_code=502, detail=err[:500] or "Cron command failed")

    output = stdout.decode("utf-8", errors="replace").strip()
    if not output:
        return {}
    try:
        return json_lib.loads(output)
    except json_lib.JSONDecodeError:
        return output


@app.get("/cron/list", dependencies=[Depends(verify_token)])
async def cron_list():
    """List all cron jobs."""
    return await _run_cron_cmd(["list", "--all"])


@app.get("/cron/status", dependencies=[Depends(verify_token)])
async def cron_status():
    """Get cron scheduler status."""
    return await _run_cron_cmd(["status"])


@app.post("/cron/add", dependencies=[Depends(verify_token)])
async def cron_add(body: CronJobCreate):
    """Create a new cron job."""
    args = ["add", "--name", body.name]
    if body.agent_id:
        args += ["--agent", body.agent_id]
    if body.cron_expr:
        args += ["--cron", body.cron_expr]
    if body.every:
        args += ["--every", body.every]
    if body.message:
        args += ["--message", body.message]
    if body.description:
        args += ["--description", body.description]
    if body.tz:
        args += ["--tz", body.tz]
    if body.session:
        args += ["--session", body.session]
    if body.model:
        args += ["--model", body.model]
    if body.timeout_seconds:
        args += ["--timeout-seconds", str(body.timeout_seconds)]
    if body.thinking:
        args += ["--thinking", body.thinking]
    return await _run_cron_cmd(args)


@app.post("/cron/edit/{job_id}", dependencies=[Depends(verify_token)])
async def cron_edit(job_id: str, body: CronJobEdit):
    """Edit an existing cron job."""
    args = ["edit", job_id]
    if body.name:
        args += ["--name", body.name]
    if body.cron_expr:
        args += ["--cron", body.cron_expr]
    if body.every:
        args += ["--every", body.every]
    if body.message is not None:
        args += ["--message", body.message]
    if body.description is not None:
        args += ["--description", body.description]
    if body.tz:
        args += ["--tz", body.tz]
    if body.model:
        args += ["--model", body.model]
    if body.timeout_seconds:
        args += ["--timeout-seconds", str(body.timeout_seconds)]
    if body.thinking:
        args += ["--thinking", body.thinking]
    if body.enabled is True:
        args += ["--enable"]
    elif body.enabled is False:
        args += ["--disable"]
    return await _run_cron_cmd(args)


@app.delete("/cron/remove/{job_id}", dependencies=[Depends(verify_token)])
async def cron_remove(job_id: str):
    """Remove a cron job."""
    # rm doesn't support --json, use plain command
    cmd = ["openclaw", "cron", "rm", job_id]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if proc.returncode != 0:
        raise HTTPException(status_code=502, detail=stderr.decode()[:500])
    return {"ok": True}


@app.post("/cron/run/{job_id}", dependencies=[Depends(verify_token)])
async def cron_run(job_id: str):
    """Run a cron job now (debug/manual trigger)."""
    return await _run_cron_cmd(["run", job_id], timeout=120)


@app.post("/cron/enable/{job_id}", dependencies=[Depends(verify_token)])
async def cron_enable(job_id: str):
    """Enable a cron job."""
    return await _run_cron_cmd(["edit", job_id, "--enable"])


@app.post("/cron/disable/{job_id}", dependencies=[Depends(verify_token)])
async def cron_disable(job_id: str):
    """Disable a cron job."""
    return await _run_cron_cmd(["edit", job_id, "--disable"])


@app.get("/cron/runs", dependencies=[Depends(verify_token)])
async def cron_runs(job_id: str | None = None, limit: int = 50):
    """Get cron run history."""
    # runs command doesn't support --json well, try plain
    cmd = ["openclaw", "cron", "runs"]
    if job_id:
        cmd += ["--id", job_id]
    cmd += ["--limit", str(limit)]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    output = stdout.decode("utf-8", errors="replace").strip()
    try:
        return json_lib.loads(output)
    except json_lib.JSONDecodeError:
        return {"raw": output}


# Need json/asyncio imports for cron and document commands
import json as json_lib
import asyncio
import mimetypes


# ---------------------------------------------------------------------------
# Documents — discover and serve local files
# ---------------------------------------------------------------------------

DISCOVER_DIRS = [
    Path.home() / "Documents" / "OpenClaw",
]
DISCOVER_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".md", ".txt", ".csv"}


class DiscoveredFileInfo(BaseModel):
    path: str
    name: str
    mime_type: str
    size: int
    last_modified: str | None = None


@app.get("/documents/discover", response_model=list[DiscoveredFileInfo], dependencies=[Depends(verify_token)])
async def discover_documents():
    """Scan known directories for importable document files."""
    results: list[DiscoveredFileInfo] = []
    for d in DISCOVER_DIRS:
        if not d.is_dir():
            continue
        for entry in sorted(d.rglob("*")):
            if not entry.is_file():
                continue
            if entry.suffix.lower() not in DISCOVER_EXTENSIONS:
                continue
            if any(part.startswith(".") or part == "node_modules" for part in entry.parts):
                continue
            mime = mimetypes.guess_type(str(entry))[0] or "application/octet-stream"
            mtime = datetime.fromtimestamp(entry.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
            results.append(DiscoveredFileInfo(
                path=str(entry),
                name=entry.name,
                mime_type=mime,
                size=entry.stat().st_size,
                last_modified=mtime,
            ))
    return results


@app.get("/documents/serve", dependencies=[Depends(verify_token)])
async def serve_document(path: str):
    """Serve a local file by path."""
    from fastapi.responses import FileResponse
    fpath = Path(path)
    if not fpath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    # Security: must be within home directory
    try:
        fpath.resolve().relative_to(Path.home().resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path outside home directory")
    mime = mimetypes.guess_type(str(fpath))[0] or "application/octet-stream"
    return FileResponse(str(fpath), media_type=mime, filename=fpath.name)


# ---------------------------------------------------------------------------
# Agent Spec Files — read/write real agent workspace files
# ---------------------------------------------------------------------------

AGENT_SPEC_FILES = {
    "SOUL.md", "MEMORY.md", "USER.md", "IDENTITY.md", "HEARTBEAT.md",
    "TOOLS.md", "AGENTS.md", "PRIVACY.md", "SESSION-STATE.md",
    "USER.shared-reference.md",
}


def _resolve_agent_workspace(agent_id: str) -> Path:
    """Resolve agent workspace directory."""
    base = Path(OPENCLAW_DIR)
    if agent_id == "main":
        return base / "workspace"
    return base / f"workspace-{agent_id}"


class AgentFileInfo(BaseModel):
    name: str
    size: int
    last_modified: str | None = None
    is_memory: bool = False


class AgentFileContent(BaseModel):
    name: str
    content: str
    size: int
    last_modified: str | None = None


class AgentFileWrite(BaseModel):
    content: str


@app.get("/agent-files/{agent_id}", response_model=list[AgentFileInfo], dependencies=[Depends(verify_token)])
async def list_agent_files(agent_id: str):
    """List spec files in an agent's workspace."""
    ws = _resolve_agent_workspace(agent_id)
    if not ws.is_dir():
        return []

    files: list[AgentFileInfo] = []

    # Spec files
    for entry in sorted(ws.iterdir()):
        if entry.is_file() and entry.name in AGENT_SPEC_FILES:
            mtime = datetime.fromtimestamp(entry.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
            files.append(AgentFileInfo(
                name=entry.name,
                size=entry.stat().st_size,
                last_modified=mtime,
            ))

    # Memory files (memory/*.md)
    memory_dir = ws / "memory"
    if memory_dir.is_dir():
        for entry in sorted(memory_dir.iterdir()):
            if entry.is_file() and entry.suffix == ".md":
                mtime = datetime.fromtimestamp(entry.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()
                files.append(AgentFileInfo(
                    name=f"memory/{entry.name}",
                    size=entry.stat().st_size,
                    last_modified=mtime,
                    is_memory=True,
                ))

    return files


@app.get("/agent-files/{agent_id}/{filename:path}", response_model=AgentFileContent, dependencies=[Depends(verify_token)])
async def read_agent_file(agent_id: str, filename: str):
    """Read a single agent spec or memory file."""
    # Security: validate filename
    base_name = filename.split("/")[-1] if "/" in filename else filename
    if filename.startswith("memory/"):
        if not base_name.endswith(".md"):
            raise HTTPException(status_code=400, detail="Only .md memory files allowed")
    elif filename not in AGENT_SPEC_FILES:
        raise HTTPException(status_code=400, detail=f"File '{filename}' not in allowed set")

    ws = _resolve_agent_workspace(agent_id)
    fpath = ws / filename

    if not fpath.is_file():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")

    # Security: ensure within workspace
    try:
        fpath.resolve().relative_to(ws.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal")

    content = fpath.read_text(encoding="utf-8", errors="replace")
    mtime = datetime.fromtimestamp(fpath.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()

    return AgentFileContent(
        name=filename,
        content=content,
        size=len(content),
        last_modified=mtime,
    )


@app.put("/agent-files/{agent_id}/{filename:path}", response_model=AgentFileContent, dependencies=[Depends(verify_token)])
async def write_agent_file(agent_id: str, filename: str, body: AgentFileWrite):
    """Write a single agent spec or memory file."""
    base_name = filename.split("/")[-1] if "/" in filename else filename
    if filename.startswith("memory/"):
        if not base_name.endswith(".md"):
            raise HTTPException(status_code=400, detail="Only .md memory files allowed")
    elif filename not in AGENT_SPEC_FILES:
        raise HTTPException(status_code=400, detail=f"File '{filename}' not in allowed set")

    ws = _resolve_agent_workspace(agent_id)
    fpath = ws / filename

    # Security: ensure within workspace
    try:
        fpath.resolve().relative_to(ws.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal")

    # Create parent directories if needed (for memory/ files)
    fpath.parent.mkdir(parents=True, exist_ok=True)

    fpath.write_text(body.content, encoding="utf-8")
    mtime = datetime.fromtimestamp(fpath.stat().st_mtime, tz=UTC).replace(tzinfo=None).isoformat()

    return AgentFileContent(
        name=filename,
        content=body.content,
        size=len(body.content),
        last_modified=mtime,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
