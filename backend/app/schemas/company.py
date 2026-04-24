import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TravelIntensity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    very_high = "very_high"


class CompanySource(str, Enum):
    manual = "manual"
    discovery_agent = "discovery_agent"
    import_ = "import"


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    sub_industry: str | None = Field(default=None, max_length=255)
    geography: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=100)
    employee_count: int | None = None
    revenue_range: str | None = Field(default=None, max_length=100)
    travel_intensity: str | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    website: str | None = Field(default=None, max_length=500)
    source: str = "manual"


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    sub_industry: str | None = Field(default=None, max_length=255)
    geography: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=100)
    employee_count: int | None = None
    revenue_range: str | None = Field(default=None, max_length=100)
    travel_intensity: str | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    website: str | None = Field(default=None, max_length=500)
    source: str | None = None


class CompanyResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None = None
    industry: str | None = None
    sub_industry: str | None = None
    geography: str | None = None
    city: str | None = None
    country: str | None = None
    employee_count: int | None = None
    revenue_range: str | None = None
    travel_intensity: str | None = None
    icp_score: float | None = None
    score_breakdown: dict | None = None
    source: str | None = None
    linkedin_url: str | None = None
    website: str | None = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyListResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None = None
    industry: str | None = None
    geography: str | None = None
    city: str | None = None
    country: str | None = None
    employee_count: int | None = None
    icp_score: float | None = None
    score_breakdown: dict | None = None
    source: str | None = None
    website: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyImport(BaseModel):
    companies: list[CompanyCreate]


class CompanyScoreResponse(BaseModel):
    id: uuid.UUID
    icp_score: float
    score_breakdown: dict

    model_config = {"from_attributes": True}
