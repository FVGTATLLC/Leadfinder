import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.campaign import (
    CampaignContactAdd,
    CampaignContactResponse,
    CampaignCreate,
    CampaignListResponse,
    CampaignProgress,
    CampaignResponse,
    CampaignUpdate,
    SequenceStepCreate,
    SequenceStepResponse,
    SequenceStepUpdate,
)
from app.schemas.user import TokenPayload
from app.services import campaign_service
from app.tasks.campaign_tasks import (
    _activate_campaign_impl,
    _pause_campaign_impl,
    _resume_campaign_impl,
    _stop_contact_sequence_impl,
)
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=PaginatedResponse[CampaignListResponse])
async def list_campaigns(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    strategy_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await campaign_service.list_campaigns(
        db,
        strategy_id=strategy_id,
        status=status,
        pagination=params,
        user_id=current_user.sub,
        user_role=current_user.role,
    )
    return result


@router.post("", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    data: CampaignCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CampaignResponse:
    campaign = await campaign_service.create_campaign(
        db, uuid.UUID(current_user.sub), data
    )
    return CampaignResponse.from_campaign(campaign)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CampaignResponse:
    campaign = await campaign_service.get_campaign(db, campaign_id)
    return CampaignResponse.from_campaign(campaign)


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    data: CampaignUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CampaignResponse:
    campaign = await campaign_service.update_campaign(db, campaign_id, data)
    return CampaignResponse.from_campaign(campaign)


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await campaign_service.delete_campaign(db, campaign_id)


@router.post("/{campaign_id}/activate")
async def activate_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Activate a campaign. Triggers background task to generate step-1 messages."""
    # Validate the campaign exists and can be activated (has contacts + steps)
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign.status not in ("draft", "paused"):
        from app.exceptions import ValidationError
        raise ValidationError(
            f"Cannot activate campaign with status '{campaign.status}'"
        )

    # Run activation inline (no Celery worker configured). Generates
    # step-1 messages and sends them synchronously. May take ~15-60 sec
    # depending on contact count + LLM latency.
    result = await _activate_campaign_impl(str(campaign_id), current_user.sub)
    return {
        "message": "Campaign activated",
        "campaign_id": str(campaign_id),
        **result,
    }


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Pause an active campaign. Cancels pending scheduled messages."""
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign.status != "active":
        from app.exceptions import ValidationError
        raise ValidationError(
            f"Cannot pause campaign with status '{campaign.status}'"
        )

    result = await _pause_campaign_impl(str(campaign_id))
    return {
        "message": "Campaign paused",
        "campaign_id": str(campaign_id),
        **result,
    }


@router.post("/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Resume a paused campaign."""
    campaign = await campaign_service.get_campaign(db, campaign_id)
    if campaign.status != "paused":
        from app.exceptions import ValidationError
        raise ValidationError(
            f"Cannot resume campaign with status '{campaign.status}'"
        )

    result = await _resume_campaign_impl(str(campaign_id))
    return {
        "message": "Campaign resumed",
        "campaign_id": str(campaign_id),
        **result,
    }


@router.post("/{campaign_id}/contacts/{contact_id}/stop")
async def stop_contact(
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Stop the sequence for a specific contact in a campaign."""
    result = await _stop_contact_sequence_impl(
        str(campaign_id), str(contact_id)
    )
    return {
        "message": "Contact sequence stopped",
        "campaign_id": str(campaign_id),
        "contact_id": str(contact_id),
        **result,
    }


@router.get("/{campaign_id}/progress", response_model=CampaignProgress)
async def get_campaign_progress(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CampaignProgress:
    """Get detailed progress for a campaign."""
    progress = await campaign_service.get_campaign_progress(db, campaign_id)
    return CampaignProgress(**progress)


@router.post("/{campaign_id}/approve", response_model=CampaignResponse)
async def approve_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CampaignResponse:
    campaign = await campaign_service.approve_campaign(
        db, campaign_id, uuid.UUID(current_user.sub)
    )
    return CampaignResponse.from_campaign(campaign)


@router.get(
    "/{campaign_id}/contacts",
    response_model=PaginatedResponse[CampaignContactResponse],
)
async def get_campaign_contacts(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await campaign_service.get_campaign_contacts(
        db, campaign_id, pagination=params
    )
    return result


@router.post("/{campaign_id}/contacts", status_code=201)
async def add_campaign_contacts(
    campaign_id: uuid.UUID,
    data: CampaignContactAdd,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    count = await campaign_service.add_contacts_to_campaign(
        db, campaign_id, data.contact_ids
    )
    return {"added": count}


@router.delete("/{campaign_id}/contacts/{contact_id}", status_code=204)
async def remove_campaign_contact(
    campaign_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await campaign_service.remove_contact_from_campaign(
        db, campaign_id, contact_id
    )


@router.get(
    "/{campaign_id}/steps",
    response_model=list[SequenceStepResponse],
)
async def get_campaign_steps(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[SequenceStepResponse]:
    steps = await campaign_service.get_campaign_steps(db, campaign_id)
    return [SequenceStepResponse.model_validate(s) for s in steps]


@router.post(
    "/{campaign_id}/steps",
    response_model=SequenceStepResponse,
    status_code=201,
)
async def add_campaign_step(
    campaign_id: uuid.UUID,
    data: SequenceStepCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> SequenceStepResponse:
    step = await campaign_service.add_sequence_step(db, campaign_id, data)
    return SequenceStepResponse.model_validate(step)


@router.patch(
    "/{campaign_id}/steps/{step_id}",
    response_model=SequenceStepResponse,
)
async def update_campaign_step(
    campaign_id: uuid.UUID,
    step_id: uuid.UUID,
    data: SequenceStepUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> SequenceStepResponse:
    step = await campaign_service.update_sequence_step(db, step_id, data)
    return SequenceStepResponse.model_validate(step)


class _BulkStepItem(BaseModel):
    id: uuid.UUID | None = None
    step_number: int
    delay_days: int
    step_type: str | None = None
    subject_template: str | None = None
    body_template: str | None = None
    is_ai_generated: bool = True


class _BulkStepsRequest(BaseModel):
    steps: list[_BulkStepItem]


class _BulkStepsResponse(BaseModel):
    steps: list[SequenceStepResponse]


@router.post(
    "/{campaign_id}/steps/bulk",
    response_model=_BulkStepsResponse,
)
async def bulk_replace_campaign_steps(
    campaign_id: uuid.UUID,
    body: _BulkStepsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> _BulkStepsResponse:
    """Replace the full sequence of a campaign in one round-trip.

    - Updates any step that has an id and is still present.
    - Creates any step without an id.
    - Deletes any existing step whose id is absent from the payload.
    """
    existing = await campaign_service.get_campaign_steps(db, campaign_id)
    incoming_ids = {s.id for s in body.steps if s.id is not None}

    for step in existing:
        if step.id not in incoming_ids:
            await campaign_service.delete_sequence_step(db, step.id)

    saved: list = []
    for item in body.steps:
        if item.id is not None:
            update = SequenceStepUpdate(
                delay_days=item.delay_days,
                step_type=item.step_type,  # type: ignore[arg-type]
                subject_template=item.subject_template,
                body_template=item.body_template,
                is_ai_generated=item.is_ai_generated,
            )
            updated = await campaign_service.update_sequence_step(db, item.id, update)
            saved.append(updated)
        else:
            create = SequenceStepCreate(
                step_number=item.step_number,
                delay_days=item.delay_days,
                step_type=item.step_type or "email",  # type: ignore[arg-type]
                subject_template=item.subject_template,
                body_template=item.body_template,
                is_ai_generated=item.is_ai_generated,
            )
            created = await campaign_service.add_sequence_step(db, campaign_id, create)
            saved.append(created)

    return _BulkStepsResponse(
        steps=[SequenceStepResponse.model_validate(s) for s in saved]
    )


@router.delete("/{campaign_id}/steps/{step_id}", status_code=204)
async def delete_campaign_step(
    campaign_id: uuid.UUID,
    step_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await campaign_service.delete_sequence_step(db, step_id)


# ===== AI Generation Endpoints =====

from pydantic import BaseModel, Field


class AIGenerateStepRequest(BaseModel):
    campaign_type: str = "intro"
    tone: str = "formal"
    step_number: int = 1
    contact_name: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    industry: str | None = None
    geography: str | None = None
    sender_name: str | None = None
    sender_title: str | None = None
    sender_phone: str | None = None


class AIGenerateStepResponse(BaseModel):
    subject: str
    body: str


class AISuggestSequenceRequest(BaseModel):
    campaign_type: str = "intro"
    tone: str = "formal"
    contact_name: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    industry: str | None = None
    geography: str | None = None
    num_steps: int = Field(default=4, ge=2, le=8)
    sender_name: str | None = None
    sender_title: str | None = None
    sender_phone: str | None = None


class AISuggestSequenceResponse(BaseModel):
    steps: list[dict]


@router.post("/ai/generate-step", response_model=AIGenerateStepResponse)
async def ai_generate_step(
    request: AIGenerateStepRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> AIGenerateStepResponse:
    """Generate AI email content for a single campaign step."""
    from app.agents.llm.router import LLMRouter
    from app.agents.messaging_agent import MessagingAgent

    llm_router = LLMRouter()
    agent = MessagingAgent(llm_router=llm_router, db_session=db)

    # Use actual contact/company data if provided, else use template variables
    first_name = "{{first_name}}"
    last_name = "{{last_name}}"
    if request.contact_name:
        parts = request.contact_name.split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

    result = await agent.execute({
        "contact": {
            "first_name": first_name,
            "last_name": last_name,
            "job_title": request.job_title or "{{job_title}}",
        },
        "company": {
            "name": request.company_name or "{{company_name}}",
            "industry": request.industry or "{{industry}}",
            "geography": request.geography or "",
        },
        "campaign_type": request.campaign_type,
        "tone": request.tone,
        "step_number": request.step_number,
        "previous_messages": [],
        "user_id": current_user.sub,
        "sender_name": request.sender_name,
        "sender_title": request.sender_title,
        "sender_phone": request.sender_phone,
    })

    if result.success:
        data = result.data
        return AIGenerateStepResponse(
            subject=data.get("subject", ""),
            body=data.get("body", ""),
        )

    return AIGenerateStepResponse(
        subject=f"Quick question about your travel program",
        body="Hi {{first_name}},\n\nI hope this message finds you well.\n\nBest regards",
    )


@router.post("/ai/suggest-sequence", response_model=AISuggestSequenceResponse)
async def ai_suggest_sequence(
    request: AISuggestSequenceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> AISuggestSequenceResponse:
    """AI suggests a complete multi-step email sequence."""
    from app.agents.llm.router import LLMRouter

    llm_router = LLMRouter()

    schema = {
        "type": "object",
        "properties": {
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "step_number": {"type": "integer"},
                        "delay_days": {"type": "integer", "description": "Days after previous step"},
                        "step_type": {"type": "string", "enum": ["email", "linkedin_message", "manual_task"]},
                        "subject": {"type": "string", "description": "Email subject line with {{variables}}"},
                        "body": {"type": "string", "description": "Email body with {{variables}} for personalization"},
                        "purpose": {"type": "string", "description": "Brief note on this step's purpose"},
                    },
                    "required": ["step_number", "delay_days", "step_type", "subject", "body", "purpose"],
                },
            }
        },
        "required": ["steps"],
    }

    tone_label = request.tone.replace("_", " ").title()
    type_label = request.campaign_type.replace("_", " ").title()

    messages = [
        {
            "role": "system",
            "content": (
                "You are a B2B sales email sequence strategist specialising in the Nigerian corporate travel and MICE market. "
                "You create multi-step outreach sequences for corporate travel and MICE services targeting Nigerian companies. "
                "Each step should have a clear purpose and build on the previous one. "
                "Use {{first_name}}, {{last_name}}, {{company_name}}, {{job_title}}, {{industry}} "
                "as template variables for personalization."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create a {request.num_steps}-step email sequence for a {type_label} campaign.\n\n"
                f"Tone: {tone_label}\n"
                f"Target Contact: {request.contact_name or '{{first_name}} {{last_name}}'}\n"
                f"Job Title: {request.job_title or '{{job_title}}'}\n"
                f"Target Company: {request.company_name or '{{company_name}}'}\n"
                f"Industry: {request.industry or '{{industry}}'}\n"
                f"Region: {request.geography or 'Global'}\n"
                f"Sender: {request.sender_name or '{{sender_name}}'}"
                f"{', ' + request.sender_title if request.sender_title else ''}"
                f"\n"
                f"Sender Phone: {request.sender_phone or ''}\n\n"
                f"Requirements:\n"
                f"1. Step 1 should be the initial outreach (delay 0 days)\n"
                f"2. Each subsequent step should have increasing delay (3-7 days apart)\n"
                f"3. Mix email steps with 1-2 LinkedIn or manual follow-up tasks\n"
                f"4. Last step should be a final check-in or meeting request\n"
                f"5. Each email should be concise (under 150 words)\n"
                f"6. Use {{{{first_name}}}}, {{{{company_name}}}}, {{{{job_title}}}} variables\n"
                f"7. Each step should have a unique angle or value proposition\n"
                f"8. End each email with a professional signature including sender name, title, and phone\n"
                f"9. Address the recipient by first name and reference their role/title naturally\n\n"
                f"Respond with structured data matching the schema."
            ),
        },
    ]

    try:
        result = await llm_router.complete_structured(
            task_type="messaging_intro",
            messages=messages,
            schema=schema,
        )

        steps = result.get("steps", [])
        return AISuggestSequenceResponse(steps=steps)
    except Exception as e:
        # Fallback sequence
        return AISuggestSequenceResponse(steps=[
            {"step_number": 1, "delay_days": 0, "step_type": "email",
             "subject": f"Corporate travel solutions for {{{{company_name}}}}",
             "body": f"Hi {{{{first_name}}}},\n\nI'm reaching out regarding corporate travel management for {{{{company_name}}}}.\n\nWe specialise in helping Nigerian companies optimise their travel spend.\n\nWould you be open to a brief call?\n\nBest regards",
             "purpose": "Initial introduction"},
            {"step_number": 2, "delay_days": 3, "step_type": "email",
             "subject": f"Following up - travel cost savings for {{{{company_name}}}}",
             "body": f"Hi {{{{first_name}}}},\n\nJust following up on my previous email. We've helped similar companies in {{{{industry}}}} reduce travel costs by 15-25%.\n\nWould a quick 15-minute call work this week?\n\nBest regards",
             "purpose": "Follow-up with value prop"},
            {"step_number": 3, "delay_days": 5, "step_type": "linkedin_message",
             "subject": "LinkedIn connection request",
             "body": f"Hi {{{{first_name}}}}, I'd love to connect and share how we help {{{{industry}}}} companies in Nigeria with their travel programs.",
             "purpose": "LinkedIn touchpoint"},
            {"step_number": 4, "delay_days": 7, "step_type": "email",
             "subject": f"Last check-in regarding {{{{company_name}}}}'s travel needs",
             "body": f"Hi {{{{first_name}}}},\n\nI understand you're busy. If corporate travel management isn't a priority right now, no worries.\n\nIf things change, I'm here to help {{{{company_name}}}} optimize travel operations.\n\nBest regards",
             "purpose": "Final follow-up"},
        ])
