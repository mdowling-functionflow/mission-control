"""Task dispatch service — connects composed tasks to real OpenClaw agent execution.

Uses the proven gateway dispatch pattern from approvals:
  resolve executive agent → find board-native Agent → get openclaw_session_id → send via gateway
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import col, select

from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.agents import Agent
from app.models.boards import Board
from app.models.composed_tasks import ComposedTask
from app.models.executive_agents import ExecutiveAgent
from app.models.task_assignments import TaskAssignment
from app.services.activity_log import record_activity
from app.services.openclaw.gateway_dispatch import GatewayDispatchService

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)


async def dispatch_task(
    session: AsyncSession,
    task: ComposedTask,
    assignments: list[TaskAssignment],
) -> list[str]:
    """Dispatch a composed task to assigned agents via the OpenClaw gateway.

    Returns a list of error messages (empty = all successful).
    """
    errors: list[str] = []
    dispatch = GatewayDispatchService(session)

    for assignment in assignments:
        # 1. Resolve executive agent
        exec_agent = await ExecutiveAgent.objects.by_id(assignment.executive_agent_id).first(session)
        if not exec_agent:
            errors.append(f"Executive agent {assignment.executive_agent_id} not found")
            continue

        # 2. Find board-native Agent(s) matching this executive agent
        stmt = select(Agent).where(col(Agent.name) == exec_agent.openclaw_agent_id)
        result = await session.exec(stmt)
        board_agents = result.all()

        if not board_agents:
            errors.append(f"No board agent found for '{exec_agent.openclaw_agent_id}'")
            continue

        # 3. Find one with a session ID
        target_agent = None
        for ba in board_agents:
            if ba.openclaw_session_id:
                target_agent = ba
                break

        if not target_agent or not target_agent.openclaw_session_id:
            errors.append(f"Agent '{exec_agent.display_name}' has no active session")
            assignment.status = "blocked"
            session.add(assignment)
            continue

        # 4. Resolve gateway config
        if not target_agent.board_id:
            errors.append(f"Agent '{exec_agent.display_name}' not assigned to a board")
            continue

        board = await Board.objects.by_id(target_agent.board_id).first(session)
        if not board:
            errors.append(f"Board not found for agent '{exec_agent.display_name}'")
            continue

        config = await dispatch.optional_gateway_config_for_board(board)
        if not config:
            errors.append(f"No gateway config for agent '{exec_agent.display_name}'")
            continue

        # 5. Build the message
        message = _build_task_message(task, assignment, exec_agent)

        # 6. Dispatch!
        error = await dispatch.try_send_agent_message(
            session_key=target_agent.openclaw_session_id,
            config=config,
            agent_name=target_agent.name,
            message=message,
            deliver=True,
        )

        if error:
            errors.append(f"Dispatch to '{exec_agent.display_name}' failed: {error}")
            assignment.status = "blocked"
        else:
            assignment.status = "active"
            logger.info(
                "task.dispatched",
                task_id=str(task.id),
                agent=exec_agent.display_name,
                session_key=target_agent.openclaw_session_id,
            )

        session.add(assignment)

    # 7. Update task status
    active_count = sum(1 for a in assignments if a.status == "active")
    if active_count > 0:
        task.status = "in_progress"
    elif all(a.status == "blocked" for a in assignments):
        task.status = "active"  # Keep as active, can retry
    task.updated_at = utcnow()
    session.add(task)

    await session.commit()

    # 8. Log activity
    try:
        await record_activity(
            session,
            event_type="task.dispatched",
            message=f"Task '{task.title}' dispatched to {active_count} agent(s)",
        )
    except Exception:
        pass  # Activity logging is best-effort

    return errors


def _build_task_message(
    task: ComposedTask,
    assignment: TaskAssignment,
    exec_agent: ExecutiveAgent,
) -> str:
    """Build the message to inject into an agent's session."""
    parts = []

    # Context
    parts.append(f"[Mission Control Task: {task.title}]")

    if task.collaboration_mode and task.collaboration_mode != "null":
        role_desc = f"Your role: {assignment.role}"
        mode_desc = f"Collaboration mode: {task.collaboration_mode}"
        parts.append(f"{role_desc}. {mode_desc}.")

    # The actual request
    parts.append("")
    parts.append(task.original_request or task.description or task.title)

    # Instructions
    parts.append("")
    parts.append(
        "Please work on this task. When you have results or a meaningful update, "
        "share them in this session."
    )

    return "\n".join(parts)
