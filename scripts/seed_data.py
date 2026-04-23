"""
Seed script for SalesPilot — creates sample data for local development.

Usage:
    python -m scripts.seed_data

The script is idempotent: it checks for existing data before inserting.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.campaign import Campaign, CampaignContact
from app.models.company import Company
from app.models.contact import Contact
from app.models.sequence_step import SequenceStep
from app.models.strategy import Strategy, StrategyCompany
from app.models.team import Team
from app.models.user import User
from app.services.auth_service import hash_password
from app.utils.database import get_session_factory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Fixed UUIDs for idempotent seeding
ADMIN_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
TEAM_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")

COMPANY_IDS = [uuid.UUID(f"00000000-0000-0000-0001-{i:012d}") for i in range(1, 11)]
CONTACT_IDS = [uuid.UUID(f"00000000-0000-0000-0002-{i:012d}") for i in range(1, 21)]
STRATEGY_IDS = [uuid.UUID(f"00000000-0000-0000-0003-{i:012d}") for i in range(1, 4)]
CAMPAIGN_IDS = [uuid.UUID(f"00000000-0000-0000-0004-{i:012d}") for i in range(1, 3)]


async def seed_admin_user(db: AsyncSession) -> User:
    stmt = select(User).where(User.id == ADMIN_USER_ID)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is not None:
        logger.info("Admin user already exists, skipping")
        return user

    user = User(
        id=ADMIN_USER_ID,
        email="admin@salespilot.com",
        password_hash=hash_password("admin123"),
        full_name="Admin User",
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    logger.info("Created admin user: admin@salespilot.com")
    return user


async def seed_team(db: AsyncSession, admin_user: User) -> Team:
    stmt = select(Team).where(Team.id == TEAM_ID)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if team is not None:
        logger.info("Sample team already exists, skipping")
        return team

    team = Team(
        id=TEAM_ID,
        name="Sales Team Alpha",
        description="Primary outbound sales team focused on travel industry",
        created_by=admin_user.id,
    )
    db.add(team)
    await db.flush()

    # Assign admin to team
    admin_user.team_id = TEAM_ID
    await db.flush()

    logger.info("Created team: Sales Team Alpha")
    return team


async def seed_companies(db: AsyncSession, admin_user: User) -> list[Company]:
    stmt = select(Company).where(Company.id.in_(COMPANY_IDS))
    result = await db.execute(stmt)
    existing = list(result.scalars().all())
    if len(existing) == len(COMPANY_IDS):
        logger.info("All sample companies already exist, skipping")
        return existing

    companies_data = [
        {
            "name": "TravelCorp International",
            "domain": "travelcorp.com",
            "industry": "Travel & Tourism",
            "sub_industry": "Corporate Travel",
            "geography": "North America",
            "city": "New York",
            "country": "US",
            "employee_count": 500,
            "revenue_range": "$50M-$100M",
            "travel_intensity": "high",
            "icp_score": 92.5,
            "source": "seed",
        },
        {
            "name": "GlobalHosp Group",
            "domain": "globalhosp.com",
            "industry": "Hospitality",
            "sub_industry": "Hotel Chains",
            "geography": "Europe",
            "city": "London",
            "country": "UK",
            "employee_count": 1200,
            "revenue_range": "$100M-$500M",
            "travel_intensity": "high",
            "icp_score": 88.0,
            "source": "seed",
        },
        {
            "name": "AeroLink Solutions",
            "domain": "aerolink.io",
            "industry": "Aviation",
            "sub_industry": "Airline Services",
            "geography": "Asia Pacific",
            "city": "Singapore",
            "country": "SG",
            "employee_count": 300,
            "revenue_range": "$10M-$50M",
            "travel_intensity": "high",
            "icp_score": 85.0,
            "source": "seed",
        },
        {
            "name": "MedTravel Plus",
            "domain": "medtravelplus.com",
            "industry": "Healthcare",
            "sub_industry": "Medical Tourism",
            "geography": "Middle East",
            "city": "Dubai",
            "country": "AE",
            "employee_count": 150,
            "revenue_range": "$10M-$50M",
            "travel_intensity": "medium",
            "icp_score": 78.5,
            "source": "seed",
        },
        {
            "name": "EduVoyage Inc",
            "domain": "eduvoyage.com",
            "industry": "Education",
            "sub_industry": "Study Abroad",
            "geography": "North America",
            "city": "Boston",
            "country": "US",
            "employee_count": 80,
            "revenue_range": "$5M-$10M",
            "travel_intensity": "medium",
            "icp_score": 72.0,
            "source": "seed",
        },
        {
            "name": "CruiseWave Maritime",
            "domain": "cruisewave.com",
            "industry": "Travel & Tourism",
            "sub_industry": "Cruise Lines",
            "geography": "Europe",
            "city": "Barcelona",
            "country": "ES",
            "employee_count": 2000,
            "revenue_range": "$500M+",
            "travel_intensity": "high",
            "icp_score": 95.0,
            "source": "seed",
        },
        {
            "name": "BizTrip Technologies",
            "domain": "biztrip.tech",
            "industry": "Technology",
            "sub_industry": "Travel Tech",
            "geography": "North America",
            "city": "San Francisco",
            "country": "US",
            "employee_count": 250,
            "revenue_range": "$10M-$50M",
            "travel_intensity": "medium",
            "icp_score": 80.0,
            "source": "seed",
        },
        {
            "name": "LuxeStay Resorts",
            "domain": "luxestay.com",
            "industry": "Hospitality",
            "sub_industry": "Luxury Resorts",
            "geography": "Asia Pacific",
            "city": "Bali",
            "country": "ID",
            "employee_count": 600,
            "revenue_range": "$50M-$100M",
            "travel_intensity": "high",
            "icp_score": 90.0,
            "source": "seed",
        },
        {
            "name": "EventWorld Global",
            "domain": "eventworld.co",
            "industry": "Events & Conferences",
            "sub_industry": "MICE",
            "geography": "Europe",
            "city": "Berlin",
            "country": "DE",
            "employee_count": 100,
            "revenue_range": "$5M-$10M",
            "travel_intensity": "high",
            "icp_score": 82.0,
            "source": "seed",
        },
        {
            "name": "SafariTrails Africa",
            "domain": "safaritrails.co.za",
            "industry": "Travel & Tourism",
            "sub_industry": "Adventure Travel",
            "geography": "Africa",
            "city": "Cape Town",
            "country": "ZA",
            "employee_count": 50,
            "revenue_range": "$1M-$5M",
            "travel_intensity": "high",
            "icp_score": 68.0,
            "source": "seed",
        },
    ]

    companies = []
    for i, data in enumerate(companies_data):
        company = Company(
            id=COMPANY_IDS[i],
            created_by=admin_user.id,
            **data,
        )
        db.add(company)
        companies.append(company)

    await db.flush()
    logger.info("Created %d sample companies", len(companies))
    return companies


async def seed_contacts(
    db: AsyncSession, admin_user: User, companies: list[Company]
) -> list[Contact]:
    stmt = select(Contact).where(Contact.id.in_(CONTACT_IDS))
    result = await db.execute(stmt)
    existing = list(result.scalars().all())
    if len(existing) == len(CONTACT_IDS):
        logger.info("All sample contacts already exist, skipping")
        return existing

    contacts_data = [
        {"first_name": "John", "last_name": "Smith", "job_title": "VP of Travel Operations", "persona_type": "decision_maker", "email": "john.smith@travelcorp.com", "company_idx": 0},
        {"first_name": "Sarah", "last_name": "Chen", "job_title": "Director of Procurement", "persona_type": "decision_maker", "email": "sarah.chen@travelcorp.com", "company_idx": 0},
        {"first_name": "Michael", "last_name": "Brown", "job_title": "CEO", "persona_type": "executive", "email": "m.brown@globalhosp.com", "company_idx": 1},
        {"first_name": "Emma", "last_name": "Williams", "job_title": "Head of Partnerships", "persona_type": "champion", "email": "emma.w@globalhosp.com", "company_idx": 1},
        {"first_name": "Raj", "last_name": "Patel", "job_title": "COO", "persona_type": "executive", "email": "raj@aerolink.io", "company_idx": 2},
        {"first_name": "Lisa", "last_name": "Kumar", "job_title": "Travel Manager", "persona_type": "influencer", "email": "lisa.k@aerolink.io", "company_idx": 2},
        {"first_name": "Dr. Aisha", "last_name": "Hassan", "job_title": "Medical Director", "persona_type": "decision_maker", "email": "aisha@medtravelplus.com", "company_idx": 3},
        {"first_name": "Tom", "last_name": "Anderson", "job_title": "Business Development Manager", "persona_type": "champion", "email": "tom.a@medtravelplus.com", "company_idx": 3},
        {"first_name": "Jennifer", "last_name": "Lee", "job_title": "Director of Student Services", "persona_type": "decision_maker", "email": "j.lee@eduvoyage.com", "company_idx": 4},
        {"first_name": "David", "last_name": "Garcia", "job_title": "Operations Manager", "persona_type": "influencer", "email": "d.garcia@eduvoyage.com", "company_idx": 4},
        {"first_name": "Maria", "last_name": "Santos", "job_title": "VP of Commercial", "persona_type": "executive", "email": "m.santos@cruisewave.com", "company_idx": 5},
        {"first_name": "James", "last_name": "Wilson", "job_title": "Procurement Director", "persona_type": "decision_maker", "email": "j.wilson@cruisewave.com", "company_idx": 5},
        {"first_name": "Alex", "last_name": "Johnson", "job_title": "CTO", "persona_type": "executive", "email": "alex@biztrip.tech", "company_idx": 6},
        {"first_name": "Priya", "last_name": "Sharma", "job_title": "Product Manager", "persona_type": "influencer", "email": "priya@biztrip.tech", "company_idx": 6},
        {"first_name": "Ketut", "last_name": "Wayan", "job_title": "General Manager", "persona_type": "decision_maker", "email": "ketut@luxestay.com", "company_idx": 7},
        {"first_name": "Sophie", "last_name": "Martin", "job_title": "Revenue Manager", "persona_type": "champion", "email": "sophie@luxestay.com", "company_idx": 7},
        {"first_name": "Klaus", "last_name": "Mueller", "job_title": "Managing Director", "persona_type": "executive", "email": "klaus@eventworld.co", "company_idx": 8},
        {"first_name": "Anna", "last_name": "Schmidt", "job_title": "Event Coordinator", "persona_type": "influencer", "email": "anna@eventworld.co", "company_idx": 8},
        {"first_name": "Thabo", "last_name": "Ndlovu", "job_title": "Founder & CEO", "persona_type": "executive", "email": "thabo@safaritrails.co.za", "company_idx": 9},
        {"first_name": "Zara", "last_name": "Okafor", "job_title": "Sales Manager", "persona_type": "champion", "email": "zara@safaritrails.co.za", "company_idx": 9},
    ]

    contacts = []
    for i, data in enumerate(contacts_data):
        company_idx = data.pop("company_idx")
        contact = Contact(
            id=CONTACT_IDS[i],
            company_id=companies[company_idx].id,
            created_by=admin_user.id,
            enrichment_status="enriched",
            enrichment_source="seed",
            enriched_at=datetime.now(timezone.utc),
            source="seed",
            is_primary=(i % 2 == 0),
            **data,
        )
        db.add(contact)
        contacts.append(contact)

    await db.flush()
    logger.info("Created %d sample contacts", len(contacts))
    return contacts


async def seed_strategies(
    db: AsyncSession,
    admin_user: User,
    companies: list[Company],
) -> list[Strategy]:
    stmt = select(Strategy).where(Strategy.id.in_(STRATEGY_IDS))
    result = await db.execute(stmt)
    existing = list(result.scalars().all())
    if len(existing) == len(STRATEGY_IDS):
        logger.info("All sample strategies already exist, skipping")
        return existing

    strategies_data = [
        {
            "name": "High-Value Travel Companies",
            "description": "Target large travel and hospitality companies with high travel intensity",
            "filters": {
                "industry": ["Travel & Tourism", "Hospitality"],
                "geography": [],
                "revenue_min": None,
                "revenue_max": None,
                "employee_min": 100,
                "employee_max": None,
                "travel_intensity": ["high"],
                "custom_tags": [],
            },
            "status": "active",
            "company_indices": [0, 1, 5, 7],
        },
        {
            "name": "APAC Expansion",
            "description": "Outreach to companies in Asia Pacific region",
            "filters": {
                "industry": [],
                "geography": ["Asia Pacific"],
                "revenue_min": None,
                "revenue_max": None,
                "employee_min": None,
                "employee_max": None,
                "travel_intensity": [],
                "custom_tags": [],
            },
            "status": "active",
            "company_indices": [2, 7],
        },
        {
            "name": "SMB Travel Tech",
            "description": "Small and medium travel tech companies for partnership outreach",
            "filters": {
                "industry": ["Technology", "Events & Conferences"],
                "geography": [],
                "revenue_min": None,
                "revenue_max": None,
                "employee_min": None,
                "employee_max": 500,
                "travel_intensity": ["medium", "high"],
                "custom_tags": [],
            },
            "status": "draft",
            "company_indices": [6, 8],
        },
    ]

    strategies = []
    for i, data in enumerate(strategies_data):
        company_indices = data.pop("company_indices")
        strategy = Strategy(
            id=STRATEGY_IDS[i],
            created_by=admin_user.id,
            team_id=TEAM_ID,
            company_count=len(company_indices),
            **data,
        )
        db.add(strategy)
        await db.flush()

        for ci in company_indices:
            sc = StrategyCompany(
                strategy_id=strategy.id,
                company_id=companies[ci].id,
            )
            db.add(sc)

        strategies.append(strategy)

    await db.flush()
    logger.info("Created %d sample strategies", len(strategies))
    return strategies


async def seed_campaigns(
    db: AsyncSession,
    admin_user: User,
    contacts: list[Contact],
) -> list[Campaign]:
    stmt = select(Campaign).where(Campaign.id.in_(CAMPAIGN_IDS))
    result = await db.execute(stmt)
    existing = list(result.scalars().all())
    if len(existing) == len(CAMPAIGN_IDS):
        logger.info("All sample campaigns already exist, skipping")
        return existing

    campaigns_data = [
        {
            "name": "Q1 Travel Corp Outreach",
            "description": "Introduction campaign for high-value travel companies",
            "campaign_type": "intro",
            "tone_preset": "consultative",
            "status": "active",
            "strategy_id": STRATEGY_IDS[0],
            "contact_indices": [0, 1, 2, 3, 10, 11],
            "steps": [
                {
                    "step_number": 1,
                    "delay_days": 0,
                    "step_type": "email",
                    "subject_template": "Partnership opportunity for {{company_name}}",
                    "body_template": "Hi {{first_name}},\n\nI noticed {{company_name}} has been expanding its travel operations...",
                    "is_ai_generated": True,
                },
                {
                    "step_number": 2,
                    "delay_days": 3,
                    "step_type": "email",
                    "subject_template": "Re: Partnership opportunity for {{company_name}}",
                    "body_template": "Hi {{first_name}},\n\nJust following up on my previous email...",
                    "is_ai_generated": True,
                },
                {
                    "step_number": 3,
                    "delay_days": 7,
                    "step_type": "email",
                    "subject_template": "Quick question about {{company_name}}'s travel operations",
                    "body_template": "Hi {{first_name}},\n\nI wanted to share a quick case study...",
                    "is_ai_generated": True,
                },
            ],
        },
        {
            "name": "APAC Region Introduction",
            "description": "Introduction to companies in Asia Pacific",
            "campaign_type": "intro",
            "tone_preset": "professional",
            "status": "draft",
            "strategy_id": STRATEGY_IDS[1],
            "contact_indices": [4, 5, 14, 15],
            "steps": [
                {
                    "step_number": 1,
                    "delay_days": 0,
                    "step_type": "email",
                    "subject_template": "Connecting with {{company_name}}",
                    "body_template": "Dear {{first_name}},\n\nWe specialize in helping companies like {{company_name}} optimize travel operations...",
                    "is_ai_generated": True,
                },
                {
                    "step_number": 2,
                    "delay_days": 5,
                    "step_type": "email",
                    "subject_template": "Following up — travel solutions for {{company_name}}",
                    "body_template": "Dear {{first_name}},\n\nI hope this message finds you well...",
                    "is_ai_generated": True,
                },
            ],
        },
    ]

    campaigns = []
    for i, data in enumerate(campaigns_data):
        contact_indices = data.pop("contact_indices")
        steps_data = data.pop("steps")

        campaign = Campaign(
            id=CAMPAIGN_IDS[i],
            created_by=admin_user.id,
            **data,
        )
        db.add(campaign)
        await db.flush()

        # Create sequence steps
        for step in steps_data:
            seq_step = SequenceStep(
                campaign_id=campaign.id,
                **step,
            )
            db.add(seq_step)

        # Add contacts to campaign
        for ci in contact_indices:
            cc = CampaignContact(
                campaign_id=campaign.id,
                contact_id=contacts[ci].id,
                status="active",
                current_step=0,
            )
            db.add(cc)

        campaigns.append(campaign)

    await db.flush()
    logger.info("Created %d sample campaigns with sequence steps", len(campaigns))
    return campaigns


async def run_seed() -> None:
    logger.info("Starting seed process...")
    logger.info("Database URL: %s", settings.DATABASE_URL[:50] + "...")

    session_factory = get_session_factory()
    async with session_factory() as db:
        try:
            admin_user = await seed_admin_user(db)
            team = await seed_team(db, admin_user)
            companies = await seed_companies(db, admin_user)
            contacts = await seed_contacts(db, admin_user, companies)
            strategies = await seed_strategies(db, admin_user, companies)
            campaigns = await seed_campaigns(db, admin_user, contacts)

            await db.commit()
            logger.info("Seed data committed successfully!")
            logger.info("  - Admin user: admin@salespilot.com / admin123")
            logger.info("  - Team: Sales Team Alpha")
            logger.info("  - Companies: %d", len(companies))
            logger.info("  - Contacts: %d", len(contacts))
            logger.info("  - Strategies: %d", len(strategies))
            logger.info("  - Campaigns: %d", len(campaigns))
        except Exception:
            await db.rollback()
            logger.exception("Seed failed, rolling back")
            raise


if __name__ == "__main__":
    asyncio.run(run_seed())
