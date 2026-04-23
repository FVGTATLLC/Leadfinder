import logging

from app.agents.base import AgentResult, BaseAgent
from app.agents.prompts.analytics import (
    INSIGHT_SCHEMA,
    build_insights_prompt,
)
from app.schemas.analytics import AnalyticsInsight

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    """Agent that generates human-readable analytics insights from raw metrics."""

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute analytics insight generation.

        Args:
            input_data: dict containing:
                - metrics (dict): Raw metrics data (KPIs, funnel, campaigns, etc.)
                - user_id (UUID, optional): User who triggered the analysis

        Returns:
            AgentResult with list of AnalyticsInsight dicts in data['insights'].
        """
        metrics = input_data.get("metrics", {})
        user_id = input_data.get("user_id")

        messages = build_insights_prompt(metrics)

        try:
            result = await self.llm_router.complete_structured(
                task_type="analytics_insight",
                messages=messages,
                schema=INSIGHT_SCHEMA,
            )

            raw_insights = result.get("insights", [])
            insights = []
            for raw in raw_insights:
                insight = AnalyticsInsight(
                    title=raw.get("title", ""),
                    description=raw.get("description", ""),
                    metric=raw.get("metric", ""),
                    change_percent=raw.get("change_percent"),
                    trend=raw.get("trend", "flat"),
                )
                insights.append(insight.model_dump())

            agent_result = AgentResult(
                success=True,
                data={"insights": insights},
                tokens_used=0,
                model_used="analytics_insight",
            )

            await self.log_execution(
                task_type="analytics_insight",
                input_data={"metrics_keys": list(metrics.keys())},
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("Analytics agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data={"insights": []},
                tokens_used=0,
                model_used="analytics_insight",
                error=str(e),
            )

            await self.log_execution(
                task_type="analytics_insight",
                input_data={"metrics_keys": list(metrics.keys())},
                result=error_result,
                tokens_used=0,
                model_used="analytics_insight",
                user_id=user_id,
            )

            return error_result
