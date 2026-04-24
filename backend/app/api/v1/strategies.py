import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.company import CompanyListResponse
from app.schemas.strategy import (
    StrategyCreate,
    StrategyListResponse,
    StrategyResponse,
    StrategyUpdate,
)
from app.services import strategy_service
from app.schemas.user import TokenPayload
from app.utils.pagination import PaginatedResponse, PaginationParams

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategies", tags=["strategies"])


class AddCompaniesRequest(BaseModel):
    company_ids: list[uuid.UUID]


class AddCompaniesResponse(BaseModel):
    added: int


class DiscoverRequest(BaseModel):
    pass


class DiscoverResponse(BaseModel):
    status: str = "completed"
    companies_found: int = 0
    companies_added: int = 0
    by_category: dict[str, int] | None = None
    error: str | None = None


class DiscoverMapsRequest(BaseModel):
    search_terms: list[str]
    location_query: str | None = None
    max_per_search: int = 50
    language: str = "en"
    category_filters: list[str] | None = None
    country_code: str | None = None
    city: str | None = None
    state: str | None = None
    skip_closed: bool = True


@router.get("", response_model=PaginatedResponse[StrategyListResponse])
async def list_strategies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    team_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await strategy_service.list_strategies(
        db,
        team_id=team_id,
        status=status,
        pagination=params,
        user_id=current_user.sub,
        user_role=current_user.role,
    )
    return result


@router.post("", response_model=StrategyResponse, status_code=201)
async def create_strategy(
    data: StrategyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> StrategyResponse:
    strategy = await strategy_service.create_strategy(
        db, uuid.UUID(current_user.sub), data
    )
    return StrategyResponse.model_validate(strategy)


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(
    strategy_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> StrategyResponse:
    strategy = await strategy_service.get_strategy(db, strategy_id)
    return StrategyResponse.model_validate(strategy)


@router.patch("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: uuid.UUID,
    data: StrategyUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> StrategyResponse:
    strategy = await strategy_service.update_strategy(db, strategy_id, data)
    return StrategyResponse.model_validate(strategy)


@router.delete("/{strategy_id}", status_code=204)
async def delete_strategy(
    strategy_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await strategy_service.delete_strategy(db, strategy_id)


@router.post("/{strategy_id}/discover", response_model=DiscoverResponse)
async def trigger_discovery(
    strategy_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    size_category: str = Query(
        default="all",
        description="Size category: 'all' (discovers Large+SME+Small, ~60 companies), 'large', 'sme', or 'small'",
    ),
) -> DiscoverResponse:
    """Run company discovery synchronously using the DiscoveryAgent.

    Use size_category='all' to discover across Large Enterprises, SMEs, and Small Businesses
    (up to 60 companies total). Or specify a single category for ~20 companies.
    """
    from app.agents.discovery_agent import DiscoveryAgent
    from app.agents.llm.router import LLMRouter
    from app.models.company import Company

    strategy = await strategy_service.get_strategy(db, strategy_id)
    filters = strategy.filters or {}

    try:
        llm_router = LLMRouter()
        agent = DiscoveryAgent(llm_router=llm_router, db_session=db)
        result = await agent.execute({
            "filters": filters,
            "size_category": size_category,
            "user_id": current_user.sub,
        })

        if not result.success:
            return DiscoverResponse(
                status="failed",
                companies_found=0,
                companies_added=0,
                error=result.error or "Discovery agent failed",
            )

        discovered = result.data.get("companies", [])
        added_count = 0
        added_ids_set: set[uuid.UUID] = set()
        added_ids: list[uuid.UUID] = []
        seen_domains: set[str] = set()
        rejected_count = 0

        # Verify domains via HTTP probe (DNS doesn't work reliably in Cloud Run)
        import asyncio
        import httpx

        async def _verify_domain_http(client: httpx.AsyncClient, dom: str) -> bool:
            clean = dom.lower().replace("https://", "").replace("http://", "").rstrip("/")
            if not clean or "." not in clean:
                return False
            for scheme in ("https", "http"):
                try:
                    resp = await client.get(f"{scheme}://{clean}", follow_redirects=False, timeout=6.0)
                    if resp.status_code:
                        return True
                except (httpx.ConnectError, httpx.ConnectTimeout):
                    continue
                except Exception:
                    return True  # SSL/other errors mean domain exists
            return False

        verify_client = httpx.AsyncClient(
            verify=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SalesPilot-Verifier/1.0)"},
        )

        for comp in discovered:
            # Check if company already exists by domain
            domain = comp.get("domain")

            # Skip if we already processed this domain in this batch
            if domain and domain.lower() in seen_domains:
                continue
            if domain:
                seen_domains.add(domain.lower())

                # Verify the domain actually exists via HTTP probe
                try:
                    exists = await _verify_domain_http(verify_client, domain)
                    if not exists:
                        logger.info(
                            "Skipping AI-hallucinated domain: %s (company: %s)",
                            domain, comp.get("name"),
                        )
                        rejected_count += 1
                        continue
                except Exception:
                    pass  # If check fails, let it through

            existing = None
            if domain:
                from sqlalchemy import select
                stmt = select(Company).where(
                    Company.domain == domain,
                    Company.is_deleted.is_(False),
                )
                res = await db.execute(stmt)
                existing = res.scalar_one_or_none()

            if existing:
                if existing.id not in added_ids_set:
                    added_ids_set.add(existing.id)
                    added_ids.append(existing.id)
            else:
                new_company = Company(
                    name=comp.get("name", "Unknown"),
                    domain=domain,
                    industry=comp.get("industry"),
                    city=comp.get("city"),
                    geography=comp.get("geography"),
                    employee_count=comp.get("employee_count"),
                    revenue_range=comp.get("revenue_range"),
                    travel_intensity=comp.get("travel_intensity"),
                    company_size=comp.get("company_size"),
                    source="ai_discovery",
                    created_by=uuid.UUID(current_user.sub),
                )
                db.add(new_company)
                await db.flush()
                if new_company.id not in added_ids_set:
                    added_ids_set.add(new_company.id)
                    added_ids.append(new_company.id)
                added_count += 1

        # Close the verification client
        try:
            await verify_client.aclose()
        except Exception:
            pass

        # Link all discovered companies to the strategy
        if added_ids:
            link_count = await strategy_service.add_companies_to_strategy(
                db, strategy_id, added_ids
            )

        await db.commit()

        # Build category counts
        category_counts = {}
        by_cat = result.data.get("by_category", {})
        for cat, comps in by_cat.items():
            category_counts[cat] = len(comps)

        return DiscoverResponse(
            status="completed",
            companies_found=len(discovered),
            companies_added=added_count,
            by_category=category_counts if category_counts else None,
        )

    except Exception as e:
        logger.error("Discovery failed for strategy %s: %s", strategy_id, str(e))
        await db.rollback()
        return DiscoverResponse(
            status="failed",
            companies_found=0,
            companies_added=0,
            error=str(e),
        )


@router.get(
    "/{strategy_id}/companies",
    response_model=PaginatedResponse[CompanyListResponse],
)
async def get_strategy_companies(
    strategy_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await strategy_service.get_strategy_companies(
        db, strategy_id, pagination=params
    )
    return result


@router.post(
    "/{strategy_id}/companies",
    response_model=AddCompaniesResponse,
    status_code=201,
)
async def add_companies_to_strategy(
    strategy_id: uuid.UUID,
    body: AddCompaniesRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> AddCompaniesResponse:
    count = await strategy_service.add_companies_to_strategy(
        db, strategy_id, body.company_ids
    )
    return AddCompaniesResponse(added=count)


@router.delete("/{strategy_id}/companies/{company_id}", status_code=204)
async def remove_company_from_strategy(
    strategy_id: uuid.UUID,
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await strategy_service.remove_company_from_strategy(
        db, strategy_id, company_id
    )


@router.post("/{strategy_id}/discover-maps", response_model=DiscoverResponse)
async def discover_via_google_maps(
    strategy_id: uuid.UUID,
    body: DiscoverMapsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> DiscoverResponse:
    """Discover companies by scraping Google Maps via Apify, then link them
    to the strategy. Places without a website are still saved using a synthetic
    domain (placeId) so follow-up enrichment can find them."""
    import httpx
    from sqlalchemy import select

    from app.models.company import Company
    from app.services.apify_scraper import map_place_to_company, scrape_google_maps

    strategy = await strategy_service.get_strategy(db, strategy_id)
    if strategy is None:
        return DiscoverResponse(status="failed", error="Strategy not found")

    try:
        places = await scrape_google_maps(
            search_terms=body.search_terms,
            location_query=body.location_query,
            max_per_search=body.max_per_search,
            language=body.language,
            category_filters=body.category_filters,
            country_code=body.country_code,
            city=body.city,
            state=body.state,
            skip_closed=body.skip_closed,
            scrape_contacts=False,
        )
    except RuntimeError as exc:
        return DiscoverResponse(status="failed", error=str(exc))
    except httpx.HTTPError as exc:
        logger.exception("Apify call failed for strategy %s", strategy_id)
        return DiscoverResponse(status="failed", error=f"Apify error: {exc!s}")

    added_count = 0
    added_ids: list[uuid.UUID] = []
    seen_domains: set[str] = set()
    user_uuid = uuid.UUID(current_user.sub)

    for place in places:
        mapped = map_place_to_company(place)
        domain = mapped.get("domain")
        # Fallback identifier for places without websites (place_id from Google)
        if not domain:
            place_id = (mapped.get("score_breakdown") or {}).get("place_id")
            if place_id:
                domain = f"gmaps-{place_id}"
                mapped["domain"] = domain
        if not domain or domain in seen_domains:
            continue
        seen_domains.add(domain)

        stmt = select(Company).where(
            Company.domain == domain, Company.is_deleted.is_(False)
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            if existing.id not in added_ids:
                added_ids.append(existing.id)
            continue

        new_company = Company(created_by=user_uuid, **mapped)
        db.add(new_company)
        await db.flush()
        added_ids.append(new_company.id)
        added_count += 1

    if added_ids:
        await strategy_service.add_companies_to_strategy(db, strategy_id, added_ids)

    await db.commit()
    return DiscoverResponse(
        status="completed",
        companies_found=len(places),
        companies_added=added_count,
    )
