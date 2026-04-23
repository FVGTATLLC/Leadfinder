import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.company import Company
from app.schemas.company import (
    CompanyCreate,
    CompanyListResponse,
    CompanyResponse,
    CompanyScoreResponse,
    CompanyUpdate,
)
from app.utils.dedup import find_duplicates, merge_company_data, normalize_domain
from app.utils.pagination import PaginationParams, paginate
from app.utils.scoring import score_company_against_icp


async def create_company(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: CompanyCreate,
) -> Company:
    if data.domain:
        normalized = normalize_domain(data.domain)
        existing = await find_duplicates(db, normalized)
        if existing:
            raise ConflictError(
                f"Company with domain '{data.domain}' already exists"
            )

    company = Company(
        name=data.name,
        domain=normalize_domain(data.domain) if data.domain else None,
        industry=data.industry,
        sub_industry=data.sub_industry,
        geography=data.geography,
        city=data.city,
        country=data.country,
        employee_count=data.employee_count,
        revenue_range=data.revenue_range,
        travel_intensity=data.travel_intensity,
        linkedin_url=data.linkedin_url,
        website=data.website,
        source=data.source,
        created_by=user_id,
    )
    db.add(company)
    await db.flush()
    await db.refresh(company)
    return company


async def get_company(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> Company:
    stmt = select(Company).where(
        Company.id == company_id,
        Company.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    if company is None:
        raise NotFoundError(f"Company with id '{company_id}' not found")
    return company


async def list_companies(
    db: AsyncSession,
    filters: dict | None = None,
    search: str | None = None,
    pagination: PaginationParams | None = None,
    user_id: uuid.UUID | str | None = None,
    user_role: str | None = None,
) -> dict:
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Company)
        .where(Company.is_deleted.is_(False))
        .order_by(Company.created_at.desc())
    )

    # Non-admin users only see their own companies
    if user_role and user_role != "admin" and user_id:
        query = query.where(Company.created_by == user_id)

    if filters:
        if filters.get("industry"):
            query = query.where(Company.industry == filters["industry"])
        if filters.get("geography"):
            query = query.where(Company.geography == filters["geography"])
        if filters.get("revenue_range"):
            query = query.where(Company.revenue_range == filters["revenue_range"])
        if filters.get("employee_min") is not None:
            query = query.where(Company.employee_count >= filters["employee_min"])
        if filters.get("employee_max") is not None:
            query = query.where(Company.employee_count <= filters["employee_max"])
        if filters.get("travel_intensity"):
            query = query.where(
                Company.travel_intensity == filters["travel_intensity"]
            )
        if filters.get("source"):
            query = query.where(Company.source == filters["source"])

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Company.name.ilike(search_term),
                Company.domain.ilike(search_term),
            )
        )

    result = await paginate(db, query, pagination)
    result["items"] = [CompanyListResponse.model_validate(c) for c in result["items"]]
    return result


async def update_company(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: CompanyUpdate,
) -> Company:
    company = await get_company(db, company_id)

    update_data = data.model_dump(exclude_unset=True)

    if "domain" in update_data and update_data["domain"] is not None:
        normalized = normalize_domain(update_data["domain"])
        duplicates = await find_duplicates(db, normalized)
        duplicates = [d for d in duplicates if d.id != company_id]
        if duplicates:
            raise ConflictError(
                f"Company with domain '{update_data['domain']}' already exists"
            )
        update_data["domain"] = normalized

    for field, value in update_data.items():
        setattr(company, field, value)

    await db.flush()
    await db.refresh(company)
    return company


async def delete_company(
    db: AsyncSession,
    company_id: uuid.UUID,
) -> None:
    company = await get_company(db, company_id)
    company.is_deleted = True
    await db.flush()


async def import_companies(
    db: AsyncSession,
    user_id: uuid.UUID,
    companies: list[CompanyCreate],
) -> dict:
    created = 0
    skipped = 0
    duplicates = 0

    for company_data in companies:
        if company_data.domain:
            normalized = normalize_domain(company_data.domain)
            existing = await find_duplicates(db, normalized)
            if existing:
                merged_updates = merge_company_data(
                    existing[0], company_data.model_dump()
                )
                if merged_updates:
                    for field, value in merged_updates.items():
                        setattr(existing[0], field, value)
                duplicates += 1
                continue

        try:
            company = Company(
                name=company_data.name,
                domain=normalize_domain(company_data.domain) if company_data.domain else None,
                industry=company_data.industry,
                sub_industry=company_data.sub_industry,
                geography=company_data.geography,
                city=company_data.city,
                country=company_data.country,
                employee_count=company_data.employee_count,
                revenue_range=company_data.revenue_range,
                travel_intensity=company_data.travel_intensity,
                linkedin_url=company_data.linkedin_url,
                website=company_data.website,
                source=company_data.source or "import",
                created_by=user_id,
            )
            db.add(company)
            await db.flush()
            created += 1
        except Exception:
            skipped += 1

    return {
        "created": created,
        "skipped": skipped,
        "duplicates": duplicates,
    }


async def score_company(
    db: AsyncSession,
    company_id: uuid.UUID,
    strategy_filters: dict,
) -> Company:
    company = await get_company(db, company_id)

    company_data = {
        "industry": company.industry,
        "employee_count": company.employee_count,
        "revenue_range": company.revenue_range,
        "geography": company.geography,
        "travel_intensity": company.travel_intensity,
    }

    result = score_company_against_icp(company_data, strategy_filters)

    company.icp_score = result["score"] / 100.0
    company.score_breakdown = result["breakdown"]

    await db.flush()
    await db.refresh(company)
    return company


async def bulk_score_companies(
    db: AsyncSession,
    company_ids: list[uuid.UUID],
    strategy_filters: dict,
) -> list[Company]:
    scored = []
    for company_id in company_ids:
        try:
            company = await score_company(db, company_id, strategy_filters)
            scored.append(company)
        except NotFoundError:
            continue
    return scored
