import logging

from app.agents.base import AgentResult, BaseAgent
from app.utils.email_validator import (
    generate_email_patterns,
    validate_email_format,
)

logger = logging.getLogger(__name__)


class EnrichmentAgent(BaseAgent):
    """
    Agent that enriches contact data with email and LinkedIn suggestions.

    Primarily logic-based, using email pattern generation. Falls back to
    LLM only for edge cases where pattern generation is insufficient.
    """

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute contact enrichment.

        Args:
            input_data: dict containing 'contact' with keys:
                - first_name (str)
                - last_name (str)
                - company_domain (str)
                - existing_email (str, optional)
                - company_name (str, optional)
            Optionally 'user_id' for logging.

        Returns:
            AgentResult with enriched data in data dict.
        """
        contact = input_data.get("contact", {})
        user_id = input_data.get("user_id")

        first_name = contact.get("first_name", "")
        last_name = contact.get("last_name", "")
        company_domain = contact.get("company_domain", "")
        existing_email = contact.get("existing_email")
        company_name = contact.get("company_name", "")

        enriched_data: dict = {
            "email_candidates": [],
            "linkedin_suggestion": None,
            "confidence_score": 0.0,
        }

        try:
            # Generate email candidates from name + domain
            if first_name and last_name and company_domain:
                patterns = generate_email_patterns(
                    first_name, last_name, company_domain
                )
                valid_patterns = [p for p in patterns if validate_email_format(p)]
                enriched_data["email_candidates"] = valid_patterns

                if valid_patterns:
                    enriched_data["confidence_score"] = 0.7

            # If there's an existing email, validate and boost confidence
            if existing_email and validate_email_format(existing_email):
                if existing_email not in enriched_data["email_candidates"]:
                    enriched_data["email_candidates"].insert(0, existing_email)
                enriched_data["confidence_score"] = max(
                    enriched_data["confidence_score"], 0.85
                )

            # Generate LinkedIn suggestion
            if first_name and last_name:
                enriched_data["linkedin_suggestion"] = (
                    f"https://www.linkedin.com/in/"
                    f"{first_name.lower()}-{last_name.lower()}"
                )

            # If pattern-based enrichment is insufficient, use LLM for edge cases
            if not enriched_data["email_candidates"] and company_name:
                try:
                    llm_result = await self._llm_enrich(
                        first_name, last_name, company_name, company_domain
                    )
                    if llm_result:
                        enriched_data["email_candidates"] = llm_result.get(
                            "email_candidates", []
                        )
                        enriched_data["confidence_score"] = llm_result.get(
                            "confidence_score", 0.4
                        )
                except Exception as llm_err:
                    logger.warning(
                        "LLM enrichment fallback failed: %s", str(llm_err)
                    )

            success = bool(enriched_data["email_candidates"])

            agent_result = AgentResult(
                success=success,
                data=enriched_data,
                tokens_used=0,
                model_used="enrichment",
            )

            await self.log_execution(
                task_type="enrichment",
                input_data={"contact": contact},
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("Enrichment agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data=enriched_data,
                tokens_used=0,
                model_used="enrichment",
                error=str(e),
            )

            await self.log_execution(
                task_type="enrichment",
                input_data={"contact": contact},
                result=error_result,
                tokens_used=0,
                model_used="enrichment",
                user_id=user_id,
            )

            return error_result

    async def _llm_enrich(
        self,
        first_name: str,
        last_name: str,
        company_name: str,
        company_domain: str,
    ) -> dict | None:
        """
        Use LLM as a fallback for enrichment when pattern generation is insufficient.

        Returns dict with email_candidates and confidence_score, or None.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert email research assistant specialising in "
                    "Nigerian companies. Given a person's name and company "
                    "information, determine the ACTUAL email format used by that "
                    "company. Many Nigerian companies use specific formats like "
                    "firstname.lastname@domain, flastname@domain, or "
                    "firstname@domain. Research what format this specific company "
                    "uses based on your knowledge of their publicly known emails. "
                    "Return structured JSON with your best guesses ordered by "
                    "likelihood. Set confidence_score based on how certain you are "
                    "of the company's email format (0.8+ if you know the format, "
                    "0.5-0.7 if guessing)."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Person: {first_name} {last_name}\n"
                    f"Company: {company_name}\n"
                    f"Domain: {company_domain}\n\n"
                    "What is the ACTUAL email format used by this company? "
                    "If you know real emails from this company (from news, "
                    "press releases, or public records), use that format. "
                    "Suggest up to 3 email candidates ordered by likelihood."
                ),
            },
        ]

        schema = {
            "type": "object",
            "properties": {
                "email_candidates": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 3,
                },
                "confidence_score": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                },
            },
            "required": ["email_candidates", "confidence_score"],
        }

        result = await self.llm_router.complete_structured(
            task_type="research",
            messages=messages,
            schema=schema,
        )

        candidates = result.get("email_candidates", [])
        valid_candidates = [c for c in candidates if validate_email_format(c)]

        if valid_candidates:
            return {
                "email_candidates": valid_candidates,
                "confidence_score": min(
                    result.get("confidence_score", 0.4), 0.6
                ),
            }

        return None
