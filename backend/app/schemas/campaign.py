import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class CampaignType(str, Enum):
    intro = "intro"
    follow_up = "follow_up"
    mice = "mice"
    corporate = "corporate"
    custom = "custom"


class TonePreset(str, Enum):
    formal = "formal"
    friendly = "friendly"
    consultative = "consultative"
    aggressive = "aggressive"


class CampaignStatus(str, Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"
    archived = "archived"


class StepType(str, Enum):
    email = "email"
    linkedin_message = "linkedin_message"
    manual_task = "manual_task"


class CampaignContactStatus(str, Enum):
    active = "active"
    replied = "replied"
    stopped = "stopped"
    bounced = "bounced"


class CampaignCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    strategy_id: uuid.UUID | None = None
    campaign_type: CampaignType = CampaignType.intro
    tone_preset: TonePreset = TonePreset.consultative
    starts_at: datetime | None = None
    status: str | None = None
    contact_ids: list[uuid.UUID] | None = None
    steps: list["SequenceStepCreate"] | None = None


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    campaign_type: CampaignType | None = None
    tone_preset: TonePreset | None = None
    status: CampaignStatus | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    strategy_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    campaign_type: str
    tone_preset: str
    status: str
    created_by: uuid.UUID
    approved_by: uuid.UUID | None = None
    approved_at: datetime | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    contact_count: int = 0
    step_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_campaign(cls, campaign: "Campaign") -> "CampaignResponse":  # noqa: F821
        contact_count = len(campaign.contacts) if campaign.contacts else 0
        step_count = len(campaign.steps) if campaign.steps else 0

        return cls(
            id=campaign.id,
            strategy_id=campaign.strategy_id,
            name=campaign.name,
            description=campaign.description,
            campaign_type=campaign.campaign_type,
            tone_preset=campaign.tone_preset,
            status=campaign.status,
            created_by=campaign.created_by,
            approved_by=campaign.approved_by,
            approved_at=campaign.approved_at,
            starts_at=campaign.starts_at,
            ends_at=campaign.ends_at,
            contact_count=contact_count,
            step_count=step_count,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )


class CampaignListResponse(BaseModel):
    id: uuid.UUID
    name: str
    campaign_type: str
    tone_preset: str
    status: str
    contact_count: int = 0
    step_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_campaign(cls, campaign: "Campaign") -> "CampaignListResponse":  # noqa: F821
        contact_count = len(campaign.contacts) if campaign.contacts else 0
        step_count = len(campaign.steps) if campaign.steps else 0

        return cls(
            id=campaign.id,
            name=campaign.name,
            campaign_type=campaign.campaign_type,
            tone_preset=campaign.tone_preset,
            status=campaign.status,
            contact_count=contact_count,
            step_count=step_count,
            created_at=campaign.created_at,
        )


class SequenceStepCreate(BaseModel):
    step_number: int
    delay_days: int
    step_type: StepType = StepType.email
    subject_template: str | None = None
    body_template: str | None = None
    is_ai_generated: bool = True


class SequenceStepUpdate(BaseModel):
    delay_days: int | None = None
    step_type: StepType | None = None
    subject_template: str | None = None
    body_template: str | None = None
    is_ai_generated: bool | None = None


class SequenceStepResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    step_number: int
    delay_days: int
    step_type: str
    subject_template: str | None = None
    body_template: str | None = None
    is_ai_generated: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class StepCompletion(BaseModel):
    step_number: int
    completed: int = 0
    pending: int = 0
    sent: int = 0


class CampaignProgress(BaseModel):
    campaign_id: uuid.UUID
    total_contacts: int = 0
    contacts_per_status: dict[str, int] = Field(default_factory=dict)
    steps_completion: list[StepCompletion] = Field(default_factory=list)
    overall_progress_percent: float = 0.0
    messages_sent: int = 0
    messages_pending: int = 0
    replies_count: int = 0


class CampaignContactAdd(BaseModel):
    contact_ids: list[uuid.UUID]


class CampaignContactResponse(BaseModel):
    contact_id: uuid.UUID
    contact_name: str | None = None
    contact_email: str | None = None
    company_name: str | None = None
    status: str
    current_step: int
    added_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_campaign_contact(
        cls, cc: "CampaignContact",  # noqa: F821
    ) -> "CampaignContactResponse":
        contact = cc.contact
        contact_name = None
        if contact:
            parts = []
            if contact.first_name:
                parts.append(contact.first_name)
            if contact.last_name:
                parts.append(contact.last_name)
            contact_name = " ".join(parts) if parts else None

        contact_email = contact.email if contact else None
        company_name = None
        if contact and contact.company:
            company_name = contact.company.name

        return cls(
            contact_id=cc.contact_id,
            contact_name=contact_name,
            contact_email=contact_email,
            company_name=company_name,
            status=cc.status,
            current_step=cc.current_step,
            added_at=cc.added_at,
        )


# Resolve forward reference now that SequenceStepCreate is defined.
CampaignCreate.model_rebuild()
