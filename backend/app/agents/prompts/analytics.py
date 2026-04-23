SYSTEM_PROMPT = (
    "You are a sales analytics expert analyzing outbound campaign performance "
    "for a B2B sales team focused on corporate travel and MICE services.\n\n"
    "Your role is to analyse raw metrics data and produce clear, actionable insights "
    "that help the Nigerian sales team improve their outreach effectiveness.\n\n"
    "When analyzing metrics, focus on:\n"
    "- Response rate trends and what they indicate\n"
    "- Campaign performance comparisons\n"
    "- Rep productivity and areas for improvement\n"
    "- Pipeline health and conversion bottlenecks\n"
    "- Actionable recommendations based on the data\n\n"
    "Be specific with numbers and percentages. Avoid vague statements. "
    "Every insight should have a clear takeaway or recommended action."
)

INSIGHT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short title for the insight (under 60 chars)",
                    },
                    "description": {
                        "type": "string",
                        "description": "Detailed description with specific numbers and recommendations",
                    },
                    "metric": {
                        "type": "string",
                        "description": "The primary metric this insight relates to",
                    },
                    "change_percent": {
                        "type": "number",
                        "description": "Percentage change if applicable, null otherwise",
                    },
                    "trend": {
                        "type": "string",
                        "enum": ["up", "down", "flat"],
                        "description": "Direction of the trend",
                    },
                },
                "required": ["title", "description", "metric", "trend"],
            },
            "minItems": 1,
            "maxItems": 5,
        },
    },
    "required": ["insights"],
}


def build_insights_prompt(metrics: dict) -> list[dict]:
    """
    Build the message list for generating analytics insights from raw metrics.

    Args:
        metrics: dict containing dashboard KPIs, funnel data, campaign performance,
                 and other raw metrics to analyze.

    Returns:
        List of message dicts for the LLM.
    """
    metrics_parts: list[str] = []

    # Dashboard KPIs
    kpis = metrics.get("kpis", {})
    if kpis:
        metrics_parts.append("Dashboard KPIs:")
        metrics_parts.append(f"  - Total Strategies: {kpis.get('total_strategies', 0)}")
        metrics_parts.append(f"  - Total Companies: {kpis.get('total_companies', 0)}")
        metrics_parts.append(f"  - Total Contacts: {kpis.get('total_contacts', 0)}")
        metrics_parts.append(f"  - Total Campaigns: {kpis.get('total_campaigns', 0)}")
        metrics_parts.append(f"  - Active Campaigns: {kpis.get('active_campaigns', 0)}")
        metrics_parts.append(f"  - Messages Sent: {kpis.get('messages_sent', 0)}")
        metrics_parts.append(f"  - Messages Pending: {kpis.get('messages_pending', 0)}")
        metrics_parts.append(f"  - Total Replies: {kpis.get('total_replies', 0)}")
        metrics_parts.append(f"  - Response Rate: {kpis.get('overall_response_rate', 0)}%")
        metrics_parts.append(f"  - Contacts Enriched: {kpis.get('contacts_enriched', 0)}")
        metrics_parts.append(
            f"  - Pending Enrichment: {kpis.get('contacts_pending_enrichment', 0)}"
        )

    # Funnel data
    funnel = metrics.get("funnel", {})
    if funnel:
        metrics_parts.append("")
        metrics_parts.append("Sales Funnel:")
        metrics_parts.append(f"  - Strategies: {funnel.get('strategies_count', 0)}")
        metrics_parts.append(f"  - Companies: {funnel.get('companies_count', 0)}")
        metrics_parts.append(f"  - Contacts: {funnel.get('contacts_count', 0)}")
        metrics_parts.append(f"  - Enriched: {funnel.get('enriched_contacts', 0)}")
        metrics_parts.append(f"  - Campaigns: {funnel.get('campaigns_count', 0)}")
        metrics_parts.append(f"  - Messages Sent: {funnel.get('messages_sent', 0)}")
        metrics_parts.append(f"  - Replies: {funnel.get('replies_count', 0)}")
        metrics_parts.append(f"  - Connects: {funnel.get('connects_count', 0)}")

    # Campaign performance
    campaigns = metrics.get("campaigns", [])
    if campaigns:
        metrics_parts.append("")
        metrics_parts.append("Top Campaigns:")
        for camp in campaigns[:5]:
            metrics_parts.append(
                f"  - {camp.get('campaign_name', 'N/A')}: "
                f"{camp.get('messages_sent', 0)} sent, "
                f"{camp.get('replies', 0)} replies, "
                f"{camp.get('response_rate', 0)}% response rate"
            )

    # Week-over-week changes
    wow = metrics.get("week_over_week", {})
    if wow:
        metrics_parts.append("")
        metrics_parts.append("Week-over-Week Changes:")
        for key, value in wow.items():
            metrics_parts.append(f"  - {key}: {value}")

    metrics_text = "\n".join(metrics_parts)

    user_message = (
        "Analyze the following sales outreach metrics and generate up to 5 "
        "actionable insights for the sales team.\n\n"
        f"{metrics_text}\n\n"
        "For each insight, provide:\n"
        "1. A clear, specific title\n"
        "2. A detailed description with numbers and a recommended action\n"
        "3. The primary metric it relates to\n"
        "4. The percentage change (if applicable)\n"
        "5. The trend direction (up/down/flat)\n\n"
        "Focus on the most impactful observations. Prioritize insights that "
        "can lead to immediate improvements in campaign performance.\n\n"
        "Respond with structured data matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
