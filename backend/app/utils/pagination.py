from dataclasses import dataclass
from math import ceil
from typing import Any, Generic, Sequence, TypeVar

from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


@dataclass
class PaginationParams:
    page: int = 1
    per_page: int = 20

    def __post_init__(self) -> None:
        if self.page < 1:
            self.page = 1
        if self.per_page < 1:
            self.per_page = 1
        if self.per_page > 300:
            self.per_page = 300

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int


async def paginate(
    db: AsyncSession,
    query: Select[Any],
    params: PaginationParams,
) -> dict[str, Any]:
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    paginated_query = query.offset(params.offset).limit(params.per_page)
    result = await db.execute(paginated_query)
    items = list(result.scalars().all())

    pages = ceil(total / params.per_page) if params.per_page > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": params.page,
        "per_page": params.per_page,
        "pages": pages,
    }
