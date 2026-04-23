import logging

from app.agents.base import AgentResult, BaseAgent
from app.agents.prompts.discovery import (
    COMPANY_SUGGESTION_SCHEMA,
    build_discovery_prompt,
)

logger = logging.getLogger(__name__)


class DiscoveryAgent(BaseAgent):
    """Agent that discovers companies matching an ICP strategy."""

    async def _discover_for_category(
        self, filters: dict, size_category: str | None
    ) -> list[dict]:
        """Run a single discovery call for one size category."""
        messages = build_discovery_prompt(filters, size_category=size_category)

        result = await self.llm_router.complete_structured(
            task_type="discovery",
            messages=messages,
            schema=COMPANY_SUGGESTION_SCHEMA,
        )

        companies = result.get("companies", [])
        validated = []
        for company in companies:
            v = {
                "name": company.get("name", ""),
                "industry": company.get("industry", ""),
                "city": company.get("city", ""),
                "geography": company.get("geography", ""),
                "employee_count": company.get("employee_count"),
                "revenue_range": company.get("revenue_range", ""),
                "reasoning": company.get("reasoning", ""),
                "domain": company.get("domain"),
                "travel_intensity": company.get("travel_intensity"),
                "company_size": size_category or "unknown",
            }
            if v["name"]:
                validated.append(v)
        return validated

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute company discovery based on ICP filters.

        Args:
            input_data: dict containing:
                - 'filters' (ICP filter dict)
                - 'size_category' (optional: "large", "sme", "small", or "all")
                - 'user_id' for logging

        Returns:
            AgentResult with list of company suggestions in data['companies'],
            grouped by size category in data['by_category'].
        """
        filters = input_data.get("filters", {})
        size_category = input_data.get("size_category", "all")
        user_id = input_data.get("user_id")

        try:
            all_companies: list[dict] = []
            by_category: dict[str, list[dict]] = {}
            seen_names: set[str] = set()

            if size_category == "all":
                # Run 3 separate discovery calls for each size category
                for cat in ["large", "sme", "small"]:
                    try:
                        companies = await self._discover_for_category(filters, cat)
                        # Deduplicate
                        unique = []
                        for c in companies:
                            name_lower = c["name"].lower()
                            if name_lower not in seen_names:
                                seen_names.add(name_lower)
                                unique.append(c)
                        by_category[cat] = unique
                        all_companies.extend(unique)
                        logger.info(
                            "Discovery category '%s': found %d companies",
                            cat, len(unique),
                        )
                    except Exception as cat_err:
                        logger.warning(
                            "Discovery failed for category '%s': %s",
                            cat, str(cat_err),
                        )
                        by_category[cat] = []
            else:
                # Single category discovery
                companies = await self._discover_for_category(
                    filters, size_category if size_category != "all" else None
                )
                by_category[size_category] = companies
                all_companies = companies

            agent_result = AgentResult(
                success=True,
                data={
                    "companies": all_companies,
                    "by_category": by_category,
                },
                tokens_used=0,
                model_used="discovery",
            )

            await self.log_execution(
                task_type="discovery",
                input_data={"filters": filters, "size_category": size_category},
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("Discovery agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data={"companies": [], "by_category": {}},
                tokens_used=0,
                model_used="discovery",
                error=str(e),
            )

            await self.log_execution(
                task_type="discovery",
                input_data={"filters": filters, "size_category": size_category},
                result=error_result,
                tokens_used=0,
                model_used="discovery",
                user_id=user_id,
            )

            return error_result
