"""API routes for browsing and editing installed OpenClaw skills."""

from __future__ import annotations

import base64
import os
from datetime import datetime, UTC
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from sqlmodel import SQLModel

from app.api.deps import ORG_MEMBER_DEP
from app.core.config import settings
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/installed-skills", tags=["skills-editor"])

# Files we consider "key" for display
KEY_FILES = {"SKILL.md", "README.md", "AGENTS.md", "SOUL.md", "config.json", "config.yaml"}
# Extensions we'll read content for
READABLE_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".sh", ".py", ".js", ".ts"}
MAX_FILE_SIZE = 100_000  # 100KB


# ─── Schemas ──────────────────────────────────────────────────────────

class InstalledSkillSummary(SQLModel):
    name: str
    path: str
    encoded_path: str  # base64-encoded for URL safety
    summary: str | None = None
    source: str  # "skills" or "workspace/skills"
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
    all_files: list[str] = []  # all filenames in the directory


class ChangeRequest(SQLModel):
    request: str  # plain-language change request


class ChangeProposal(SQLModel):
    request: str
    affected_files: list[str] = []
    current_content: dict[str, str] = {}  # file -> content
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


# ─── Routes ───────────────────────────────────────────────────────────

@router.get("", response_model=list[InstalledSkillSummary])
async def list_installed_skills(
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[InstalledSkillSummary]:
    """List all installed skills from known skill directories."""
    results: list[InstalledSkillSummary] = []

    for source_label, skill_dir in _get_skill_dirs():
        if not skill_dir.is_dir():
            continue
        for entry in sorted(skill_dir.iterdir()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            summary = _read_skill_summary(entry)
            encoded = base64.urlsafe_b64encode(str(entry).encode()).decode()
            mtime = _get_dir_mtime(entry)
            file_count = sum(1 for f in entry.iterdir() if f.is_file())
            results.append(InstalledSkillSummary(
                name=entry.name,
                path=str(entry),
                encoded_path=encoded,
                summary=summary,
                source=source_label,
                last_modified=mtime.isoformat() if mtime else None,
                file_count=file_count,
            ))

    return results


@router.get("/{encoded_path}", response_model=InstalledSkillDetail)
async def get_skill_detail(
    encoded_path: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> InstalledSkillDetail:
    """Get skill detail with key file contents."""
    skill_dir = _decode_skill_path(encoded_path)

    files: list[SkillFileContent] = []
    all_files: list[str] = []

    for entry in sorted(skill_dir.iterdir()):
        if not entry.is_file():
            continue
        all_files.append(entry.name)
        # Read key files and small readable files
        if entry.name in KEY_FILES or (
            entry.suffix in READABLE_EXTENSIONS and entry.stat().st_size < MAX_FILE_SIZE
        ):
            try:
                content = entry.read_text(encoding="utf-8", errors="replace")
                files.append(SkillFileContent(
                    name=entry.name,
                    path=str(entry),
                    content=content,
                    size=len(content),
                ))
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


@router.post("/{encoded_path}/propose-change", response_model=ChangeProposal)
async def propose_skill_change(
    encoded_path: str,
    body: ChangeRequest,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ChangeProposal:
    """
    Propose a change to a skill. Returns the current content of affected files
    for review. In v1, the actual diff generation is manual — this endpoint
    surfaces the files and context for the Mario review step.
    """
    skill_dir = _decode_skill_path(encoded_path)

    # Identify the primary file to edit (SKILL.md is almost always the target)
    affected_files: list[str] = []
    current_content: dict[str, str] = {}

    skill_md = skill_dir / "SKILL.md"
    if skill_md.exists():
        affected_files.append("SKILL.md")
        current_content["SKILL.md"] = skill_md.read_text(encoding="utf-8", errors="replace")

    # Also include README if it exists
    readme = skill_dir / "README.md"
    if readme.exists():
        affected_files.append("README.md")
        current_content["README.md"] = readme.read_text(encoding="utf-8", errors="replace")

    return ChangeProposal(
        request=body.request,
        affected_files=affected_files,
        current_content=current_content,
        rationale=f"Change requested: {body.request}",
        risks=["Ensure the skill still functions after editing.", "Review for unintended prompt changes."],
    )


@router.post("/{encoded_path}/apply-change", response_model=ValidationResult)
async def apply_skill_change(
    encoded_path: str,
    body: ApplyChangeRequest,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ValidationResult:
    """Apply an approved edit to a skill file and run validation."""
    skill_dir = _decode_skill_path(encoded_path)

    target_file = skill_dir / body.file_path
    # Security: ensure the target is within the skill directory
    try:
        target_file.resolve().relative_to(skill_dir.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target file must be within the skill directory.",
        )

    # Write the file
    try:
        target_file.write_text(body.new_content, encoding="utf-8")
    except OSError as e:
        return ValidationResult(
            success=False,
            checks=[ValidationCheck(name="write_file", passed=False, message=str(e))],
        )

    # Run validation checks
    checks: list[ValidationCheck] = []

    # Check SKILL.md exists
    skill_md = skill_dir / "SKILL.md"
    checks.append(ValidationCheck(
        name="skill_md_exists",
        passed=skill_md.exists(),
        message="SKILL.md exists" if skill_md.exists() else "SKILL.md is missing!",
    ))

    # Check SKILL.md is readable
    if skill_md.exists():
        try:
            content = skill_md.read_text(encoding="utf-8")
            checks.append(ValidationCheck(
                name="skill_md_readable",
                passed=len(content) > 0,
                message=f"SKILL.md is readable ({len(content)} chars)",
            ))
        except OSError:
            checks.append(ValidationCheck(
                name="skill_md_readable",
                passed=False,
                message="SKILL.md could not be read",
            ))

    # Check target file was written successfully
    if target_file.exists():
        written = target_file.read_text(encoding="utf-8")
        checks.append(ValidationCheck(
            name="file_written",
            passed=written == body.new_content,
            message=f"{body.file_path} written successfully ({len(written)} chars)",
        ))

    success = all(c.passed for c in checks)
    return ValidationResult(success=success, checks=checks)


# ─── Helpers ──────────────────────────────────────────────────────────

def _get_skill_dirs() -> list[tuple[str, Path]]:
    """Return the skill directories to scan."""
    openclaw_dir = settings.openclaw_dir
    if not openclaw_dir:
        return []

    base = Path(openclaw_dir)
    return [
        ("skills", base / "skills"),
        ("workspace/skills", base / "workspace" / "skills"),
    ]


def _decode_skill_path(encoded_path: str) -> Path:
    """Decode a base64-encoded skill path and validate it exists."""
    try:
        decoded = base64.urlsafe_b64decode(encoded_path).decode()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid skill path encoding.")

    skill_dir = Path(decoded)
    if not skill_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill directory not found.")

    # Security: ensure path is within a known skill directory
    openclaw_dir = Path(settings.openclaw_dir) if settings.openclaw_dir else None
    if not openclaw_dir:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OPENCLAW_DIR not configured.")

    try:
        skill_dir.resolve().relative_to(openclaw_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Skill path is outside the OpenClaw directory.")

    return skill_dir


def _read_skill_summary(skill_dir: Path) -> str | None:
    """Read the first meaningful line from SKILL.md as a summary."""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return None
    try:
        content = skill_md.read_text(encoding="utf-8", errors="replace")
        for line in content.split("\n"):
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("---"):
                return line[:200]
        return None
    except OSError:
        return None


def _get_dir_mtime(path: Path) -> datetime | None:
    """Get the most recent modification time of files in a directory."""
    try:
        mtimes = [f.stat().st_mtime for f in path.iterdir() if f.is_file()]
        if mtimes:
            return datetime.fromtimestamp(max(mtimes), tz=UTC).replace(tzinfo=None)
    except OSError:
        pass
    return None
