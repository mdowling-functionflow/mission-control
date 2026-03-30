"""Task dispatch service — connects composed tasks to real OpenClaw agent execution.

Uses the OpenClaw CLI (`openclaw agent --agent <id> --message <text> --json`)
to dispatch tasks to agents and capture their responses.
"""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.composed_tasks import ComposedTask
from app.models.executive_agents import ExecutiveAgent
from app.models.task_assignments import TaskAssignment

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)


async def dispatch_task(
    session: AsyncSession,
    task: ComposedTask,
    assignments: list[TaskAssignment],
) -> list[str]:
    """Dispatch a composed task to assigned agents via the OpenClaw CLI.

    Returns a list of error messages (empty = all successful).
    """
    errors: list[str] = []

    for assignment in assignments:
        exec_agent = await ExecutiveAgent.objects.by_id(assignment.executive_agent_id).first(session)
        if not exec_agent:
            errors.append(f"Executive agent {assignment.executive_agent_id} not found")
            continue

        message = _build_task_message(task, assignment, exec_agent)

        try:
            response = await _exec_agent_cli(exec_agent.openclaw_agent_id, message)
            assignment.status = "active"
            if response:
                assignment.last_update = response
                assignment.last_update_at = utcnow()
            logger.info(
                "task.dispatched",
                task_id=str(task.id),
                agent=exec_agent.display_name,
            )
        except Exception as exc:
            errors.append(f"Dispatch to '{exec_agent.display_name}' failed: {str(exc)[:200]}")
            assignment.status = "blocked"

        session.add(assignment)

    # Update task status
    active_count = sum(1 for a in assignments if a.status == "active")
    if active_count > 0:
        task.status = "in_progress"
    elif all(a.status == "blocked" for a in assignments):
        task.status = "active"
    task.updated_at = utcnow()
    session.add(task)

    await session.commit()
    return errors


async def _exec_agent_cli(openclaw_agent_id: str, message: str) -> str | None:
    """Execute an agent turn. Routes through bridge if BRIDGE_URL set, else CLI."""
    if settings.bridge_url:
        return await _exec_via_bridge(openclaw_agent_id, message)
    return await _exec_via_local_cli(openclaw_agent_id, message)


async def _exec_via_bridge(openclaw_agent_id: str, message: str) -> str | None:
    """Execute agent via the local bridge."""
    import httpx
    url = f"{settings.bridge_url.rstrip('/')}/chat"
    headers = {"X-Bridge-Token": settings.bridge_token}
    try:
        async with httpx.AsyncClient(timeout=130.0) as client:
            resp = await client.post(url, headers=headers, json={
                "agent_id": openclaw_agent_id,
                "message": message,
            })
        if resp.status_code != 200:
            raise RuntimeError(f"Bridge error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        if data.get("error"):
            raise RuntimeError(data["error"])
        return data.get("response")
    except httpx.TimeoutException:
        return "Agent timed out via bridge."
    except Exception as exc:
        raise RuntimeError(f"Bridge failed: {str(exc)[:200]}")


async def _exec_via_local_cli(openclaw_agent_id: str, message: str) -> str | None:
    """Execute agent via local OpenClaw CLI."""
    cmd = [
        "openclaw", "agent",
        "--agent", openclaw_agent_id,
        "--message", message,
        "--session-id", f"mc-task-{openclaw_agent_id}",
        "--json",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    except asyncio.TimeoutError:
        return "Agent timed out (120s). The task may still be processing."
    except FileNotFoundError:
        raise RuntimeError("openclaw CLI not found in PATH")

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(err[:500] if err else "Agent execution failed")

    output = stdout.decode("utf-8", errors="replace").strip()
    if not output:
        return None

    try:
        data = json.loads(output)
        if isinstance(data, dict):
            payloads = data.get("result", {}).get("payloads", [])
            if payloads:
                texts = [p.get("text", "") for p in payloads if p.get("text")]
                if texts:
                    return "\n\n".join(texts)
        return output
    except json.JSONDecodeError:
        return output


def _build_task_message(
    task: ComposedTask,
    assignment: TaskAssignment,
    exec_agent: ExecutiveAgent,
) -> str:
    parts = []
    parts.append(f"[Mission Control Task: {task.title}]")

    if task.collaboration_mode and task.collaboration_mode != "null":
        parts.append(f"Your role: {assignment.role}. Mode: {task.collaboration_mode}.")

    parts.append("")
    parts.append(task.original_request or task.description or task.title)
    parts.append("")
    parts.append("Please work on this task and share your results.")

    return "\n".join(parts)
