"""API routes for the weekly review system."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.time import utcnow
from app.models.activity_events import ActivityEvent
from app.models.approvals import Approval
from app.models.executive_agents import ExecutiveAgent
from app.models.improvements import Improvement
from app.models.weekly_reviews import WeeklyReview
from app.schemas.weekly_reviews import WeeklyReviewCreate, WeeklyReviewRead, WeeklyReviewUpdate
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/weekly-reviews", tags=["weekly-reviews"])


@router.get("", response_model=list[WeeklyReviewRead])
async def list_weekly_reviews(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[WeeklyReview]:
    """List weekly reviews for the current org, newest first."""
    return await WeeklyReview.objects.filter_by(
        organization_id=ctx.organization.id,
    ).order_by(col(WeeklyReview.week_start).desc()).all(session)


@router.post("", response_model=WeeklyReviewRead, status_code=status.HTTP_201_CREATED)
async def create_weekly_review(
    body: WeeklyReviewCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> WeeklyReview:
    """Create a new weekly review."""
    review = WeeklyReview(
        organization_id=ctx.organization.id,
        week_start=body.week_start,
        week_end=body.week_end,
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)
    return review


@router.post("/current", response_model=WeeklyReviewRead, status_code=status.HTTP_201_CREATED)
async def create_current_week_review(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> WeeklyReview:
    """Create a review for the current week (Mon-Sun), or return existing."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    existing = await WeeklyReview.objects.filter_by(
        organization_id=ctx.organization.id,
        week_start=monday,
    ).first(session)
    if existing:
        return existing

    review = WeeklyReview(
        organization_id=ctx.organization.id,
        week_start=monday,
        week_end=sunday,
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)
    return review


@router.get("/{review_id}", response_model=WeeklyReviewRead)
async def get_weekly_review(
    review_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> WeeklyReview:
    review = await WeeklyReview.objects.filter_by(
        id=review_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return review


@router.patch("/{review_id}", response_model=WeeklyReviewRead)
async def update_weekly_review(
    review_id: UUID,
    body: WeeklyReviewUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> WeeklyReview:
    review = await WeeklyReview.objects.filter_by(
        id=review_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = body.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(review, key, val)
    review.updated_at = utcnow()

    session.add(review)
    await session.commit()
    await session.refresh(review)
    return review


@router.post("/{review_id}/generate", response_model=WeeklyReviewRead)
async def generate_weekly_review(
    review_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> WeeklyReview:
    """Auto-generate review content from the week's activity, approvals, and improvements."""
    review = await WeeklyReview.objects.filter_by(
        id=review_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    org_id = ctx.organization.id
    week_start_dt = datetime(review.week_start.year, review.week_start.month, review.week_start.day)
    week_end_dt = datetime(review.week_end.year, review.week_end.month, review.week_end.day, 23, 59, 59)

    # Approved items this week = wins
    approved_stmt = (
        select(Approval)
        .where(
            col(Approval.status) == "approved",
            col(Approval.resolved_at) >= week_start_dt,
            col(Approval.resolved_at) <= week_end_dt,
        )
        .limit(20)
    )
    result = await session.exec(approved_stmt)
    approved = result.all()
    wins = [{"text": f"Approved: {a.action_type}"} for a in approved]
    if not wins:
        wins = [{"text": "No approvals resolved this week."}]

    # Rejected approvals = friction
    rejected_stmt = (
        select(Approval)
        .where(
            col(Approval.status) == "rejected",
            col(Approval.resolved_at) >= week_start_dt,
            col(Approval.resolved_at) <= week_end_dt,
        )
        .limit(20)
    )
    result = await session.exec(rejected_stmt)
    rejected = result.all()
    friction = [{"text": f"Rejected: {a.action_type}"} for a in rejected]

    # Agent risks
    agents = await ExecutiveAgent.objects.filter_by(organization_id=org_id).all(session)
    risks = []
    for agent in agents:
        if agent.current_risk:
            risks.append({"text": f"{agent.display_name}: {agent.current_risk}"})
        if agent.status in ("stale", "error"):
            risks.append({"text": f"{agent.display_name} is in {agent.status} state"})
    if not risks:
        risks = [{"text": "No significant risks this week."}]

    # Proposed improvements this week
    improvements_stmt = (
        select(Improvement)
        .where(
            col(Improvement.organization_id) == org_id,
            col(Improvement.created_at) >= week_start_dt,
            col(Improvement.created_at) <= week_end_dt,
        )
        .limit(20)
    )
    result = await session.exec(improvements_stmt)
    week_improvements = result.all()
    improvements_list = [
        {"text": f"{i.title} ({i.status})"}
        for i in week_improvements
    ]

    # Agent summaries + goal progress
    from app.models.daily_items import DailyItem
    from app.models.documents import Document
    from app.models.agent_messages import AgentMessage

    agent_summaries = {}
    goal_progress = {}
    next_week = []

    for agent in agents:
        # Build summary
        parts = []
        if agent.current_focus:
            parts.append(f"Focus: {agent.current_focus}")
        parts.append(f"Status: {agent.status}")
        if agent.pending_approvals_count:
            parts.append(f"{agent.pending_approvals_count} pending approvals")
        if agent.current_risk:
            parts.append(f"Risk: {agent.current_risk}")
        agent_summaries[agent.display_name] = ". ".join(parts) if parts else "No updates."

        # Goal progress per agent
        if agent.goal:
            # Count daily items completed this week
            daily_done_stmt = select(func.count()).select_from(DailyItem).where(
                col(DailyItem.executive_agent_id) == agent.id,
                col(DailyItem.organization_id) == org_id,
                col(DailyItem.item_date) >= review.week_start,
                col(DailyItem.item_date) <= review.week_end,
                col(DailyItem.status) == "done",
            )
            daily_done = (await session.exec(daily_done_stmt)).one()

            daily_total_stmt = select(func.count()).select_from(DailyItem).where(
                col(DailyItem.executive_agent_id) == agent.id,
                col(DailyItem.organization_id) == org_id,
                col(DailyItem.item_date) >= review.week_start,
                col(DailyItem.item_date) <= review.week_end,
            )
            daily_total = (await session.exec(daily_total_stmt)).one()

            # Count docs produced
            docs_stmt = select(func.count()).select_from(Document).where(
                col(Document.source_agent_id) == agent.id,
                col(Document.organization_id) == org_id,
                col(Document.created_at) >= week_start_dt,
                col(Document.created_at) <= week_end_dt,
            )
            doc_count = (await session.exec(docs_stmt)).one()

            # Count messages
            msg_stmt = select(func.count()).select_from(AgentMessage).where(
                col(AgentMessage.executive_agent_id) == agent.id,
                col(AgentMessage.organization_id) == org_id,
                col(AgentMessage.created_at) >= week_start_dt,
                col(AgentMessage.created_at) <= week_end_dt,
            )
            msg_count = (await session.exec(msg_stmt)).one()

            # Agent improvements this week
            agent_imps = [i for i in week_improvements if i.executive_agent_id == agent.id]
            adopted = sum(1 for i in agent_imps if i.status == "adopted")

            progress_note = f"{daily_done}/{daily_total} daily items done, {doc_count} docs, {msg_count} messages, {len(agent_imps)} improvements ({adopted} adopted)"
            blockers = agent.current_risk or "None"

            goal_progress[agent.display_name] = {
                "goal": agent.goal,
                "progress": progress_note,
                "blockers": blockers,
                "daily_completion": f"{daily_done}/{daily_total}",
                "docs_produced": doc_count,
            }

            # Generate priority from goal progress
            if daily_total > 0 and daily_done < daily_total / 2:
                next_week.append({"text": f"{agent.display_name}: Low daily completion ({daily_done}/{daily_total}) — focus on advancing goal: {agent.goal}"})
            if agent.current_risk:
                next_week.append({"text": f"{agent.display_name}: Address risk — {agent.current_risk}"})

    # Default priorities
    if not next_week:
        next_week = [{"text": "All lanes operating normally. Continue current focus areas."}]
    if pending_count := sum(1 for a in agents if a.pending_approvals_count > 0):
        next_week.append({"text": f"Clear {pending_count} agent(s) with pending approvals."})

    # Update review
    review.wins = wins
    review.risks = risks
    review.friction_points = friction if friction else [{"text": "No friction points this week."}]
    review.improvements = improvements_list if improvements_list else [{"text": "No improvements proposed this week."}]
    review.next_week_priorities = next_week
    review.agent_summaries = agent_summaries
    review.goal_progress = goal_progress
    review.updated_at = utcnow()

    session.add(review)
    await session.commit()
    await session.refresh(review)
    return review
