import logging

from app.agents.base import AgentResult, BaseAgent
from app.agents.prompts.persona import (
    PERSONA_SUGGESTION_SCHEMA,
    build_persona_prompt,
)

logger = logging.getLogger(__name__)


class PersonaAgent(BaseAgent):
    """Agent that discovers relevant decision-maker personas for a target company."""

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute persona discovery for a company.

        Args:
            input_data: dict containing 'company_name', 'industry',
                        'employee_count', 'geography', and optionally 'user_id'.

        Returns:
            AgentResult with list of persona suggestions in data['personas'].
        """
        company_data = {
            "company_name": input_data.get("company_name", ""),
            "industry": input_data.get("industry"),
            "employee_count": input_data.get("employee_count"),
            "geography": input_data.get("geography"),
            "domain": input_data.get("domain"),
        }
        user_id = input_data.get("user_id")

        messages = build_persona_prompt(company_data)

        try:
            result = await self.llm_router.complete_structured(
                task_type="persona_mapping",
                messages=messages,
                schema=PERSONA_SUGGESTION_SCHEMA,
            )

            personas = result.get("personas", [])

            validated_personas = []
            for persona in personas:
                first_name = persona.get("first_name", "")
                last_name = persona.get("last_name", "")

                # Only accept LinkedIn URL if AI actually provided one from public sources
                # DO NOT generate fake URLs - they mislead users
                linkedin_url = persona.get("linkedin_url") or ""
                linkedin_url = linkedin_url.strip()
                if linkedin_url and not linkedin_url.startswith("http"):
                    # Normalise format but only if AI gave us something
                    if linkedin_url.startswith("linkedin.com") or linkedin_url.startswith("www.linkedin.com"):
                        linkedin_url = f"https://{linkedin_url}"
                    elif linkedin_url.startswith("/in/") or linkedin_url.startswith("in/"):
                        linkedin_url = f"https://www.linkedin.com/{linkedin_url.lstrip('/')}"
                    else:
                        linkedin_url = f"https://www.linkedin.com/in/{linkedin_url.lstrip('/')}"

                validated = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "job_title": persona.get("job_title", ""),
                    "email": persona.get("email"),
                    "phone": persona.get("phone"),
                    "linkedin_url": linkedin_url or None,
                    "city": persona.get("city"),
                    "country": persona.get("country"),
                    "seniority": persona.get("seniority"),
                    "persona_type": persona.get("persona_type", "other"),
                    "confidence_score": min(
                        max(persona.get("confidence_score", 0.5), 0.0),
                        1.0,
                    ),
                    "reasoning": persona.get("reasoning", ""),
                    "source": "ai",
                }
                if validated["job_title"]:
                    validated_personas.append(validated)

            agent_result = AgentResult(
                success=True,
                data={"personas": validated_personas},
                tokens_used=0,
                model_used="persona_mapping",
            )

            await self.log_execution(
                task_type="persona_mapping",
                input_data={"company_data": company_data},
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("Persona agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data={"personas": []},
                tokens_used=0,
                model_used="persona_mapping",
                error=str(e),
            )

            await self.log_execution(
                task_type="persona_mapping",
                input_data={"company_data": company_data},
                result=error_result,
                tokens_used=0,
                model_used="persona_mapping",
                user_id=user_id,
            )

            return error_result
