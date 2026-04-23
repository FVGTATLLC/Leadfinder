import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.company import Company
from app.models.strategy import Strategy, StrategyCompany
from app.schemas.strategy import StrategyCreate, StrategyListResponse, StrategyResponse, StrategyUpdate
from app.schemas.company import CompanyListResponse
from app.utils.pagination import PaginatedResponse, PaginationParams, paginate


async def create_strategy(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: StrategyCreate,
) -> Strategy:
    strategy = Strategy(
        name=data.name,
        description=data.description,
        filters=data.filters.model_dump(),
        team_id=data.team_id,
        created_by=user_id,
        status="draft",
        company_count=0,
    )
    db.add(strategy)
    await db.flush()
    await db.refresh(strategy)
    return strategy


async def get_strategy(
    db: AsyncSession,
    strategy_id: uuid.UUID,
) -> Strategy:
    stmt = select(Strategy).where(
        Strategy.id == strategy_id,
        Strategy.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise NotFoundError(f"Strategy with id '{strategy_id}' not found")
    return strategy


async def list_strategies(
    db: AsyncSession,
    team_id: uuid.UUID | None = None,
    status: str | None = None,
    pagination: PaginationParams | None = None,
    user_id: uuid.UUID | str | None = None,
    user_role: str | None = None,
) -> dict:
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Strategy)
        .where(Strategy.is_deleted.is_(False))
        .order_by(Strategy.created_at.desc())
    )

    # Non-admin users only see their own strategies
    if user_role and user_role != "admin" and user_id:
        query = query.where(Strategy.created_by == user_id)

    if team_id is not None:
        query = query.where(Strategy.team_id == team_id)
    if status is not None:
        query = query.where(Strategy.status == status)

    result = await paginate(db, query, pagination)
    result["items"] = [StrategyListResponse.model_validate(s) for s in result["items"]]
    return result


async def update_strategy(
    db: AsyncSession,
    strategy_id: uuid.UUID,
    data: StrategyUpdate,
) -> Strategy:
    strategy = await get_strategy(db, strategy_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "filters" and value is not None:
            setattr(strategy, field, value if isinstance(value, dict) else data.filters.model_dump())
        elif field == "status" and value is not None:
            setattr(strategy, field, value.value if hasattr(value, "value") else value)
        else:
            setattr(strategy, field, value)

    await db.flush()
    await db.refresh(strategy)
    return strategy


async def delete_strategy(
    db: AsyncSession,
    strategy_id: uuid.UUID,
) -> None:
    strategy = await get_strategy(db, strategy_id)
    strategy.is_deleted = True
    await db.flush()


async def add_companies_to_strategy(
    db: AsyncSession,
    strategy_id: uuid.UUID,
    company_ids: list[uuid.UUID],
) -> int:
    strategy = await get_strategy(db, strategy_id)

    # Check ALL existing links (including soft-deleted ones) to avoid unique constraint violations
    existing_stmt = select(StrategyCompany).where(
        StrategyCompany.strategy_id == strategy_id,
    )
    existing_result = await db.execute(existing_stmt)
    existing_map = {sc.company_id: sc for sc in existing_result.scalars().all()}

    added_count = 0
    for company_id in company_ids:
        existing_sc = existing_map.get(company_id)
        if existing_sc is not None:
            if existing_sc.is_deleted:
                # Reactivate soft-deleted link
                existing_sc.is_deleted = False
                added_count += 1
            # Already linked and not deleted — skip
            continue

        company_stmt = select(Company).where(
            Company.id == company_id,
            Company.is_deleted.is_(False),
        )
        company_result = await db.execute(company_stmt)
        company = company_result.scalar_one_or_none()
        if company is None:
            continue

        sc = StrategyCompany(
            strategy_id=strategy_id,
            company_id=company_id,
        )
        db.add(sc)
        added_count += 1

    if added_count > 0:
        strategy.company_count = strategy.company_count + added_count
        await db.flush()

    return added_count


async def remove_company_from_strategy(
    db: AsyncSession,
    strategy_id: uuid.UUID,
    company_id: uuid.UUID,
) -> None:
    strategy = await get_strategy(db, strategy_id)

    stmt = select(StrategyCompany).where(
        StrategyCompany.strategy_id == strategy_id,
        StrategyCompany.company_id == company_id,
        StrategyCompany.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    sc = result.scalar_one_or_none()
    if sc is None:
        raise NotFoundError(
            f"Company '{company_id}' not found in strategy '{strategy_id}'"
        )

    sc.is_deleted = True
    strategy.company_count = max(0, strategy.company_count - 1)
    await db.flush()


async def get_strategy_companies(
    db: AsyncSession,
    strategy_id: uuid.UUID,
    pagination: PaginationParams | None = None,
) -> dict:
    await get_strategy(db, strategy_id)

    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Company)
        .join(StrategyCompany, StrategyCompany.company_id == Company.id)
        .where(
            StrategyCompany.strategy_id == strategy_id,
            StrategyCompany.is_deleted.is_(False),
            Company.is_deleted.is_(False),
        )
        .order_by(Company.created_at.desc())
    )

    result = await paginate(db, query, pagination)
    result["items"] = [CompanyListResponse.model_validate(c) for c in result["items"]]
    return result
