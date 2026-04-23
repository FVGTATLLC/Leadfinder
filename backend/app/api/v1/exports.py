import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.crm_record import CRMRecord
from app.schemas.export import (
    CRMRecordCreate,
    CRMRecordResponse,
    ExportListResponse,
    ExportRequest,
    ExportResponse,
)
from app.schemas.user import TokenPayload
from app.services import export_service
from app.tasks.export_tasks import process_export_task
from app.utils.pagination import PaginatedResponse, PaginationParams, paginate

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("", response_model=ExportResponse, status_code=202)
async def create_export(
    data: ExportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ExportResponse:
    """Create an export job and trigger background processing."""
    user_id = uuid.UUID(current_user.sub)
    job = await export_service.create_export_job(db, user_id, data)

    # Trigger Celery task
    process_export_task.delay(str(job.id))

    return ExportResponse.model_validate(job)


@router.get("", response_model=PaginatedResponse[ExportListResponse])
async def list_exports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    """List the current user's export jobs."""
    user_id = uuid.UUID(current_user.sub)
    params = PaginationParams(page=page, per_page=per_page)
    result = await export_service.list_export_jobs(db, user_id, params)
    result["items"] = [
        ExportListResponse.model_validate(j) for j in result["items"]
    ]
    return result


@router.get("/crm-records", response_model=PaginatedResponse[CRMRecordResponse])
async def list_crm_records(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    record_type: str | None = Query(default=None),
    export_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    """List CRM records with optional filters."""
    from sqlalchemy import select

    query = (
        select(CRMRecord)
        .where(CRMRecord.is_deleted.is_(False))
        .order_by(CRMRecord.created_at.desc())
    )

    if record_type:
        query = query.where(CRMRecord.record_type == record_type)
    if export_status:
        query = query.where(CRMRecord.export_status == export_status)

    params = PaginationParams(page=page, per_page=per_page)
    result = await paginate(db, query, params)
    result["items"] = [
        CRMRecordResponse.model_validate(r) for r in result["items"]
    ]
    return result


@router.post("/crm-records", response_model=CRMRecordResponse, status_code=201)
async def create_crm_record(
    data: CRMRecordCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CRMRecordResponse:
    """Create a CRM record manually."""
    user_id = uuid.UUID(current_user.sub)
    record = CRMRecord(
        record_type=data.record_type,
        company_id=data.company_id,
        contact_id=data.contact_id,
        campaign_id=data.campaign_id,
        data=data.data,
        created_by=user_id,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return CRMRecordResponse.model_validate(record)


@router.get("/{export_id}", response_model=ExportResponse)
async def get_export(
    export_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ExportResponse:
    """Get export job details."""
    job = await export_service.get_export_job(db, export_id)
    return ExportResponse.model_validate(job)


@router.get("/{export_id}/download")
async def download_export(
    export_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> Response:
    """Redirect to export file URL or return file info."""
    job = await export_service.get_export_job(db, export_id)

    if job.status != "completed":
        return JSONResponse({
            "status": job.status,
            "message": f"Export is {job.status}. Please wait for completion.",
        })

    if job.file_url:
        if job.file_url.startswith("file://"):
            # Local file - return info instead of redirect
            return JSONResponse({
                "status": "completed",
                "file_url": job.file_url,
                "file_name": job.file_name,
                "file_size": job.file_size,
                "record_count": job.record_count,
            })
        return RedirectResponse(url=job.file_url)

    return JSONResponse({"status": "completed", "message": "No file URL available"})
