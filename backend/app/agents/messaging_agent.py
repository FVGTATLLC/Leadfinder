import logging

from app.agents.base import AgentResult, BaseAgent
from app.agents.prompts.messaging import (
    MESSAGE_OUTPUT_SCHEMA,
    build_corporate_pitch_prompt,
    build_custom_message_prompt,
    build_followup_message_prompt,
    build_intro_message_prompt,
    build_mice_pitch_prompt,
)

logger = logging.getLogger(__name__)


class MessagingAgent(BaseAgent):
    """Agent that generates personalized outreach messages for sales campaigns."""

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute message generation.

        Args:
            input_data: dict containing:
                - contact (dict): name, title, email, persona_type
                - company (dict): name, industry, geography, size
                - research_brief (dict, optional): summary, talking_points, pain_points
                - campaign_type (str): intro, follow_up, mice, corporate, custom
                - tone_preset (str): formal, friendly, consultative, aggressive
                - step_number (int): sequence step number
                - previous_messages (list[dict], optional): for follow-up context
                - additional_context (str, optional): extra instructions

        Returns:
            AgentResult with subject, body, variant_label in data.
        """
        contact = input_data.get("contact", {})
        company = input_data.get("company", {})
        research = input_data.get("research_brief")
        campaign_type = input_data.get("campaign_type", "intro")
        tone = input_data.get("tone_preset", "consultative")
        step_number = input_data.get("step_number", 1)
        previous_messages = input_data.get("previous_messages", [])
        additional_context = input_data.get("additional_context")
        user_id = input_data.get("user_id")

        # Select prompt builder based on campaign type and step number
        if campaign_type == "mice":
            messages = build_mice_pitch_prompt(contact, company, research, tone)
            task_type = "messaging_intro"
        elif campaign_type == "corporate":
            messages = build_corporate_pitch_prompt(contact, company, research, tone)
            task_type = "messaging_intro"
        elif campaign_type == "custom":
            messages = build_custom_message_prompt(
                contact, company, research, tone, additional_context
            )
            task_type = "messaging_intro"
        elif campaign_type == "follow_up" or step_number > 1:
            messages = build_followup_message_prompt(
                contact, company, research, tone, step_number, previous_messages
            )
            task_type = "messaging_followup"
        else:
            # Default: intro
            messages = build_intro_message_prompt(contact, company, research, tone)
            task_type = "messaging_intro"

        try:
            result = await self.llm_router.complete_structured(
                task_type=task_type,
                messages=messages,
                schema=MESSAGE_OUTPUT_SCHEMA,
            )

            subject = result.get("subject", "")
            body = result.get("body", "")
            variant_label = result.get("variant_label", f"{campaign_type}_v1")

            agent_result = AgentResult(
                success=True,
                data={
                    "subject": subject,
                    "body": body,
                    "variant_label": variant_label,
                },
                tokens_used=0,
                model_used=task_type,
            )

            await self.log_execution(
                task_type=task_type,
                input_data={
                    "campaign_type": campaign_type,
                    "tone": tone,
                    "step_number": step_number,
                    "contact_name": contact.get("name", ""),
                    "company_name": company.get("name", ""),
                },
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("Messaging agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data={"subject": "", "body": "", "variant_label": ""},
                tokens_used=0,
                model_used=task_type,
                error=str(e),
            )

            await self.log_execution(
                task_type=task_type,
                input_data={
                    "campaign_type": campaign_type,
                    "tone": tone,
                    "step_number": step_number,
                    "contact_name": contact.get("name", ""),
                    "company_name": company.get("name", ""),
                },
                result=error_result,
                tokens_used=0,
                model_used=task_type,
                user_id=user_id,
            )

            return error_result
