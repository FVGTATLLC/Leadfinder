import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.models.campaign import Campaign, CampaignContact
from app.models.contact import Contact
from app.models.message_draft import MessageDraft
from app.models.research_brief import ResearchBrief
from app.models.sequence_step import SequenceStep
from app.schemas.message import (
    MessageCreate,
    MessageListResponse,
    MessageUpdate,
)
from app.utils.pagination import PaginationParams, paginate


async def create_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: MessageCreate,
) -> MessageDraft:
    """Create a new message draft."""
    message = MessageDraft(
        sequence_step_id=data.sequence_step_id,
        contact_id=data.contact_id,
        campaign_id=data.campaign_id,
        subject=data.subject,
        body=data.body,
        tone=data.tone,
        variant_label=data.variant_label,
        scheduled_for=data.scheduled_for,
        created_by=user_id,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_message(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> MessageDraft:
    """Get a single message by ID with relationships loaded."""
    stmt = select(MessageDraft).where(
        MessageDraft.id == message_id,
        MessageDraft.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()
    if message is None:
        raise NotFoundError(f"Message with id '{message_id}' not found")
    return message


async def list_messages(
    db: AsyncSession,
    campaign_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    pagination: PaginationParams | None = None,
) -> dict:
    """List messages with optional filters and pagination."""
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(MessageDraft)
        .where(MessageDraft.is_deleted.is_(False))
        .order_by(MessageDraft.created_at.desc())
    )

    if campaign_id:
        query = query.where(MessageDraft.campaign_id == campaign_id)
    if contact_id:
        query = query.where(MessageDraft.contact_id == contact_id)
    if status:
        query = query.where(MessageDraft.status == status)
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            MessageDraft.subject.ilike(search_filter)
            | MessageDraft.body.ilike(search_filter)
        )

    result = await paginate(db, query, pagination)
    result["items"] = [
        MessageListResponse.from_message(m) for m in result["items"]
    ]
    return result


async def update_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    data: MessageUpdate,
) -> MessageDraft:
    """Update a message. Only allowed if status is draft or pending_approval."""
    message = await get_message(db, message_id)

    if message.status not in ("draft", "pending_approval"):
        raise ValidationError(
            f"Cannot edit message with status '{message.status}'. "
            "Only draft or pending_approval messages can be edited."
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(message, field, value)

    await db.flush()
    await db.refresh(message)
    return message


async def delete_message(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> None:
    """Soft delete a message. Only allowed if status is draft."""
    message = await get_message(db, message_id)

    if message.status != "draft":
        raise ValidationError(
            f"Cannot delete message with status '{message.status}'. "
            "Only draft messages can be deleted."
        )

    message.is_deleted = True
    await db.flush()


async def approve_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    approver_id: uuid.UUID,
) -> MessageDraft:
    """Approve a message. Validates status is pending_approval."""
    message = await get_message(db, message_id)

    if message.status != "pending_approval":
        raise ValidationError(
            f"Cannot approve message with status '{message.status}'. "
            "Only pending_approval messages can be approved."
        )

    message.status = "approved"
    message.approved_by = approver_id
    message.approved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(message)
    return message


async def reject_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    feedback: str,
) -> MessageDraft:
    """Reject a message back to draft with feedback."""
    message = await get_message(db, message_id)

    if message.status != "pending_approval":
        raise ValidationError(
            f"Cannot reject message with status '{message.status}'. "
            "Only pending_approval messages can be rejected."
        )

    message.status = "draft"
    context = message.context_data or {}
    context["rejection_feedback"] = feedback
    context["rejected_at"] = datetime.now(timezone.utc).isoformat()
    message.context_data = context

    await db.flush()
    await db.refresh(message)
    return message


async def send_message(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> MessageDraft:
    """Send an approved message via email."""
    from app.utils.email_sender import get_email_sender

    message = await get_message(db, message_id)

    if message.status != "approved":
        raise ValidationError(
            f"Cannot send message with status '{message.status}'. "
            "Only approved messages can be sent."
        )

    contact = message.contact
    if not contact or not contact.email:
        raise ValidationError(
            "Cannot send message: contact has no email address."
        )

    try:
        sender = get_email_sender()
        result = await sender.send_email(
            to_email=contact.email,
            subject=message.subject or "",
            body=message.body,
            from_email=sender.username,
            from_name="SalesPilot",
        )

        if result["success"]:
            message.status = "sent"
            message.sent_at = datetime.now(timezone.utc)
            message.error_message = None
        else:
            message.status = "failed"
            message.error_message = result.get("error", "Unknown send error")

    except Exception as e:
        message.status = "failed"
        message.error_message = str(e)

    await db.flush()
    await db.refresh(message)
    return message


async def mark_replied(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> MessageDraft:
    """Mark a sent message as replied."""
    message = await get_message(db, message_id)

    if message.status != "sent":
        raise ValidationError(
            f"Cannot mark message as replied with status '{message.status}'. "
            "Only sent messages can be marked as replied."
        )

    message.status = "replied"
    message.replied_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(message)
    return message


async def regenerate_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
    tone: str | None = None,
    variant_label: str | None = None,
    additional_context: str | None = None,
) -> MessageDraft:
    """Regenerate a message using the messaging agent. Creates a new draft."""
    from app.agents.llm.router import LLMRouter
    from app.agents.messaging_agent import MessagingAgent

    original = await get_message(db, message_id)
    contact = original.contact
    campaign = original.campaign

    # Build contact data
    contact_name_parts = []
    if contact.first_name:
        contact_name_parts.append(contact.first_name)
    if contact.last_name:
        contact_name_parts.append(contact.last_name)
    contact_name = " ".join(contact_name_parts) if contact_name_parts else ""

    contact_data = {
        "name": contact_name,
        "title": contact.job_title or "",
        "email": contact.email or "",
        "persona_type": contact.persona_type or "",
    }

    # Build company data
    company = contact.company
    company_data = {}
    if company:
        company_data = {
            "name": company.name or "",
            "industry": company.industry or "",
            "geography": company.geography or "",
            "size": company.employee_count,
        }

    # Get research brief if available
    research_data = {}
    research_stmt = (
        select(ResearchBrief)
        .where(
            ResearchBrief.is_deleted.is_(False),
            ResearchBrief.contact_id == contact.id,
        )
        .order_by(ResearchBrief.created_at.desc())
        .limit(1)
    )
    research_result = await db.execute(research_stmt)
    brief = research_result.scalar_one_or_none()
    if brief and brief.content:
        research_data = {
            "summary": brief.content.get("summary", ""),
            "talking_points": brief.content.get("talking_points", []),
            "pain_points": brief.content.get("pain_points", []),
        }

    # Determine step number
    step_number = 1
    if original.sequence_step_id:
        step_stmt = select(SequenceStep).where(
            SequenceStep.id == original.sequence_step_id,
        )
        step_result = await db.execute(step_stmt)
        step = step_result.scalar_one_or_none()
        if step:
            step_number = step.step_number

    use_tone = tone or original.tone or campaign.tone_preset or "consultative"

    llm_router = LLMRouter()
    agent = MessagingAgent(llm_router=llm_router, db_session=db)

    result = await agent.execute({
        "contact": contact_data,
        "company": company_data,
        "research_brief": research_data if research_data else None,
        "campaign_type": campaign.campaign_type or "intro",
        "tone_preset": use_tone,
        "step_number": step_number,
        "previous_messages": [],
        "additional_context": additional_context,
    })

    if not result.success:
        raise RuntimeError(f"Messaging agent failed: {result.error}")

    generated = result.data
    new_variant = variant_label or generated.get("variant_label", original.variant_label)

    new_message = MessageDraft(
        sequence_step_id=original.sequence_step_id,
        contact_id=original.contact_id,
        campaign_id=original.campaign_id,
        subject=generated.get("subject", original.subject),
        body=generated.get("body", original.body),
        tone=use_tone,
        variant_label=new_variant,
        context_data={
            "regenerated_from": str(original.id),
            "additional_context": additional_context,
        },
        status="draft",
        created_by=user_id,
    )
    db.add(new_message)
    await db.flush()
    await db.refresh(new_message)
    return new_message


async def generate_campaign_messages(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
    step_number: int | None = None,
    tone_override: str | None = None,
) -> dict:
    """Generate messages for all contacts in a campaign."""
    from app.agents.llm.router import LLMRouter
    from app.agents.messaging_agent import MessagingAgent

    # Get campaign
    campaign_stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.is_deleted.is_(False),
    )
    campaign_result = await db.execute(campaign_stmt)
    campaign = campaign_result.scalar_one_or_none()
    if campaign is None:
        raise NotFoundError(f"Campaign with id '{campaign_id}' not found")

    # Get steps
    steps_stmt = (
        select(SequenceStep)
        .where(
            SequenceStep.campaign_id == campaign_id,
            SequenceStep.is_deleted.is_(False),
        )
        .order_by(SequenceStep.step_number)
    )
    if step_number is not None:
        steps_stmt = steps_stmt.where(SequenceStep.step_number == step_number)
    steps_result = await db.execute(steps_stmt)
    steps = list(steps_result.scalars().all())

    if not steps:
        raise ValidationError("Campaign has no sequence steps to generate messages for.")

    # Get campaign contacts
    contacts_stmt = (
        select(CampaignContact)
        .where(CampaignContact.campaign_id == campaign_id)
    )
    contacts_result = await db.execute(contacts_stmt)
    campaign_contacts = list(contacts_result.scalars().all())

    if not campaign_contacts:
        raise ValidationError("Campaign has no contacts to generate messages for.")

    llm_router = LLMRouter()
    agent = MessagingAgent(llm_router=llm_router, db_session=db)

    generated_count = 0
    failed_count = 0
    total_contacts = len(campaign_contacts)
    use_tone = tone_override or campaign.tone_preset or "consultative"

    for cc in campaign_contacts:
        contact = cc.contact
        if not contact:
            failed_count += 1
            continue

        # Build contact data
        contact_name_parts = []
        if contact.first_name:
            contact_name_parts.append(contact.first_name)
        if contact.last_name:
            contact_name_parts.append(contact.last_name)
        contact_name = " ".join(contact_name_parts) if contact_name_parts else ""

        contact_data = {
            "name": contact_name,
            "title": contact.job_title or "",
            "email": contact.email or "",
            "persona_type": contact.persona_type or "",
        }

        # Build company data
        company = contact.company
        company_data = {}
        if company:
            company_data = {
                "name": company.name or "",
                "industry": company.industry or "",
                "geography": company.geography or "",
                "size": company.employee_count,
            }

        # Get research brief
        research_data = None
        research_stmt = (
            select(ResearchBrief)
            .where(
                ResearchBrief.is_deleted.is_(False),
                ResearchBrief.contact_id == contact.id,
            )
            .order_by(ResearchBrief.created_at.desc())
            .limit(1)
        )
        research_result = await db.execute(research_stmt)
        brief = research_result.scalar_one_or_none()

        # Fall back to company-level research
        if not brief and contact.company_id:
            research_stmt_company = (
                select(ResearchBrief)
                .where(
                    ResearchBrief.is_deleted.is_(False),
                    ResearchBrief.company_id == contact.company_id,
                    ResearchBrief.contact_id.is_(None),
                )
                .order_by(ResearchBrief.created_at.desc())
                .limit(1)
            )
            research_company_result = await db.execute(research_stmt_company)
            brief = research_company_result.scalar_one_or_none()

        if brief and brief.content:
            research_data = {
                "summary": brief.content.get("summary", ""),
                "talking_points": brief.content.get("talking_points", []),
                "pain_points": brief.content.get("pain_points", []),
            }

        for step in steps:
            try:
                result = await agent.execute({
                    "contact": contact_data,
                    "company": company_data,
                    "research_brief": research_data,
                    "campaign_type": campaign.campaign_type or "intro",
                    "tone_preset": use_tone,
                    "step_number": step.step_number,
                    "previous_messages": [],
                    "additional_context": None,
                })

                if not result.success:
                    failed_count += 1
                    continue

                generated = result.data

                message = MessageDraft(
                    sequence_step_id=step.id,
                    contact_id=contact.id,
                    campaign_id=campaign_id,
                    subject=generated.get("subject", ""),
                    body=generated.get("body", ""),
                    tone=use_tone,
                    variant_label=generated.get("variant_label"),
                    context_data={
                        "company_data": company_data,
                        "research_used": research_data is not None,
                    },
                    status="pending_approval",
                    created_by=user_id,
                )
                db.add(message)
                generated_count += 1

            except Exception:
                failed_count += 1

    await db.flush()

    return {
        "total_contacts": total_contacts,
        "messages_generated": generated_count,
        "messages_failed": failed_count,
    }


async def get_message_stats(
    db: AsyncSession,
    campaign_id: uuid.UUID,
) -> dict:
    """Get message counts per status for a campaign."""
    stmt = (
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
    result = await db.execute(stmt)
    rows = result.all()

    stats = {
        "draft": 0,
        "pending_approval": 0,
        "approved": 0,
        "sent": 0,
        "failed": 0,
        "replied": 0,
        "bounced": 0,
        "total": 0,
    }

    for row in rows:
        status_val = row[0]
        count_val = row[1]
        if status_val in stats:
            stats[status_val] = count_val
        stats["total"] += count_val

    return stats
