import logging

from app.agents.base import AgentResult, BaseAgent
from app.agents.prompts.research import (
    RESEARCH_CONTENT_SCHEMA,
    build_company_research_prompt,
    build_prospect_research_prompt,
    build_talking_points_prompt,
)

logger = logging.getLogger(__name__)


class ResearchAgent(BaseAgent):
    """Agent that generates structured research briefs for companies and contacts."""

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute research generation.

        Args:
            input_data: dict containing:
                - company_data (dict): Company details
                - contact_data (dict, optional): Contact details
                - brief_type (str): One of company_summary, prospect_summary,
                  talking_points, industry_brief
                - user_id (UUID, optional): User who triggered the research

        Returns:
            AgentResult with structured research content in data['content'].
        """
        company_data = input_data.get("company_data", {})
        contact_data = input_data.get("contact_data")
        brief_type = input_data.get("brief_type", "company_summary")
        user_id = input_data.get("user_id")

        if brief_type == "prospect_summary" and contact_data:
            messages = build_prospect_research_prompt(contact_data, company_data)
        elif brief_type == "talking_points" and contact_data:
            messages = build_talking_points_prompt(contact_data, company_data)
        else:
            messages = build_company_research_prompt(company_data)

        try:
            result = await self.llm_router.complete_structured(
                task_type="research",
                messages=messages,
                schema=RESEARCH_CONTENT_SCHEMA,
            )

            content = {
                "summary": result.get("summary", ""),
                "key_facts": result.get("key_facts", []),
                "talking_points": result.get("talking_points", []),
                "pain_points": result.get("pain_points", []),
                "opportunities": result.get("opportunities", []),
                "recent_news": result.get("recent_news", []),
            }

            agent_result = AgentResult(
                success=True,
                data={"content": content},
                tokens_used=0,
                model_used="research",
            )

            await self.log_execution(
                task_type="research",
                input_data={
                    "brief_type": brief_type,
                    "company_data": company_data,
                },
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("Research agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data={"content": {}},
                tokens_used=0,
                model_used="research",
                error=str(e),
            )

            await self.log_execution(
                task_type="research",
                input_data={
                    "brief_type": brief_type,
                    "company_data": company_data,
                },
                result=error_result,
                tokens_used=0,
                model_used="research",
                user_id=user_id,
            )

            return error_result
