import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignContact
from app.models.company import Company
from app.models.contact import Contact
from app.models.message_draft import MessageDraft
from app.models.strategy import Strategy, StrategyCompany
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsInsight,
    CampaignPerformance,
    ConversionRates,
    DashboardKPIs,
    FunnelData,
    RepPerformance,
    TrendData,
    TrendDataPoint,
)

logger = logging.getLogger(__name__)


async def get_dashboard_kpis(db: AsyncSession) -> DashboardKPIs:
    """Get top-level dashboard KPIs."""
    # Count strategies (non-deleted)
    strategies_result = await db.execute(
        select(func.count(Strategy.id)).where(Strategy.is_deleted.is_(False))
    )
    total_strategies = strategies_result.scalar_one()

    # Count companies (non-deleted)
    companies_result = await db.execute(
        select(func.count(Company.id)).where(Company.is_deleted.is_(False))
    )
    total_companies = companies_result.scalar_one()

    # Count contacts (non-deleted)
    contacts_result = await db.execute(
        select(func.count(Contact.id)).where(Contact.is_deleted.is_(False))
    )
    total_contacts = contacts_result.scalar_one()

    # Count campaigns (total and active, non-deleted)
    campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.is_deleted.is_(False))
    )
    total_campaigns = campaigns_result.scalar_one()

    active_campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(
            Campaign.is_deleted.is_(False),
            Campaign.status == "active",
        )
    )
    active_campaigns = active_campaigns_result.scalar_one()

    # Count messages by status
    msg_status_stmt = (
        select(
            MessageDraft.status,
            func.count(MessageDraft.id).label("count"),
        )
        .where(MessageDraft.is_deleted.is_(False))
        .group_by(MessageDraft.status)
    )
    msg_result = await db.execute(msg_status_stmt)
    msg_rows = msg_result.all()

    messages_sent = 0
    messages_pending = 0
    total_replies = 0
    for status_val, count_val in msg_rows:
        if status_val == "sent":
            messages_sent += count_val
        elif status_val == "replied":
            total_replies += count_val
        elif status_val in ("draft", "pending_approval", "approved"):
            messages_pending += count_val

    # Include replied in sent total for response rate calculation
    total_delivered = messages_sent + total_replies
    overall_response_rate = (
        round((total_replies / total_delivered) * 100, 1)
        if total_delivered > 0
        else 0.0
    )

    # Count enrichment statuses
    enriched_result = await db.execute(
        select(func.count(Contact.id)).where(
            Contact.is_deleted.is_(False),
            Contact.enrichment_status == "enriched",
        )
    )
    contacts_enriched = enriched_result.scalar_one()

    pending_enrichment_result = await db.execute(
        select(func.count(Contact.id)).where(
            Contact.is_deleted.is_(False),
            Contact.enrichment_status == "pending",
        )
    )
    contacts_pending_enrichment = pending_enrichment_result.scalar_one()

    return DashboardKPIs(
        total_strategies=total_strategies,
        total_companies=total_companies,
        total_contacts=total_contacts,
        total_campaigns=total_campaigns,
        active_campaigns=active_campaigns,
        messages_sent=messages_sent,
        messages_pending=messages_pending,
        total_replies=total_replies,
        overall_response_rate=overall_response_rate,
        contacts_enriched=contacts_enriched,
        contacts_pending_enrichment=contacts_pending_enrichment,
    )


async def get_funnel_data(db: AsyncSession) -> FunnelData:
    """Get sales funnel data with conversion rates between stages."""
    # Strategies
    strategies_result = await db.execute(
        select(func.count(Strategy.id)).where(Strategy.is_deleted.is_(False))
    )
    strategies_count = strategies_result.scalar_one()

    # Companies
    companies_result = await db.execute(
        select(func.count(Company.id)).where(Company.is_deleted.is_(False))
    )
    companies_count = companies_result.scalar_one()

    # Contacts
    contacts_result = await db.execute(
        select(func.count(Contact.id)).where(Contact.is_deleted.is_(False))
    )
    contacts_count = contacts_result.scalar_one()

    # Enriched contacts
    enriched_result = await db.execute(
        select(func.count(Contact.id)).where(
            Contact.is_deleted.is_(False),
            Contact.enrichment_status == "enriched",
        )
    )
    enriched_contacts = enriched_result.scalar_one()

    # Campaigns
    campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.is_deleted.is_(False))
    )
    campaigns_count = campaigns_result.scalar_one()

    # Messages sent (includes replied)
    sent_result = await db.execute(
        select(func.count(MessageDraft.id)).where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status.in_(["sent", "replied"]),
        )
    )
    messages_sent = sent_result.scalar_one()

    # Replies
    replies_result = await db.execute(
        select(func.count(MessageDraft.id)).where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status == "replied",
        )
    )
    replies_count = replies_result.scalar_one()

    # Connects (campaign contacts with status replied)
    connects_result = await db.execute(
        select(func.count(CampaignContact.id)).where(
            CampaignContact.status == "replied",
        )
    )
    connects_count = connects_result.scalar_one()

    # Calculate conversion rates
    def rate(numerator: int, denominator: int) -> float:
        return round((numerator / denominator) * 100, 1) if denominator > 0 else 0.0

    return FunnelData(
        strategies_count=strategies_count,
        companies_count=companies_count,
        contacts_count=contacts_count,
        enriched_contacts=enriched_contacts,
        campaigns_count=campaigns_count,
        messages_sent=messages_sent,
        replies_count=replies_count,
        connects_count=connects_count,
        conversion_rates=ConversionRates(
            strategies_to_companies=rate(companies_count, strategies_count),
            companies_to_contacts=rate(contacts_count, companies_count),
            contacts_to_enriched=rate(enriched_contacts, contacts_count),
            enriched_to_campaigns=rate(campaigns_count, enriched_contacts),
            campaigns_to_messages=rate(messages_sent, campaigns_count),
            messages_to_replies=rate(replies_count, messages_sent),
            replies_to_connects=rate(connects_count, replies_count),
        ),
    )


async def get_campaign_performance(
    db: AsyncSession,
    status: str | None = None,
    limit: int = 20,
) -> list[CampaignPerformance]:
    """Get per-campaign performance metrics."""
    # Subquery for messages sent per campaign
    msg_sent_sq = (
        select(
            MessageDraft.campaign_id,
            func.count(MessageDraft.id).label("sent_count"),
        )
        .where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status.in_(["sent", "replied"]),
        )
        .group_by(MessageDraft.campaign_id)
        .subquery()
    )

    # Subquery for replies per campaign
    msg_replies_sq = (
        select(
            MessageDraft.campaign_id,
            func.count(MessageDraft.id).label("reply_count"),
        )
        .where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status == "replied",
        )
        .group_by(MessageDraft.campaign_id)
        .subquery()
    )

    # Subquery for contacts per campaign
    contacts_sq = (
        select(
            CampaignContact.campaign_id,
            func.count(CampaignContact.id).label("contact_count"),
        )
        .group_by(CampaignContact.campaign_id)
        .subquery()
    )

    stmt = (
        select(
            Campaign.id,
            Campaign.name,
            Campaign.campaign_type,
            Campaign.status,
            Campaign.starts_at,
            func.coalesce(contacts_sq.c.contact_count, 0).label("contacts_count"),
            func.coalesce(msg_sent_sq.c.sent_count, 0).label("messages_sent"),
            func.coalesce(msg_replies_sq.c.reply_count, 0).label("replies"),
        )
        .outerjoin(contacts_sq, Campaign.id == contacts_sq.c.campaign_id)
        .outerjoin(msg_sent_sq, Campaign.id == msg_sent_sq.c.campaign_id)
        .outerjoin(msg_replies_sq, Campaign.id == msg_replies_sq.c.campaign_id)
        .where(Campaign.is_deleted.is_(False))
        .order_by(Campaign.created_at.desc())
        .limit(limit)
    )

    if status:
        stmt = stmt.where(Campaign.status == status)

    result = await db.execute(stmt)
    rows = result.all()

    performances = []
    for row in rows:
        sent = row.messages_sent
        replies = row.replies
        response_rate = round((replies / sent) * 100, 1) if sent > 0 else 0.0

        performances.append(
            CampaignPerformance(
                campaign_id=str(row.id),
                campaign_name=row.name,
                campaign_type=row.campaign_type,
                status=row.status,
                contacts_count=row.contacts_count,
                messages_sent=sent,
                replies=replies,
                response_rate=response_rate,
                started_at=row.starts_at.isoformat() if row.starts_at else None,
            )
        )

    return performances


async def get_rep_performance(db: AsyncSession) -> list[RepPerformance]:
    """Get per-user (rep) performance metrics."""
    # Campaigns created per user
    campaigns_sq = (
        select(
            Campaign.created_by,
            func.count(Campaign.id).label("campaigns_created"),
        )
        .where(Campaign.is_deleted.is_(False))
        .group_by(Campaign.created_by)
        .subquery()
    )

    # Messages sent per user (creator)
    messages_sent_sq = (
        select(
            MessageDraft.created_by,
            func.count(MessageDraft.id).label("messages_sent"),
        )
        .where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status.in_(["sent", "replied"]),
        )
        .group_by(MessageDraft.created_by)
        .subquery()
    )

    # Replies per user
    replies_sq = (
        select(
            MessageDraft.created_by,
            func.count(MessageDraft.id).label("replies_received"),
        )
        .where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status == "replied",
        )
        .group_by(MessageDraft.created_by)
        .subquery()
    )

    # Companies added per user
    companies_sq = (
        select(
            Company.created_by,
            func.count(Company.id).label("companies_added"),
        )
        .where(Company.is_deleted.is_(False))
        .group_by(Company.created_by)
        .subquery()
    )

    # Contacts added per user
    contacts_sq = (
        select(
            Contact.created_by,
            func.count(Contact.id).label("contacts_added"),
        )
        .where(Contact.is_deleted.is_(False))
        .group_by(Contact.created_by)
        .subquery()
    )

    stmt = (
        select(
            User.id,
            User.full_name,
            func.coalesce(campaigns_sq.c.campaigns_created, 0).label("campaigns_created"),
            func.coalesce(messages_sent_sq.c.messages_sent, 0).label("messages_sent"),
            func.coalesce(replies_sq.c.replies_received, 0).label("replies_received"),
            func.coalesce(companies_sq.c.companies_added, 0).label("companies_added"),
            func.coalesce(contacts_sq.c.contacts_added, 0).label("contacts_added"),
        )
        .outerjoin(campaigns_sq, User.id == campaigns_sq.c.created_by)
        .outerjoin(messages_sent_sq, User.id == messages_sent_sq.c.created_by)
        .outerjoin(replies_sq, User.id == replies_sq.c.created_by)
        .outerjoin(companies_sq, User.id == companies_sq.c.created_by)
        .outerjoin(contacts_sq, User.id == contacts_sq.c.created_by)
        .where(User.is_active.is_(True), User.is_deleted.is_(False))
        .order_by(func.coalesce(messages_sent_sq.c.messages_sent, 0).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    reps = []
    for row in rows:
        sent = row.messages_sent
        replies = row.replies_received
        response_rate = round((replies / sent) * 100, 1) if sent > 0 else 0.0

        reps.append(
            RepPerformance(
                user_id=str(row.id),
                user_name=row.full_name,
                campaigns_created=row.campaigns_created,
                messages_sent=sent,
                replies_received=replies,
                response_rate=response_rate,
                companies_added=row.companies_added,
                contacts_added=row.contacts_added,
            )
        )

    return reps


async def get_trend_data(
    db: AsyncSession,
    metric: str,
    period: str = "daily",
    days: int = 30,
) -> TrendData:
    """Get time-series trend data for a given metric."""
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    # Map metrics to their models and date columns
    metric_map = {
        "messages_sent": {
            "model": MessageDraft,
            "date_col": MessageDraft.sent_at,
            "filter": [
                MessageDraft.is_deleted.is_(False),
                MessageDraft.status.in_(["sent", "replied"]),
                MessageDraft.sent_at.isnot(None),
            ],
        },
        "replies": {
            "model": MessageDraft,
            "date_col": MessageDraft.replied_at,
            "filter": [
                MessageDraft.is_deleted.is_(False),
                MessageDraft.status == "replied",
                MessageDraft.replied_at.isnot(None),
            ],
        },
        "companies_added": {
            "model": Company,
            "date_col": Company.created_at,
            "filter": [Company.is_deleted.is_(False)],
        },
        "contacts_added": {
            "model": Contact,
            "date_col": Contact.created_at,
            "filter": [Contact.is_deleted.is_(False)],
        },
        "campaigns_created": {
            "model": Campaign,
            "date_col": Campaign.created_at,
            "filter": [Campaign.is_deleted.is_(False)],
        },
    }

    config = metric_map.get(metric)
    if config is None:
        return TrendData(metric_name=metric, data_points=[], period=period)

    date_col = config["date_col"]
    filters = config["filter"]

    # Group by date truncation based on period
    if period == "weekly":
        date_trunc = func.date_trunc("week", date_col)
    elif period == "monthly":
        date_trunc = func.date_trunc("month", date_col)
    else:
        date_trunc = cast(date_col, Date)

    stmt = (
        select(
            date_trunc.label("period_date"),
            func.count().label("value"),
        )
        .where(date_col >= start_date, *filters)
        .group_by("period_date")
        .order_by("period_date")
    )

    result = await db.execute(stmt)
    rows = result.all()

    data_points = []
    for row in rows:
        period_date = row.period_date
        if period_date is not None:
            date_str = (
                period_date.isoformat()
                if hasattr(period_date, "isoformat")
                else str(period_date)
            )
            data_points.append(
                TrendDataPoint(
                    date=date_str,
                    value=row.value,
                )
            )

    return TrendData(
        metric_name=metric,
        data_points=data_points,
        period=period,
    )


async def generate_insights(db: AsyncSession) -> list[AnalyticsInsight]:
    """Generate key analytics insights from current data."""
    insights: list[AnalyticsInsight] = []
    now = datetime.now(timezone.utc)
    this_week_start = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)

    # 1. Response rate trend (this week vs last week)
    this_week_sent = await db.execute(
        select(func.count(MessageDraft.id)).where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status.in_(["sent", "replied"]),
            MessageDraft.sent_at >= this_week_start,
        )
    )
    tw_sent = this_week_sent.scalar_one()

    this_week_replies = await db.execute(
        select(func.count(MessageDraft.id)).where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status == "replied",
            MessageDraft.replied_at >= this_week_start,
        )
    )
    tw_replies = this_week_replies.scalar_one()

    last_week_sent = await db.execute(
        select(func.count(MessageDraft.id)).where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status.in_(["sent", "replied"]),
            MessageDraft.sent_at >= last_week_start,
            MessageDraft.sent_at < this_week_start,
        )
    )
    lw_sent = last_week_sent.scalar_one()

    last_week_replies = await db.execute(
        select(func.count(MessageDraft.id)).where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status == "replied",
            MessageDraft.replied_at >= last_week_start,
            MessageDraft.replied_at < this_week_start,
        )
    )
    lw_replies = last_week_replies.scalar_one()

    tw_rate = (tw_replies / tw_sent * 100) if tw_sent > 0 else 0.0
    lw_rate = (lw_replies / lw_sent * 100) if lw_sent > 0 else 0.0
    rate_change = tw_rate - lw_rate

    trend = "up" if rate_change > 0 else ("down" if rate_change < 0 else "flat")
    insights.append(
        AnalyticsInsight(
            title="Response Rate Trend",
            description=(
                f"Response rate is {tw_rate:.1f}% this week "
                f"({'up' if rate_change > 0 else 'down'} from {lw_rate:.1f}% last week). "
                f"{tw_replies} replies from {tw_sent} messages sent."
            ),
            metric="response_rate",
            change_percent=round(rate_change, 1),
            trend=trend,
        )
    )

    # 2. Top performing campaign
    top_campaign_stmt = (
        select(
            Campaign.name,
            func.count(
                case((MessageDraft.status == "replied", MessageDraft.id))
            ).label("replies"),
            func.count(
                case(
                    (MessageDraft.status.in_(["sent", "replied"]), MessageDraft.id)
                )
            ).label("sent"),
        )
        .join(MessageDraft, MessageDraft.campaign_id == Campaign.id)
        .where(
            Campaign.is_deleted.is_(False),
            MessageDraft.is_deleted.is_(False),
        )
        .group_by(Campaign.id, Campaign.name)
        .order_by(
            func.count(
                case((MessageDraft.status == "replied", MessageDraft.id))
            ).desc()
        )
        .limit(1)
    )
    top_campaign_result = await db.execute(top_campaign_stmt)
    top_campaign = top_campaign_result.first()

    if top_campaign and top_campaign.sent > 0:
        camp_rate = round((top_campaign.replies / top_campaign.sent) * 100, 1)
        insights.append(
            AnalyticsInsight(
                title="Top Performing Campaign",
                description=(
                    f'"{top_campaign.name}" leads with {camp_rate}% response rate '
                    f"({top_campaign.replies} replies from {top_campaign.sent} messages)."
                ),
                metric="campaign_performance",
                change_percent=camp_rate,
                trend="up",
            )
        )

    # 3. Most active rep
    active_rep_stmt = (
        select(
            User.full_name,
            func.count(MessageDraft.id).label("msg_count"),
        )
        .join(MessageDraft, MessageDraft.created_by == User.id)
        .where(
            MessageDraft.is_deleted.is_(False),
            MessageDraft.status.in_(["sent", "replied"]),
            MessageDraft.sent_at >= this_week_start,
        )
        .group_by(User.id, User.full_name)
        .order_by(func.count(MessageDraft.id).desc())
        .limit(1)
    )
    active_rep_result = await db.execute(active_rep_stmt)
    active_rep = active_rep_result.first()

    if active_rep:
        insights.append(
            AnalyticsInsight(
                title="Most Active Rep This Week",
                description=(
                    f"{active_rep.full_name} sent {active_rep.msg_count} messages this week."
                ),
                metric="rep_activity",
                trend="up",
            )
        )

    # 4. Enrichment completion rate
    total_contacts_result = await db.execute(
        select(func.count(Contact.id)).where(Contact.is_deleted.is_(False))
    )
    total_contacts = total_contacts_result.scalar_one()

    enriched_result = await db.execute(
        select(func.count(Contact.id)).where(
            Contact.is_deleted.is_(False),
            Contact.enrichment_status == "enriched",
        )
    )
    enriched_count = enriched_result.scalar_one()

    if total_contacts > 0:
        enrichment_rate = round((enriched_count / total_contacts) * 100, 1)
        insights.append(
            AnalyticsInsight(
                title="Contact Enrichment Progress",
                description=(
                    f"{enriched_count} of {total_contacts} contacts enriched "
                    f"({enrichment_rate}%). "
                    f"{total_contacts - enriched_count} contacts pending enrichment."
                ),
                metric="enrichment_rate",
                change_percent=enrichment_rate,
                trend="up" if enrichment_rate > 50 else "flat",
            )
        )

    # 5. Pipeline volume
    new_companies_this_week = await db.execute(
        select(func.count(Company.id)).where(
            Company.is_deleted.is_(False),
            Company.created_at >= this_week_start,
        )
    )
    new_companies = new_companies_this_week.scalar_one()

    new_contacts_this_week = await db.execute(
        select(func.count(Contact.id)).where(
            Contact.is_deleted.is_(False),
            Contact.created_at >= this_week_start,
        )
    )
    new_contacts = new_contacts_this_week.scalar_one()

    insights.append(
        AnalyticsInsight(
            title="Pipeline Growth This Week",
            description=(
                f"{new_companies} new companies and {new_contacts} new contacts "
                f"added this week."
            ),
            metric="pipeline_growth",
            trend="up" if (new_companies + new_contacts) > 0 else "flat",
        )
    )

    return insights[:5]
