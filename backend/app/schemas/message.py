import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class MessageStatus(str, Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    sent = "sent"
    failed = "failed"
    replied = "replied"
    bounced = "bounced"


class MessageCreate(BaseModel):
    sequence_step_id: uuid.UUID | None = None
    contact_id: uuid.UUID
    campaign_id: uuid.UUID
    subject: str | None = None
    body: str
    tone: str | None = None
    variant_label: str | None = None
    scheduled_for: datetime | None = None


class MessageUpdate(BaseModel):
    subject: str | None = None
    body: str | None = None
    tone: str | None = None
    scheduled_for: datetime | None = None


class MessageResponse(BaseModel):
    id: uuid.UUID
    sequence_step_id: uuid.UUID | None = None
    contact_id: uuid.UUID
    campaign_id: uuid.UUID
    subject: str | None = None
    body: str
    tone: str | None = None
    variant_label: str | None = None
    context_data: dict | None = None
    status: str
    approved_by: uuid.UUID | None = None
    approved_at: datetime | None = None
    sent_at: datetime | None = None
    opened_at: datetime | None = None
    replied_at: datetime | None = None
    error_message: str | None = None
    scheduled_for: datetime | None = None
    created_by: uuid.UUID
    contact_name: str = ""
    contact_email: str = ""
    company_name: str = ""
    campaign_name: str = ""
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_message(cls, msg: "MessageDraft") -> "MessageResponse":  # noqa: F821
        contact = msg.contact
        contact_name = ""
        contact_email = ""
        company_name = ""
        if contact:
            parts = []
            if contact.first_name:
                parts.append(contact.first_name)
            if contact.last_name:
                parts.append(contact.last_name)
            contact_name = " ".join(parts) if parts else ""
            contact_email = contact.email or ""
            if contact.company:
                company_name = contact.company.name or ""

        campaign_name = ""
        if msg.campaign:
            campaign_name = msg.campaign.name or ""

        return cls(
            id=msg.id,
            sequence_step_id=msg.sequence_step_id,
            contact_id=msg.contact_id,
            campaign_id=msg.campaign_id,
            subject=msg.subject,
            body=msg.body,
            tone=msg.tone,
            variant_label=msg.variant_label,
            context_data=msg.context_data,
            status=msg.status,
            approved_by=msg.approved_by,
            approved_at=msg.approved_at,
            sent_at=msg.sent_at,
            opened_at=msg.opened_at,
            replied_at=msg.replied_at,
            error_message=msg.error_message,
            scheduled_for=msg.scheduled_for,
            created_by=msg.created_by,
            contact_name=contact_name,
            contact_email=contact_email,
            company_name=company_name,
            campaign_name=campaign_name,
            created_at=msg.created_at,
            updated_at=msg.updated_at,
        )


class MessageListResponse(BaseModel):
    id: uuid.UUID
    subject: str | None = None
    contact_name: str = ""
    contact_email: str = ""
    company_name: str = ""
    campaign_name: str = ""
    status: str
    tone: str | None = None
    variant_label: str | None = None
    scheduled_for: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_message(cls, msg: "MessageDraft") -> "MessageListResponse":  # noqa: F821
        contact = msg.contact
        contact_name = ""
        contact_email = ""
        company_name = ""
        if contact:
            parts = []
            if contact.first_name:
                parts.append(contact.first_name)
            if contact.last_name:
                parts.append(contact.last_name)
            contact_name = " ".join(parts) if parts else ""
            contact_email = contact.email or ""
            if contact.company:
                company_name = contact.company.name or ""

        campaign_name = ""
        if msg.campaign:
            campaign_name = msg.campaign.name or ""

        # Truncate subject to 100 chars for list view
        subject = msg.subject
        if subject and len(subject) > 100:
            subject = subject[:97] + "..."

        return cls(
            id=msg.id,
            subject=subject,
            contact_name=contact_name,
            contact_email=contact_email,
            company_name=company_name,
            campaign_name=campaign_name,
            status=msg.status,
            tone=msg.tone,
            variant_label=msg.variant_label,
            scheduled_for=msg.scheduled_for,
            sent_at=msg.sent_at,
            created_at=msg.created_at,
        )


class MessageApproveRequest(BaseModel):
    comment: str | None = None


class MessageRejectRequest(BaseModel):
    feedback: str = Field(..., min_length=1)


class MessageRegenerateRequest(BaseModel):
    tone: str | None = None
    variant_label: str | None = None
    additional_context: str | None = None


class BulkGenerateRequest(BaseModel):
    campaign_id: uuid.UUID
    step_number: int | None = None
    tone_override: str | None = None


class BulkGenerateResponse(BaseModel):
    total_contacts: int
    messages_generated: int
    messages_failed: int
    task_id: str


class MessageSendResponse(BaseModel):
    message_id: uuid.UUID
    status: str
    sent_at: datetime | None = None
    error: str | None = None
