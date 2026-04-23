import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class BriefType(str, Enum):
    company_summary = "company_summary"
    prospect_summary = "prospect_summary"
    talking_points = "talking_points"
    industry_brief = "industry_brief"


class ResearchContent(BaseModel):
    summary: str
    key_facts: list[str] = Field(default_factory=list)
    talking_points: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    recent_news: list[str] | None = None


class ResearchBriefCreate(BaseModel):
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    brief_type: BriefType


class ResearchBriefResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    brief_type: str
    content: dict = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list)
    generated_by: str
    llm_model_used: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    company_name: str | None = None
    contact_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_brief(cls, brief: "ResearchBrief") -> "ResearchBriefResponse":  # noqa: F821
        company_name = None
        if brief.company:
            company_name = brief.company.name

        contact_name = None
        if brief.contact:
            parts = []
            if brief.contact.first_name:
                parts.append(brief.contact.first_name)
            if brief.contact.last_name:
                parts.append(brief.contact.last_name)
            contact_name = " ".join(parts) if parts else None

        # Normalize sources to a list of strings
        sources: list[str] = []
        if brief.sources:
            if isinstance(brief.sources, list):
                sources = brief.sources
            elif isinstance(brief.sources, dict):
                sources = list(brief.sources.values()) if brief.sources else []

        return cls(
            id=brief.id,
            company_id=brief.company_id,
            contact_id=brief.contact_id,
            brief_type=brief.brief_type,
            content=brief.content or {},
            sources=sources,
            generated_by=brief.generated_by,
            llm_model_used=brief.llm_model_used,
            expires_at=brief.expires_at,
            created_at=brief.created_at,
            updated_at=brief.updated_at,
            company_name=company_name,
            contact_name=contact_name,
        )


class ResearchBriefListResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    brief_type: str
    content: dict = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list)
    generated_by: str
    llm_model_used: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    company_name: str | None = None
    contact_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_brief(cls, brief: "ResearchBrief") -> "ResearchBriefListResponse":  # noqa: F821
        company_name = None
        if brief.company:
            company_name = brief.company.name

        contact_name = None
        if brief.contact:
            parts = []
            if brief.contact.first_name:
                parts.append(brief.contact.first_name)
            if brief.contact.last_name:
                parts.append(brief.contact.last_name)
            contact_name = " ".join(parts) if parts else None

        # Normalize sources to a list of strings
        sources: list[str] = []
        if brief.sources:
            if isinstance(brief.sources, list):
                sources = brief.sources
            elif isinstance(brief.sources, dict):
                sources = list(brief.sources.values()) if brief.sources else []

        return cls(
            id=brief.id,
            company_id=brief.company_id,
            contact_id=brief.contact_id,
            brief_type=brief.brief_type,
            content=brief.content or {},
            sources=sources,
            generated_by=brief.generated_by,
            llm_model_used=brief.llm_model_used,
            expires_at=brief.expires_at,
            created_at=brief.created_at,
            company_name=company_name,
            contact_name=contact_name,
        )


class ResearchGenerateRequest(BaseModel):
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    brief_type: BriefType = BriefType.company_summary
