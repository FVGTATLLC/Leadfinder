import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.campaign import Campaign, CampaignContact
from app.models.message_draft import MessageDraft
from app.models.sequence_step import SequenceStep
from app.schemas.campaign import (
    CampaignContactResponse,
    CampaignCreate,
    CampaignListResponse,
    CampaignUpdate,
    SequenceStepCreate,
    SequenceStepUpdate,
)
from app.utils.pagination import PaginationParams, paginate


async def create_campaign(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: CampaignCreate,
) -> Campaign:
    """Create a new campaign."""
    campaign = Campaign(
        name=data.name,
        description=data.description,
        strategy_id=data.strategy_id,
        campaign_type=data.campaign_type.value,
        tone_preset=data.tone_preset.value,
        starts_at=data.starts_at,
        created_by=user_id,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    return campaign


async def get_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> Campaign:
    """Get a single campaign by ID with steps and contacts loaded."""
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise NotFoundError(f"Campaign with id '{campaign_id}' not found")
    return campaign


async def list_campaigns(
    db: AsyncSession,
    strategy_id: uuid.UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams | None = None,
    user_id: uuid.UUID | str | None = None,
    user_role: str | None = None,
) -> dict:
    """List campaigns with optional filters and pagination."""
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Campaign)
        .where(Campaign.is_deleted.is_(False))
        .order_by(Campaign.created_at.desc())
    )

    # Non-admin users only see their own campaigns
    if user_role and user_role != "admin" and user_id:
        query = query.where(Campaign.created_by == user_id)

    if strategy_id:
        query = query.where(Campaign.strategy_id == strategy_id)
    if status:
        query = query.where(Campaign.status == status)

    result = await paginate(db, query, pagination)
    result["items"] = [
        CampaignListResponse.from_campaign(c) for c in result["items"]
    ]
    return result


async def update_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    data: CampaignUpdate,
) -> Campaign:
    """Update an existing campaign."""
    campaign = await get_campaign(db, campaign_id)
    update_data = data.model_dump(exclude_unset=True)

    if "campaign_type" in update_data and update_data["campaign_type"] is not None:
        update_data["campaign_type"] = update_data["campaign_type"].value
    if "tone_preset" in update_data and update_data["tone_preset"] is not None:
        update_data["tone_preset"] = update_data["tone_preset"].value
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value

    for field, value in update_data.items():
        setattr(campaign, field, value)

    await db.flush()
    await db.refresh(campaign)
    return campaign


async def delete_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> None:
    """Soft delete a campaign and cascade to its messages + steps."""
    from sqlalchemy import update

    from app.models.message_draft import MessageDraft
    from app.models.sequence_step import SequenceStep

    campaign = await get_campaign(db, campaign_id)
    if campaign.status not in ("draft", "paused", "active", "completed", "archived"):
        raise ValidationError(
            f"Cannot delete campaign with status '{campaign.status}'."
        )

    # Cascade soft-delete: messages
    await db.execute(
        update(MessageDraft)
        .where(
            MessageDraft.campaign_id == campaign_id,
            MessageDraft.is_deleted.is_(False),
        )
        .values(is_deleted=True)
    )

    # Cascade soft-delete: sequence steps
    await db.execute(
        update(SequenceStep)
        .where(
            SequenceStep.campaign_id == campaign_id,
            SequenceStep.is_deleted.is_(False),
        )
        .values(is_deleted=True)
    )

    campaign.is_deleted = True
    await db.flush()


async def add_contacts_to_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
) -> int:
    """Add contacts to a campaign, skipping duplicates. Returns count added."""
    await get_campaign(db, campaign_id)

    added = 0
    for contact_id in contact_ids:
        stmt = select(CampaignContact).where(
            CampaignContact.campaign_id == campaign_id,
            CampaignContact.contact_id == contact_id,
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            continue

        cc = CampaignContact(
            campaign_id=campaign_id,
            contact_id=contact_id,
        )
        db.add(cc)
        added += 1

    await db.flush()
    return added


async def remove_contact_from_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> None:
    """Remove a contact from a campaign."""
    stmt = select(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.contact_id == contact_id,
    )
    result = await db.execute(stmt)
    cc = result.scalar_one_or_none()
    if cc is None:
        raise NotFoundError(
            f"Contact '{contact_id}' not found in campaign '{campaign_id}'"
        )
    await db.delete(cc)
    await db.flush()


async def get_campaign_contacts(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    pagination: PaginationParams | None = None,
) -> dict:
    """Get contacts for a campaign with pagination."""
    if pagination is None:
        pagination = PaginationParams()

    await get_campaign(db, campaign_id)

    query = (
        select(CampaignContact)
        .where(CampaignContact.campaign_id == campaign_id)
        .order_by(CampaignContact.added_at.desc())
    )

    result = await paginate(db, query, pagination)
    result["items"] = [
        CampaignContactResponse.from_campaign_contact(cc) for cc in result["items"]
    ]
    return result


async def add_sequence_step(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    data: SequenceStepCreate,
) -> SequenceStep:
    """Add a sequence step to a campaign."""
    await get_campaign(db, campaign_id)

    stmt = select(SequenceStep).where(
        SequenceStep.campaign_id == campaign_id,
        SequenceStep.step_number == data.step_number,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise ConflictError(
            f"Step number {data.step_number} already exists for this campaign"
        )

    step = SequenceStep(
        campaign_id=campaign_id,
        step_number=data.step_number,
        delay_days=data.delay_days,
        step_type=data.step_type.value,
        subject_template=data.subject_template,
        body_template=data.body_template,
        is_ai_generated=data.is_ai_generated,
    )
    db.add(step)
    await db.flush()
    await db.refresh(step)
    return step


async def update_sequence_step(
    db: AsyncSession,
    step_id: uuid.UUID,
    data: SequenceStepUpdate,
) -> SequenceStep:
    """Update a sequence step."""
    stmt = select(SequenceStep).where(
        SequenceStep.id == step_id,
        SequenceStep.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    step = result.scalar_one_or_none()
    if step is None:
        raise NotFoundError(f"Sequence step with id '{step_id}' not found")

    update_data = data.model_dump(exclude_unset=True)

    if "step_type" in update_data and update_data["step_type"] is not None:
        update_data["step_type"] = update_data["step_type"].value

    for field, value in update_data.items():
        setattr(step, field, value)

    await db.flush()
    await db.refresh(step)
    return step


async def delete_sequence_step(
    db: AsyncSession,
    step_id: uuid.UUID,
) -> None:
    """Delete a sequence step (soft delete)."""
    stmt = select(SequenceStep).where(
        SequenceStep.id == step_id,
        SequenceStep.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    step = result.scalar_one_or_none()
    if step is None:
        raise NotFoundError(f"Sequence step with id '{step_id}' not found")
    step.is_deleted = True
    await db.flush()


async def get_campaign_steps(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> list[SequenceStep]:
    """Get all sequence steps for a campaign, ordered by step_number."""
    await get_campaign(db, campaign_id)

    stmt = (
        select(SequenceStep)
        .where(
            SequenceStep.campaign_id == campaign_id,
            SequenceStep.is_deleted.is_(False),
        )
        .order_by(SequenceStep.step_number)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def activate_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Campaign:
    """Activate a campaign. Validates it has contacts and steps."""
    campaign = await get_campaign(db, campaign_id)

    if campaign.status not in ("draft", "paused"):
        raise ValidationError(
            f"Cannot activate campaign with status '{campaign.status}'"
        )

    steps = await get_campaign_steps(db, campaign_id)
    if not steps:
        raise ValidationError("Cannot activate campaign without sequence steps")

    contact_count_stmt = select(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
    )
    contact_result = await db.execute(contact_count_stmt)
    contacts = contact_result.scalars().all()
    if not contacts:
        raise ValidationError("Cannot activate campaign without contacts")

    campaign.status = "active"
    campaign.starts_at = campaign.starts_at or datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(campaign)
    return campaign


async def pause_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> Campaign:
    """Pause an active campaign."""
    campaign = await get_campaign(db, campaign_id)

    if campaign.status != "active":
        raise ValidationError(
            f"Cannot pause campaign with status '{campaign.status}'. "
            "Only active campaigns can be paused."
        )

    campaign.status = "paused"
    await db.flush()
    await db.refresh(campaign)
    return campaign


async def approve_campaign(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    approver_id: uuid.UUID,
) -> Campaign:
    """Approve a campaign (manager/reviewer action)."""
    campaign = await get_campaign(db, campaign_id)

    campaign.approved_by = approver_id
    campaign.approved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(campaign)
    return campaign


# ------------------------------------------------------------------
# Phase 6: Orchestrator helpers
# ------------------------------------------------------------------


async def get_contact_last_sent_message(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> MessageDraft | None:
    """Get the most recently sent message for this contact in this campaign."""
    stmt = (
        select(MessageDraft)
        .where(
            MessageDraft.campaign_id == campaign_id,
            MessageDraft.contact_id == contact_id,
            MessageDraft.status == "sent",
            MessageDraft.is_deleted.is_(False),
        )
        .order_by(MessageDraft.sent_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def is_contact_ready_for_next_step(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID,
    current_step: int,
    delay_days: int,
) -> bool:
    """Check if enough days have passed since last sent message."""
    last_msg = await get_contact_last_sent_message(db, campaign_id, contact_id)

    if last_msg is None:
        # No message sent yet — ready for first step
        return True

    if last_msg.sent_at is None:
        return True

    sent_at = last_msg.sent_at
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)

    threshold = sent_at + timedelta(days=delay_days)
    return datetime.now(timezone.utc) >= threshold


async def advance_contact_step(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> CampaignContact:
    """Increment current_step on campaign_contact."""
    stmt = select(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
        CampaignContact.contact_id == contact_id,
    )
    result = await db.execute(stmt)
    cc = result.scalar_one_or_none()
    if cc is None:
        raise NotFoundError(
            f"Contact '{contact_id}' not found in campaign '{campaign_id}'"
        )

    cc.current_step += 1
    await db.flush()
    await db.refresh(cc)
    return cc


async def get_active_campaigns(db: AsyncSession) -> list[Campaign]:
    """All campaigns with status=active."""
    stmt = select(Campaign).where(
        Campaign.status == "active",
        Campaign.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_campaign_progress(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> dict:
    """
    Return detailed progress for a campaign:
    - per-contact status counts
    - per-step completion counts
    - overall progress percentage
    - message stats
    """
    campaign = await get_campaign(db, campaign_id)

    # Get all campaign contacts
    cc_stmt = select(CampaignContact).where(
        CampaignContact.campaign_id == campaign_id,
    )
    cc_result = await db.execute(cc_stmt)
    campaign_contacts = list(cc_result.scalars().all())

    total_contacts = len(campaign_contacts)

    # Per-status counts
    contacts_per_status: dict[str, int] = {
        "active": 0,
        "replied": 0,
        "stopped": 0,
        "bounced": 0,
        "completed": 0,
    }
    for cc in campaign_contacts:
        status = cc.status
        contacts_per_status[status] = contacts_per_status.get(status, 0) + 1

    # Get sequence steps
    steps = await get_campaign_steps(db, campaign_id)

    # Per-step completion: count how many contacts are at or past each step
    steps_completion = []
    for step in steps:
        # Count messages per status for this step
        msg_status_stmt = (
            select(
                MessageDraft.status,
                func.count(MessageDraft.id).label("count"),
            )
            .where(
                MessageDraft.campaign_id == campaign_id,
                MessageDraft.sequence_step_id == step.id,
                MessageDraft.is_deleted.is_(False),
            )
            .group_by(MessageDraft.status)
        )
        msg_result = await db.execute(msg_status_stmt)
        msg_rows = msg_result.all()

        step_stats = {
            "step_number": step.step_number,
            "completed": 0,  # sent + replied
            "pending": 0,  # draft + pending_approval + approved
            "sent": 0,
        }
        for row in msg_rows:
            status_val, count_val = row[0], row[1]
            if status_val in ("sent", "replied"):
                step_stats["completed"] += count_val
            if status_val == "sent":
                step_stats["sent"] += count_val
            if status_val in ("draft", "pending_approval", "approved"):
                step_stats["pending"] += count_val

        steps_completion.append(step_stats)

    # Message counts
    msg_counts_stmt = (
        select(
            MessageDraft.status,
            func.count(MessageDraft.id).label("count"),
        )
        .where(
            MessageDraft.campaign_id == campaign_id,
            MessageDraft.is_deleted.is_(False),
        )
        .group_by(MessageDraft.status)
    )
    msg_counts_result = await db.execute(msg_counts_stmt)
    msg_count_rows = msg_counts_result.all()

    messages_sent = 0
    messages_pending = 0
    replies_count = 0
    for row in msg_count_rows:
        status_val, count_val = row[0], row[1]
        if status_val == "sent":
            messages_sent += count_val
        elif status_val == "replied":
            replies_count += count_val
        elif status_val in ("draft", "pending_approval", "approved"):
            messages_pending += count_val

    # Overall progress: percentage of contacts that are done (replied, stopped, completed, bounced)
    finished = (
        contacts_per_status.get("replied", 0)
        + contacts_per_status.get("stopped", 0)
        + contacts_per_status.get("completed", 0)
        + contacts_per_status.get("bounced", 0)
    )
    overall_progress_percent = (
        round((finished / total_contacts) * 100, 1) if total_contacts > 0 else 0.0
    )

    return {
        "campaign_id": str(campaign_id),
        "total_contacts": total_contacts,
        "contacts_per_status": contacts_per_status,
        "steps_completion": steps_completion,
        "overall_progress_percent": overall_progress_percent,
        "messages_sent": messages_sent,
        "messages_pending": messages_pending,
        "replies_count": replies_count,
    }


async def cancel_pending_messages(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID | None = None,
) -> int:
    """
    Cancel (soft-delete) draft and pending_approval messages for a campaign.
    Optionally filter by contact_id.
    """
    stmt = (
        update(MessageDraft)
        .where(
            MessageDraft.campaign_id == campaign_id,
            MessageDraft.status.in_(["draft", "pending_approval"]),
            MessageDraft.is_deleted.is_(False),
        )
        .values(is_deleted=True)
    )

    if contact_id is not None:
        stmt = stmt.where(MessageDraft.contact_id == contact_id)

    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount
