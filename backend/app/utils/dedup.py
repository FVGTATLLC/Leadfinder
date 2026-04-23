from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company


def normalize_domain(domain: str) -> str:
    """
    Normalize a domain string for deduplication.

    Strips protocol, www prefix, trailing slashes, and lowercases.
    Examples:
        "https://www.example.com/" -> "example.com"
        "WWW.Example.COM" -> "example.com"
        "http://example.com/path" -> "example.com"
    """
    if not domain:
        return ""

    cleaned = domain.strip().lower()

    if "://" in cleaned:
        parsed = urlparse(cleaned)
        cleaned = parsed.netloc or parsed.path
    elif cleaned.startswith("//"):
        cleaned = cleaned[2:]

    cleaned = cleaned.split("/")[0]
    cleaned = cleaned.split("?")[0]
    cleaned = cleaned.split("#")[0]

    if cleaned.startswith("www."):
        cleaned = cleaned[4:]

    cleaned = cleaned.rstrip(".")

    return cleaned


async def find_duplicates(db: AsyncSession, domain: str) -> list[Company]:
    """Find existing companies with the same normalized domain."""
    normalized = normalize_domain(domain)
    if not normalized:
        return []

    stmt = (
        select(Company)
        .where(
            Company.is_deleted.is_(False),
            Company.domain.isnot(None),
        )
    )
    result = await db.execute(stmt)
    companies = result.scalars().all()

    duplicates = []
    for company in companies:
        if company.domain and normalize_domain(company.domain) == normalized:
            duplicates.append(company)

    return duplicates


def merge_company_data(existing: Company, new_data: dict) -> dict:
    """
    Merge new data into an existing company, preferring non-null values.

    Returns a dict of fields that should be updated on the existing company.
    Only includes fields where the existing value is None and the new value is not None,
    or where both have values and the new value is preferred for specific fields.
    """
    mergeable_fields = [
        "name",
        "domain",
        "industry",
        "sub_industry",
        "geography",
        "city",
        "country",
        "employee_count",
        "revenue_range",
        "travel_intensity",
        "linkedin_url",
        "website",
        "source",
    ]

    updates: dict = {}

    for field in mergeable_fields:
        new_value = new_data.get(field)
        if new_value is None:
            continue

        existing_value = getattr(existing, field, None)

        if existing_value is None:
            updates[field] = new_value

    return updates
