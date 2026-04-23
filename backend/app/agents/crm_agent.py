import logging
import uuid
from datetime import datetime, timezone

from app.agents.base import AgentResult, BaseAgent

logger = logging.getLogger(__name__)


# Standard CRM field mappings
COMPANY_TO_CRM_ACCOUNT = {
    "id": "AccountId",
    "name": "AccountName",
    "domain": "Website",
    "industry": "Industry",
    "sub_industry": "SubIndustry",
    "country": "BillingCountry",
    "city": "BillingCity",
    "geography": "Region",
    "employee_count": "NumberOfEmployees",
    "revenue_range": "AnnualRevenue",
    "phone": "Phone",
    "linkedin_url": "LinkedInURL",
    "website": "Website",
    "icp_score": "LeadScore",
}

CONTACT_TO_CRM_CONTACT = {
    "id": "ContactId",
    "first_name": "FirstName",
    "last_name": "LastName",
    "email": "Email",
    "phone": "Phone",
    "job_title": "Title",
    "persona_type": "PersonaType",
    "linkedin_url": "LinkedInURL",
    "company_id": "AccountId",
}

ACTIVITY_TO_CRM_ACTIVITY = {
    "id": "ActivityId",
    "subject": "Subject",
    "status": "Status",
    "sent_at": "ActivityDate",
    "campaign_id": "CampaignId",
    "contact_id": "WhoId",
}


class CRMAgent(BaseAgent):
    """Agent that transforms internal data models to CRM-compatible format."""

    async def execute(self, input_data: dict) -> AgentResult:
        """
        Execute CRM data transformation.

        Args:
            input_data: dict containing:
                - companies (list[dict], optional): Company data to transform
                - contacts (list[dict], optional): Contact data to transform
                - activities (list[dict], optional): Activity/message data to transform
                - summarize_activities (bool, optional): Use LLM to summarize activities
                - user_id (UUID, optional): User who triggered the transformation

        Returns:
            AgentResult with CRM-formatted records in data['records'].
        """
        companies = input_data.get("companies", [])
        contacts = input_data.get("contacts", [])
        activities = input_data.get("activities", [])
        summarize = input_data.get("summarize_activities", False)
        user_id = input_data.get("user_id")

        records = []

        try:
            # Transform companies to CRM accounts
            for company in companies:
                crm_account = self._map_company_to_account(company)
                records.append({
                    "record_type": "account",
                    "company_id": company.get("id"),
                    "data": crm_account,
                })

            # Transform contacts to CRM contacts
            for contact in contacts:
                crm_contact = self._map_contact_to_crm(contact)
                records.append({
                    "record_type": "contact",
                    "contact_id": contact.get("id"),
                    "company_id": contact.get("company_id"),
                    "data": crm_contact,
                })

            # Transform activities (messages) to CRM activities
            for activity in activities:
                crm_activity = self._map_activity_to_crm(activity)

                # Optionally use LLM to generate an activity summary
                if summarize and activity.get("body"):
                    try:
                        summary = await self._summarize_activity(activity)
                        crm_activity["Description"] = summary
                    except Exception as e:
                        logger.warning(
                            "Failed to summarize activity %s: %s",
                            activity.get("id"),
                            str(e),
                        )
                        crm_activity["Description"] = (
                            activity.get("body", "")[:500]
                        )

                records.append({
                    "record_type": "activity",
                    "contact_id": activity.get("contact_id"),
                    "campaign_id": activity.get("campaign_id"),
                    "data": crm_activity,
                })

            agent_result = AgentResult(
                success=True,
                data={"records": records, "total_records": len(records)},
                tokens_used=0,
                model_used="crm_transform",
            )

            await self.log_execution(
                task_type="crm_transform",
                input_data={
                    "companies_count": len(companies),
                    "contacts_count": len(contacts),
                    "activities_count": len(activities),
                },
                result=agent_result,
                tokens_used=agent_result.tokens_used,
                model_used=agent_result.model_used,
                user_id=user_id,
            )

            return agent_result

        except Exception as e:
            logger.error("CRM agent execution failed: %s", str(e))

            error_result = AgentResult(
                success=False,
                data={"records": [], "total_records": 0},
                tokens_used=0,
                model_used="crm_transform",
                error=str(e),
            )

            await self.log_execution(
                task_type="crm_transform",
                input_data={
                    "companies_count": len(companies),
                    "contacts_count": len(contacts),
                    "activities_count": len(activities),
                },
                result=error_result,
                tokens_used=0,
                model_used="crm_transform",
                user_id=user_id,
            )

            return error_result

    def _map_company_to_account(self, company: dict) -> dict:
        """Map internal company fields to standard CRM account fields."""
        crm_record = {}
        for internal_key, crm_key in COMPANY_TO_CRM_ACCOUNT.items():
            value = company.get(internal_key)
            if value is not None:
                crm_record[crm_key] = str(value) if isinstance(value, uuid.UUID) else value

        crm_record["RecordType"] = "Account"
        crm_record["Source"] = "SalesPilot"
        crm_record["CreatedDate"] = datetime.now(timezone.utc).isoformat()

        return crm_record

    def _map_contact_to_crm(self, contact: dict) -> dict:
        """Map internal contact fields to standard CRM contact fields."""
        crm_record = {}
        for internal_key, crm_key in CONTACT_TO_CRM_CONTACT.items():
            value = contact.get(internal_key)
            if value is not None:
                crm_record[crm_key] = str(value) if isinstance(value, uuid.UUID) else value

        # Compose full name
        first = contact.get("first_name", "")
        last = contact.get("last_name", "")
        crm_record["FullName"] = f"{first} {last}".strip()

        crm_record["RecordType"] = "Contact"
        crm_record["LeadSource"] = "SalesPilot"
        crm_record["CreatedDate"] = datetime.now(timezone.utc).isoformat()

        # Add company name if available
        if contact.get("company_name"):
            crm_record["AccountName"] = contact["company_name"]

        return crm_record

    def _map_activity_to_crm(self, activity: dict) -> dict:
        """Map internal message/activity fields to standard CRM activity fields."""
        crm_record = {}
        for internal_key, crm_key in ACTIVITY_TO_CRM_ACTIVITY.items():
            value = activity.get(internal_key)
            if value is not None:
                if isinstance(value, uuid.UUID):
                    crm_record[crm_key] = str(value)
                elif isinstance(value, datetime):
                    crm_record[crm_key] = value.isoformat()
                else:
                    crm_record[crm_key] = value

        crm_record["RecordType"] = "Task"
        crm_record["TaskSubtype"] = "Email"
        crm_record["Priority"] = "Normal"
        crm_record["Source"] = "SalesPilot"

        # Map status to CRM-compatible values
        status = activity.get("status", "")
        status_map = {
            "sent": "Completed",
            "replied": "Completed",
            "draft": "Not Started",
            "pending_approval": "In Progress",
            "approved": "In Progress",
            "failed": "Deferred",
        }
        crm_record["Status"] = status_map.get(status, status)

        return crm_record

    async def _summarize_activity(self, activity: dict) -> str:
        """Use LLM to generate a concise summary of an activity/message."""
        body = activity.get("body", "")
        subject = activity.get("subject", "")

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a CRM data assistant. Summarize the following "
                    "outreach email in 1-2 sentences for a CRM activity log. "
                    "Be concise and focus on the key ask or value proposition."
                ),
            },
            {
                "role": "user",
                "content": f"Subject: {subject}\n\nBody:\n{body[:1000]}",
            },
        ]

        response = await self.llm_router.complete(
            task_type="analytics_insight",
            messages=messages,
            max_tokens=150,
        )

        return response.content.strip()
