from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.analytics import (
    AnalyticsInsight,
    CampaignPerformance,
    DashboardKPIs,
    FunnelData,
    RepPerformance,
    TrendData,
)
from app.schemas.user import TokenPayload
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardKPIs)
async def get_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> DashboardKPIs:
    """Get top-level dashboard KPIs."""
    return await analytics_service.get_dashboard_kpis(db)


@router.get("/funnel", response_model=FunnelData)
async def get_funnel(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> FunnelData:
    """Get sales funnel data with conversion rates."""
    return await analytics_service.get_funnel_data(db)


@router.get("/campaigns/performance", response_model=list[CampaignPerformance])
@router.get("/campaigns", response_model=list[CampaignPerformance], include_in_schema=False)
async def get_campaigns_performance(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[CampaignPerformance]:
    """Get per-campaign performance metrics."""
    return await analytics_service.get_campaign_performance(
        db, status=status, limit=limit
    )


@router.get("/reps", response_model=list[RepPerformance])
async def get_reps_performance(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[RepPerformance]:
    """Get per-rep performance metrics."""
    return await analytics_service.get_rep_performance(db)


@router.get("/trends", response_model=TrendData)
async def get_trends(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    metric: str = Query(
        ...,
        description="Metric to trend: messages_sent, replies, companies_added, contacts_added, campaigns_created",
    ),
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    days: int = Query(default=30, ge=1, le=365),
) -> TrendData:
    """Get time-series trend data for a given metric."""
    return await analytics_service.get_trend_data(
        db, metric=metric, period=period, days=days
    )


@router.get("/insights", response_model=list[AnalyticsInsight])
async def get_insights(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[AnalyticsInsight]:
    """Get AI-generated analytics insights."""
    return await analytics_service.generate_insights(db)
