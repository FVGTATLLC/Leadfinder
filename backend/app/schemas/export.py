import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ExportType(str, Enum):
    companies = "companies"
    contacts = "contacts"
    activities = "activities"
    crm_full = "crm_full"
    campaign_report = "campaign_report"


class ExportRequest(BaseModel):
    export_type: ExportType
    filters: dict | None = None
    format: str = Field(default="csv", pattern="^(csv|json)$")


class ExportResponse(BaseModel):
    id: uuid.UUID
    export_type: str
    status: str
    file_url: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    record_count: int | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExportListResponse(BaseModel):
    id: uuid.UUID
    export_type: str
    status: str
    file_name: str | None = None
    record_count: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CRMRecordCreate(BaseModel):
    record_type: str = Field(..., pattern="^(account|contact|activity)$")
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    campaign_id: uuid.UUID | None = None
    data: dict


class CRMRecordResponse(BaseModel):
    id: uuid.UUID
    record_type: str
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    campaign_id: uuid.UUID | None = None
    data: dict
    export_status: str
    exported_at: datetime | None = None
    export_format: str
    file_url: str | None = None
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
