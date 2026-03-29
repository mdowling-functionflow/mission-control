"""API routes for browsing and editing installed OpenClaw skills.

Supports two modes:
- Local mode: OPENCLAW_DIR is set, reads/writes filesystem directly
- Bridge mode: BRIDGE_URL is set, proxies requests to the local bridge service
"""

from __future__ import annotations

import base64
import os
from datetime import datetime, UTC
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, status
from sqlmodel import SQLModel

from app.api.deps import ORG_MEMBER_DEP
from app.core.config import settings
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/installed-skills", tags=["skills-editor"])

KEY_FILES = {"SKILL.md", "README.md", "AGENTS.md", "SOUL.md", "config.json", "config.yaml"}
READABLE_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".sh", ".py", ".js", ".ts"}
MAX_FILE_SIZE = 100_000


# ─── Schemas ──────────────────────────────────────────────────────────

class InstalledSkillSummary(SQLModel):
    name: str
    path: str
    encoded_path: str
    summary: str | None = None
    source: str
    last_modified: str | None = None
    file_count: int = 0


class SkillFileContent(SQLModel):
    name: str
    path: str
    content: str
    size: int


class InstalledSkillDetail(SQLModel):
    name: str
    path: str
    encoded_path: str
    summary: str | None = None
    source: str
    files: list[SkillFileContent] = []
    all_files: list[str] = []


class ChangeRequest(SQLModel):
    request: str


class ChangeProposal(SQLModel):
    request: str
    affected_files: list[str] = []
    current_content: dict[str, str] = {}
    rationale: str = ""
    risks: list[str] = []


class ApplyChangeRequest(SQLModel):
    file_path: str
    new_content: str


class ValidationCheck(SQLModel):
    name: str
    passed: bool
    message: str


class ValidationResult(SQLModel):
    success: bool
    checks: list[ValidationCheck] = []


# ─── Mode Detection ───────────────────────────────────────────────────

def _is_bridge_mode() -> bool:
    return bool(settings.bridge_url)


def _is_local_mode() -> bool:
    return bool(settings.openclaw_dir)


async def _bridge_request(method: str, path: str, json_body: dict | None = None) -> dict | list:
    """Proxy a request to the local bridge."""
    url = f"{settings.bridge_url.rstrip('/')}{path}"
    headers = {"X-Bridge-Token": settings.bridge_token}
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == "GET":
            resp = await client.get(url, headers=headers)
        elif method == "POST":
            resp = await client.post(url, headers=headers, json=json_body)
        else:
            raise ValueError(f"Unsupported method: {method}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


# ─── Routes ───────────────────────────────────────────────────────────

@router.get("", response_model=list[InstalledSkillSummary])
async def list_installed_skills(
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[InstalledSkillSummary]:
    if _is_bridge_mode():
        data = await _bridge_request("GET", "/skills")
        return [InstalledSkillSummary(**s) for s in data]
    if _is_local_mode():
        return _local_list_skills()
    return []


@router.get("/{encoded_path}", response_model=InstalledSkillDetail)
async def get_skill_detail(
    encoded_path: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> InstalledSkillDetail:
    if _is_bridge_mode():
        data = await _bridge_request("GET", f"/skills/{encoded_path}")
        return InstalledSkillDetail(**data)
    if _is_local_mode():
        return _local_get_skill(encoded_path)
    raise HTTPException(status_code=503, detail="No skills backend available")


@router.post("/{encoded_path}/propose-change", response_model=ChangeProposal)
async def propose_skill_change(
    encoded_path: str,
    body: ChangeRequest,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ChangeProposal:
    if _is_bridge_mode():
        data = await _bridge_request("POST", f"/skills/{encoded_path}/propose-change", {"request": body.request})
        return ChangeProposal(**data)
    if _is_local_mode():
        return _local_propose_change(encoded_path, body.request)
    raise HTTPException(status_code=503, detail="No skills backend available")


@router.post("/{encoded_path}/apply-change", response_model=ValidationResult)
async def apply_skill_change(
    encoded_path: str,
    body: ApplyChangeRequest,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ValidationResult:
    if _is_bridge_mode():
        data = await _bridge_request("POST", f"/skills/{encoded_path}/apply-change", {
            "file_path": body.file_path,
            "new_content": body.new_content,
        })
        return ValidationResult(**data)
    if _is_local_mode():
        return _local_apply_change(encoded_path, body)
    raise HTTPException(status_code=503, detail="No skills backend available")


# ─── Local Filesystem Implementations ─────────────────────────────────

def _local_list_skills() -> list[InstalledSkillSummary]:
    results: list[InstalledSkillSummary] = []
    for source_label, skill_dir in _get_skill_dirs():
        if not skill_dir.is_dir():
            continue
        for entry in sorted(skill_dir.iterdir()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            encoded = base64.urlsafe_b64encode(str(entry).encode()).decode()
            mtime = _get_dir_mtime(entry)
            results.append(InstalledSkillSummary(
                name=entry.name,
                path=str(entry),
                encoded_path=encoded,
                summary=_read_skill_summary(entry),
                source=source_label,
                last_modified=mtime,
                file_count=sum(1 for f in entry.iterdir() if f.is_file()),
            ))
    return results


def _local_get_skill(encoded_path: str) -> InstalledSkillDetail:
    skill_dir = _decode_skill_path(encoded_path)
    files: list[SkillFileContent] = []
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
                files.append(SkillFileContent(name=entry.name, path=str(entry), content=content, size=len(content)))
            except OSError:
                pass

    source = "workspace/skills" if "workspace/skills" in str(skill_dir) else "skills"
    return InstalledSkillDetail(
        name=skill_dir.name,
        path=str(skill_dir),
        encoded_path=encoded_path,
        summary=_read_skill_summary(skill_dir),
        source=source,
        files=files,
        all_files=all_files,
    )


def _local_propose_change(encoded_path: str, request: str) -> ChangeProposal:
    skill_dir = _decode_skill_path(encoded_path)
    affected: list[str] = []
    content: dict[str, str] = {}

    for fname in ("SKILL.md", "README.md"):
        fpath = skill_dir / fname
        if fpath.exists():
            affected.append(fname)
            content[fname] = fpath.read_text(encoding="utf-8", errors="replace")

    return ChangeProposal(
        request=request,
        affected_files=affected,
        current_content=content,
        rationale=f"Change requested: {request}",
        risks=["Ensure the skill still functions after editing.", "Review for unintended prompt changes."],
    )


def _local_apply_change(encoded_path: str, body: ApplyChangeRequest) -> ValidationResult:
    skill_dir = _decode_skill_path(encoded_path)
    target = skill_dir / body.file_path

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


# ─── Helpers ──────────────────────────────────────────────────────────

def _get_skill_dirs() -> list[tuple[str, Path]]:
    base = Path(settings.openclaw_dir)
    return [("skills", base / "skills"), ("workspace/skills", base / "workspace" / "skills")]


def _decode_skill_path(encoded: str) -> Path:
    try:
        decoded = base64.urlsafe_b64decode(encoded).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path encoding")
    p = Path(decoded)
    if not p.is_dir():
        raise HTTPException(status_code=404, detail="Skill not found")
    openclaw_dir = Path(settings.openclaw_dir) if settings.openclaw_dir else None
    if not openclaw_dir:
        raise HTTPException(status_code=400, detail="OPENCLAW_DIR not configured")
    try:
        p.resolve().relative_to(openclaw_dir.resolve())
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
