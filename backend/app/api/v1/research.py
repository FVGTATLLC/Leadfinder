import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.research import (
    ResearchBriefListResponse,
    ResearchBriefResponse,
)
from app.schemas.user import TokenPayload
from app.services import research_service
from app.utils.pagination import PaginatedResponse, PaginationParams

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/research", tags=["research"])


class ResearchTaskResponse(BaseModel):
    status: str = "completed"
    brief_id: str | None = None
    error: str | None = None


@router.get(
    "/company/{company_id}",
    response_model=ResearchBriefResponse | None,
)
async def get_company_research(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    brief_type: str = Query(default="company_summary"),
) -> ResearchBriefResponse | None:
    brief = await research_service.get_research_brief(
        db,
        company_id=company_id,
        brief_type=brief_type,
    )
    if brief is None:
        return None
    return ResearchBriefResponse.from_brief(brief)


@router.post(
    "/company/{company_id}",
    response_model=ResearchTaskResponse,
)
async def generate_company_research(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ResearchTaskResponse:
    """Generate company research synchronously using the Research Agent."""
    try:
        brief = await research_service.generate_company_research(
            db, company_id, uuid.UUID(current_user.sub)
        )
        await db.commit()
        return ResearchTaskResponse(
            status="completed",
            brief_id=str(brief.id),
        )
    except Exception as e:
        logger.error("Research generation failed for company %s: %s", company_id, str(e))
        await db.rollback()
        return ResearchTaskResponse(
            status="failed",
            error=str(e),
        )


@router.get(
    "/contact/{contact_id}",
    response_model=ResearchBriefResponse | None,
)
async def get_contact_research(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    brief_type: str = Query(default="prospect_summary"),
) -> ResearchBriefResponse | None:
    brief = await research_service.get_research_brief(
        db,
        contact_id=contact_id,
        brief_type=brief_type,
    )
    if brief is None:
        return None
    return ResearchBriefResponse.from_brief(brief)


@router.post(
    "/contact/{contact_id}",
    response_model=ResearchTaskResponse,
)
async def generate_contact_research(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ResearchTaskResponse:
    """Generate contact research synchronously using the Research Agent."""
    try:
        brief = await research_service.generate_contact_research(
            db, contact_id, uuid.UUID(current_user.sub)
        )
        await db.commit()
        return ResearchTaskResponse(
            status="completed",
            brief_id=str(brief.id),
        )
    except Exception as e:
        logger.error("Research generation failed for contact %s: %s", contact_id, str(e))
        await db.rollback()
        return ResearchTaskResponse(
            status="failed",
            error=str(e),
        )


@router.get(
    "",
    response_model=PaginatedResponse[ResearchBriefListResponse],
)
async def list_research_briefs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    company_id: uuid.UUID | None = Query(default=None),
    contact_id: uuid.UUID | None = Query(default=None),
    brief_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    generated_by: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await research_service.list_research_briefs(
        db,
        company_id=company_id,
        contact_id=contact_id,
        brief_type=brief_type,
        search=search,
        generated_by=generated_by,
        pagination=params,
    )
    return result


@router.post(
    "/{brief_id}/regenerate",
    response_model=ResearchTaskResponse,
)
async def regenerate_research_brief(
    brief_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ResearchTaskResponse:
    """Regenerate an existing research brief synchronously."""
    brief = await research_service.get_research_brief_by_id(db, brief_id)
    if brief is None:
        from app.exceptions import NotFoundError
        raise NotFoundError("Research brief not found")

    try:
        if brief.company_id:
            new_brief = await research_service.generate_company_research(
                db, brief.company_id, uuid.UUID(current_user.sub)
            )
        elif brief.contact_id:
            new_brief = await research_service.generate_contact_research(
                db, brief.contact_id, uuid.UUID(current_user.sub)
            )
        else:
            return ResearchTaskResponse(status="failed", error="No company or contact linked")

        await db.commit()
        return ResearchTaskResponse(
            status="completed",
            brief_id=str(new_brief.id),
        )
    except Exception as e:
        logger.error("Research regeneration failed for brief %s: %s", brief_id, str(e))
        await db.rollback()
        return ResearchTaskResponse(
            status="failed",
            error=str(e),
        )
