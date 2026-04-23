import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PersonaType(str, Enum):
    procurement_head = "procurement_head"
    admin = "admin"
    cfo = "cfo"
    travel_manager = "travel_manager"
    ceo = "ceo"
    hr_head = "hr_head"
    other = "other"


class EnrichmentStatus(str, Enum):
    pending = "pending"
    enriched = "enriched"
    failed = "failed"
    verified = "verified"


class ContactCreate(BaseModel):
    company_id: uuid.UUID
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    job_title: str | None = Field(default=None, max_length=255)
    persona_type: PersonaType | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    source: str = "manual"
    notes: str | None = None
    is_primary: bool = False


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    job_title: str | None = Field(default=None, max_length=255)
    persona_type: PersonaType | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    source: str | None = None
    notes: str | None = None
    is_primary: bool | None = None


class ContactResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    email_verified: bool = False
    phone: str | None = None
    job_title: str | None = None
    persona_type: str | None = None
    linkedin_url: str | None = None
    confidence_score: float | None = None
    enrichment_status: str = "pending"
    enrichment_source: str | None = None
    enriched_at: datetime | None = None
    source: str | None = None
    notes: str | None = None
    is_primary: bool = False
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    company_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_contact(cls, contact: "Contact") -> "ContactResponse":  # noqa: F821
        data = {
            "id": contact.id,
            "company_id": contact.company_id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "email_verified": contact.email_verified,
            "phone": contact.phone,
            "job_title": contact.job_title,
            "persona_type": contact.persona_type,
            "linkedin_url": contact.linkedin_url,
            "confidence_score": contact.confidence_score,
            "enrichment_status": contact.enrichment_status,
            "enrichment_source": contact.enrichment_source,
            "enriched_at": contact.enriched_at,
            "source": contact.source,
            "notes": contact.notes,
            "is_primary": contact.is_primary,
            "created_by": contact.created_by,
            "created_at": contact.created_at,
            "updated_at": contact.updated_at,
            "company_name": contact.company.name if contact.company else None,
        }
        return cls(**data)


class ContactListResponse(BaseModel):
    id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    job_title: str | None = None
    persona_type: str | None = None
    confidence_score: float | None = None
    enrichment_status: str = "pending"
    company_id: uuid.UUID
    company_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_contact(cls, contact: "Contact") -> "ContactListResponse":  # noqa: F821
        data = {
            "id": contact.id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "job_title": contact.job_title,
            "persona_type": contact.persona_type,
            "confidence_score": contact.confidence_score,
            "enrichment_status": contact.enrichment_status,
            "company_id": contact.company_id,
            "company_name": contact.company.name if contact.company else None,
            "created_at": contact.created_at,
        }
        return cls(**data)


class ContactEnrichRequest(BaseModel):
    contact_id: uuid.UUID


class BulkEnrichRequest(BaseModel):
    contact_ids: list[uuid.UUID]


class ContactEnrichResponse(BaseModel):
    contact_id: uuid.UUID
    enrichment_status: str
    email: str | None = None
    linkedin_url: str | None = None
    confidence_score: float | None = None

    model_config = {"from_attributes": True}


class PersonaSuggestion(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    job_title: str
    persona_type: str
    confidence_score: float
    reasoning: str


class PersonaDiscoveryResponse(BaseModel):
    company_id: uuid.UUID
    suggestions: list[PersonaSuggestion]
