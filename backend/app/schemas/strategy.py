import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class StrategyStatus(str, Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class StrategyFilters(BaseModel):
    industry: list[str] = Field(default_factory=list)
    city: list[str] = Field(default_factory=list)
    revenue_min: int | None = None
    revenue_max: int | None = None
    employee_min: int | None = None
    employee_max: int | None = None
    travel_intensity: list[str] = Field(default_factory=list)
    custom_tags: list[str] = Field(default_factory=list)


class StrategyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    filters: StrategyFilters
    team_id: uuid.UUID | None = None


class StrategyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    filters: StrategyFilters | None = None
    status: StrategyStatus | None = None


class StrategyResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    filters: StrategyFilters
    status: str
    company_count: int
    created_by: uuid.UUID
    team_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrategyListResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    company_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
