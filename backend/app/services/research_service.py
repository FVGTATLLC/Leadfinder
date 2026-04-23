import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.models.research_brief import ResearchBrief
from app.schemas.research import ResearchBriefListResponse
from app.utils.pagination import PaginationParams, paginate


async def get_research_brief(
    db: AsyncSession,
    company_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    brief_type: str | None = None,
) -> ResearchBrief | None:
    """Get the most recent research brief matching the given criteria."""
    query = (
        select(ResearchBrief)
        .where(ResearchBrief.is_deleted.is_(False))
        .order_by(ResearchBrief.created_at.desc())
    )

    if company_id:
        query = query.where(ResearchBrief.company_id == company_id)
    if contact_id:
        query = query.where(ResearchBrief.contact_id == contact_id)
    if brief_type:
        query = query.where(ResearchBrief.brief_type == brief_type)

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_research_brief(
    db: AsyncSession,
    data: dict,
) -> ResearchBrief:
    """Create a new research brief from a data dict."""
    brief = ResearchBrief(
        company_id=data.get("company_id"),
        contact_id=data.get("contact_id"),
        brief_type=data["brief_type"],
        content=data["content"],
        sources=data.get("sources"),
        generated_by=data.get("generated_by", "research_agent"),
        llm_model_used=data.get("llm_model_used"),
        expires_at=data.get("expires_at"),
    )
    db.add(brief)
    await db.flush()
    await db.refresh(brief)
    return brief


async def generate_company_research(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ResearchBrief:
    """Generate a company research brief using the Research Agent."""
    from app.agents.llm.router import LLMRouter
    from app.agents.research_agent import ResearchAgent
    from app.services.company_service import get_company

    company = await get_company(db, company_id)

    company_data = {
        "name": company.name,
        "industry": company.industry,
        "sub_industry": company.sub_industry,
        "employee_count": company.employee_count,
        "geography": company.geography,
        "country": company.country,
        "domain": company.domain,
        "revenue_range": company.revenue_range,
        "travel_intensity": company.travel_intensity,
    }

    llm_router = LLMRouter()
    agent = ResearchAgent(llm_router=llm_router, db_session=db)

    result = await agent.execute({
        "company_data": company_data,
        "brief_type": "company_summary",
        "user_id": user_id,
    })

    if not result.success:
        raise RuntimeError(f"Research agent failed: {result.error}")

    content = result.data.get("content", {})

    brief = await create_research_brief(db, {
        "company_id": company_id,
        "brief_type": "company_summary",
        "content": content,
        "sources": None,
        "generated_by": "research_agent",
        "llm_model_used": result.model_used,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
    })

    return brief


async def generate_contact_research(
    db: AsyncSession,
    contact_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ResearchBrief:
    """Generate a contact/prospect research brief using the Research Agent."""
    from app.agents.llm.router import LLMRouter
    from app.agents.research_agent import ResearchAgent
    from app.services.company_service import get_company
    from app.services.contact_service import get_contact

    contact = await get_contact(db, contact_id)

    company_data = {}
    if contact.company_id:
        company = await get_company(db, contact.company_id)
        company_data = {
            "name": company.name,
            "industry": company.industry,
            "sub_industry": company.sub_industry,
            "employee_count": company.employee_count,
            "geography": company.geography,
            "country": company.country,
            "domain": company.domain,
            "revenue_range": company.revenue_range,
            "travel_intensity": company.travel_intensity,
        }

    contact_data = {
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "job_title": contact.job_title,
        "persona_type": contact.persona_type,
        "linkedin_url": contact.linkedin_url,
        "email": contact.email,
    }

    llm_router = LLMRouter()
    agent = ResearchAgent(llm_router=llm_router, db_session=db)

    result = await agent.execute({
        "company_data": company_data,
        "contact_data": contact_data,
        "brief_type": "prospect_summary",
        "user_id": user_id,
    })

    if not result.success:
        raise RuntimeError(f"Research agent failed: {result.error}")

    content = result.data.get("content", {})

    brief = await create_research_brief(db, {
        "company_id": contact.company_id,
        "contact_id": contact_id,
        "brief_type": "prospect_summary",
        "content": content,
        "sources": None,
        "generated_by": "research_agent",
        "llm_model_used": result.model_used,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
    })

    return brief


async def get_research_brief_by_id(
    db: AsyncSession,
    brief_id: uuid.UUID,
) -> ResearchBrief | None:
    """Get a research brief by its ID."""
    query = select(ResearchBrief).where(
        ResearchBrief.id == brief_id,
        ResearchBrief.is_deleted.is_(False),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_research_briefs(
    db: AsyncSession,
    company_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    brief_type: str | None = None,
    search: str | None = None,
    generated_by: str | None = None,
    pagination: PaginationParams | None = None,
) -> dict:
    """List research briefs with optional filters and pagination."""
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(ResearchBrief)
        .where(ResearchBrief.is_deleted.is_(False))
        .order_by(ResearchBrief.created_at.desc())
    )

    if company_id:
        query = query.where(ResearchBrief.company_id == company_id)
    if contact_id:
        query = query.where(ResearchBrief.contact_id == contact_id)
    if brief_type:
        query = query.where(ResearchBrief.brief_type == brief_type)
    if generated_by:
        query = query.where(ResearchBrief.generated_by.ilike(f"%{generated_by}%"))

    result = await paginate(db, query, pagination)
    result["items"] = [
        ResearchBriefListResponse.from_brief(b) for b in result["items"]
    ]
    return result


def is_brief_expired(brief: ResearchBrief) -> bool:
    """Check whether a research brief has expired."""
    if brief.expires_at is None:
        return False
    now = datetime.now(timezone.utc)
    expires = brief.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return now > expires
