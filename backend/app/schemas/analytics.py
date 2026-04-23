from datetime import date

from pydantic import BaseModel, Field


class DashboardKPIs(BaseModel):
    total_strategies: int = 0
    total_companies: int = 0
    total_contacts: int = 0
    total_campaigns: int = 0
    active_campaigns: int = 0
    messages_sent: int = 0
    messages_pending: int = 0
    total_replies: int = 0
    overall_response_rate: float = 0.0
    contacts_enriched: int = 0
    contacts_pending_enrichment: int = 0


class ConversionRates(BaseModel):
    strategies_to_companies: float = 0.0
    companies_to_contacts: float = 0.0
    contacts_to_enriched: float = 0.0
    enriched_to_campaigns: float = 0.0
    campaigns_to_messages: float = 0.0
    messages_to_replies: float = 0.0
    replies_to_connects: float = 0.0


class FunnelData(BaseModel):
    strategies_count: int = 0
    companies_count: int = 0
    contacts_count: int = 0
    enriched_contacts: int = 0
    campaigns_count: int = 0
    messages_sent: int = 0
    replies_count: int = 0
    connects_count: int = 0
    conversion_rates: ConversionRates = Field(default_factory=ConversionRates)


class CampaignPerformance(BaseModel):
    campaign_id: str
    campaign_name: str
    campaign_type: str
    status: str
    contacts_count: int = 0
    messages_sent: int = 0
    replies: int = 0
    response_rate: float = 0.0
    started_at: str | None = None


class RepPerformance(BaseModel):
    user_id: str
    user_name: str
    campaigns_created: int = 0
    messages_sent: int = 0
    replies_received: int = 0
    response_rate: float = 0.0
    companies_added: int = 0
    contacts_added: int = 0


class TrendDataPoint(BaseModel):
    date: str
    value: int | float = 0
    label: str | None = None


class TrendData(BaseModel):
    metric_name: str
    data_points: list[TrendDataPoint] = Field(default_factory=list)
    period: str = "daily"


class AnalyticsInsight(BaseModel):
    title: str
    description: str
    metric: str
    change_percent: float | None = None
    trend: str = "flat"  # up, down, flat


class DateRange(BaseModel):
    start_date: date
    end_date: date
