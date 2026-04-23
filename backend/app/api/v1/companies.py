import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.company import (
    CompanyCreate,
    CompanyImport,
    CompanyListResponse,
    CompanyResponse,
    CompanyScoreResponse,
    CompanyUpdate,
)
from app.schemas.user import TokenPayload
from app.services import company_service, strategy_service
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/companies", tags=["companies"])


class ScoreRequest(BaseModel):
    strategy_id: uuid.UUID


class ImportResponse(BaseModel):
    created: int
    skipped: int
    duplicates: int


class DeduplicateResponse(BaseModel):
    task_id: str


class CleanupResponse(BaseModel):
    checked: int
    deleted: int
    deleted_names: list[str]
    mode: str = "delete"


@router.post("/admin/cleanup-fake", response_model=CleanupResponse)
async def cleanup_fake_companies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    dry_run: bool = Query(default=True, description="If true (default), only report - don't delete"),
    mode: str = Query(default="clear_domain", description="'delete' = soft-delete companies, 'clear_domain' = just NULL out the bad domain"),
) -> CleanupResponse:
    """Soft-delete companies whose domains do not respond on HTTP/HTTPS (AI hallucinations).
    Admin only. Defaults to dry_run=true for safety."""
    import asyncio
    import httpx
    from sqlalchemy import select, update, delete
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.message_draft import MessageDraft
    from app.models.campaign import CampaignContact
    from app.models.research_brief import ResearchBrief
    from app.models.strategy import StrategyCompany

    if current_user.role != "admin":
        from app.exceptions import UnauthorizedError
        raise UnauthorizedError("Admin role required")

    stmt = select(Company).where(
        Company.is_deleted.is_(False),
        Company.domain.is_not(None),
    )
    result = await db.execute(stmt)
    companies = result.scalars().all()

    async def _check(client: httpx.AsyncClient, dom: str) -> bool:
        """Try HTTPS then HTTP. ANY response (even 4xx/5xx) means the domain exists."""
        clean = dom.lower().replace("https://", "").replace("http://", "").rstrip("/")
        if not clean or "." not in clean:
            return False
        for scheme in ("https", "http"):
            try:
                resp = await client.get(
                    f"{scheme}://{clean}",
                    follow_redirects=False,
                    timeout=8.0,
                )
                # Any HTTP response means the domain exists & responds
                if resp.status_code:
                    return True
            except (httpx.ConnectError, httpx.ConnectTimeout):
                continue
            except Exception:
                # Other errors (SSL, etc) - the domain probably exists
                return True
        return False

    bad_companies = []
    async with httpx.AsyncClient(
        verify=False,  # Don't fail on bad SSL certs
        headers={"User-Agent": "Mozilla/5.0 (compatible; SalesPilot-Verifier/1.0)"},
    ) as client:
        # Check up to 5 domains in parallel for speed
        sem = asyncio.Semaphore(5)

        async def _check_one(c: Company) -> tuple[Company, bool]:
            async with sem:
                ok = await _check(client, c.domain)
                return c, ok

        results = await asyncio.gather(
            *[_check_one(c) for c in companies if c.domain],
            return_exceptions=True,
        )

        for r in results:
            if isinstance(r, Exception):
                continue
            c, ok = r
            if not ok:
                bad_companies.append(c)

    deleted_names = [c.name for c in bad_companies]

    if not dry_run and bad_companies:
        bad_ids = [c.id for c in bad_companies]
        if mode == "delete":
            # Full soft-delete with cascade
            contact_stmt = select(Contact.id).where(Contact.company_id.in_(bad_ids))
            cres = await db.execute(contact_stmt)
            contact_ids = [r[0] for r in cres.all()]
            if contact_ids:
                await db.execute(delete(MessageDraft).where(MessageDraft.contact_id.in_(contact_ids)))
                await db.execute(delete(CampaignContact).where(CampaignContact.contact_id.in_(contact_ids)))
                await db.execute(update(Contact).where(Contact.id.in_(contact_ids)).values(is_deleted=True))
            await db.execute(delete(ResearchBrief).where(ResearchBrief.company_id.in_(bad_ids)))
            await db.execute(delete(StrategyCompany).where(StrategyCompany.company_id.in_(bad_ids)))
            await db.execute(update(Company).where(Company.id.in_(bad_ids)).values(is_deleted=True))
        else:
            # mode == "clear_domain": just NULL out the bad domain
            await db.execute(update(Company).where(Company.id.in_(bad_ids)).values(domain=None))
        await db.commit()

    return CleanupResponse(
        checked=len(companies),
        deleted=len(bad_companies) if not dry_run else 0,
        deleted_names=deleted_names,
        mode=mode,
    )
    status: str = "queued"


@router.get("", response_model=PaginatedResponse[CompanyListResponse])
async def list_companies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    search: str | None = Query(default=None),
    industry: str | None = Query(default=None),
    geography: str | None = Query(default=None),
    revenue_range: str | None = Query(default=None),
    employee_min: int | None = Query(default=None),
    employee_max: int | None = Query(default=None),
    travel_intensity: str | None = Query(default=None),
    source: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=300),
) -> dict:
    filters: dict = {}
    if industry:
        filters["industry"] = industry
    if geography:
        filters["geography"] = geography
    if revenue_range:
        filters["revenue_range"] = revenue_range
    if employee_min is not None:
        filters["employee_min"] = employee_min
    if employee_max is not None:
        filters["employee_max"] = employee_max
    if travel_intensity:
        filters["travel_intensity"] = travel_intensity
    if source:
        filters["source"] = source

    params = PaginationParams(page=page, per_page=per_page)
    result = await company_service.list_companies(
        db,
        filters=filters or None,
        search=search,
        pagination=params,
        user_id=current_user.sub,
        user_role=current_user.role,
    )
    return result


@router.post("", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CompanyResponse:
    company = await company_service.create_company(
        db, uuid.UUID(current_user.sub), data
    )
    return CompanyResponse.model_validate(company)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CompanyResponse:
    company = await company_service.get_company(db, company_id)
    return CompanyResponse.model_validate(company)


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    data: CompanyUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CompanyResponse:
    company = await company_service.update_company(db, company_id, data)
    return CompanyResponse.model_validate(company)


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await company_service.delete_company(db, company_id)


@router.post("/{company_id}/score", response_model=CompanyScoreResponse)
async def score_company(
    company_id: uuid.UUID,
    body: ScoreRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> CompanyScoreResponse:
    strategy = await strategy_service.get_strategy(db, body.strategy_id)
    company = await company_service.score_company(
        db, company_id, strategy.filters
    )
    return CompanyScoreResponse.model_validate(company)


@router.post("/import", response_model=ImportResponse)
async def import_companies(
    data: CompanyImport,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ImportResponse:
    result = await company_service.import_companies(
        db, uuid.UUID(current_user.sub), data.companies
    )
    return ImportResponse(**result)


@router.post("/deduplicate", response_model=DeduplicateResponse)
async def deduplicate_companies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> DeduplicateResponse:
    from app.tasks.celery_app import celery_app

    task = celery_app.send_task(
        "app.tasks.dedup.run_deduplication",
        kwargs={"user_id": current_user.sub},
    )
    return DeduplicateResponse(task_id=task.id, status="queued")
