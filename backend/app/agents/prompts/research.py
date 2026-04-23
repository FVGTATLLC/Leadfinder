SYSTEM_PROMPT = (
    "You are a B2B sales research analyst specialising in the Nigerian corporate "
    "travel and MICE (Meetings, Incentives, Conferences & Exhibitions) market.\n\n"
    "Your role is to produce structured, actionable research briefs that help "
    "sales representatives prepare for outreach to Nigerian companies and contacts.\n\n"
    "When researching a company, focus on:\n"
    "- Business overview and market position in Nigeria\n"
    "- Travel and events spending patterns\n"
    "- Recent news, expansions, or organisational changes\n"
    "- Pain points related to corporate travel management in Nigeria "
    "(FX volatility, duty of care in security-sensitive regions, visa processing, "
    "local vs. international carrier options, Naira budgeting)\n"
    "- Opportunities for travel/MICE service providers in the Nigerian market\n\n"
    "When researching a prospect (contact), focus on:\n"
    "- Their role and decision-making authority\n"
    "- Professional background and priorities\n"
    "- Personalised talking points for outreach\n"
    "- Relevant pain points they likely face in their role\n\n"
    "Always provide evidence-based insights. Be specific and actionable. "
    "Avoid generic statements that could apply to any company or contact."
)

RESEARCH_CONTENT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "A concise 2-3 sentence overview of the research findings",
        },
        "key_facts": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key factual data points about the company or contact",
            "minItems": 1,
            "maxItems": 10,
        },
        "talking_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific conversation starters for sales outreach",
            "minItems": 1,
            "maxItems": 8,
        },
        "pain_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Likely pain points related to travel/MICE management",
            "minItems": 1,
            "maxItems": 6,
        },
        "opportunities": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific opportunities for selling travel/MICE services",
            "minItems": 1,
            "maxItems": 6,
        },
        "recent_news": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Recent news or developments relevant to travel/MICE engagement",
            "maxItems": 5,
        },
    },
    "required": ["summary", "key_facts", "talking_points", "pain_points", "opportunities"],
}


def build_company_research_prompt(company_data: dict) -> list[dict]:
    """
    Build the message list for company research.

    Args:
        company_data: dict with keys like name, industry, employee_count,
                      geography, domain, revenue_range, travel_intensity.

    Returns:
        List of message dicts for the LLM.
    """
    details_parts: list[str] = []

    company_name = company_data.get("name", "Unknown Company")
    details_parts.append(f"Company Name: {company_name}")

    industry = company_data.get("industry")
    if industry:
        details_parts.append(f"Industry: {industry}")

    sub_industry = company_data.get("sub_industry")
    if sub_industry:
        details_parts.append(f"Sub-Industry: {sub_industry}")

    employee_count = company_data.get("employee_count")
    if employee_count is not None:
        details_parts.append(f"Employee Count: {employee_count:,}")

    geography = company_data.get("geography")
    if geography:
        details_parts.append(f"Geography/Region: {geography}")

    country = company_data.get("country")
    if country:
        details_parts.append(f"Country: {country}")

    domain = company_data.get("domain")
    if domain:
        details_parts.append(f"Website Domain: {domain}")

    revenue_range = company_data.get("revenue_range")
    if revenue_range:
        details_parts.append(f"Revenue Range: {revenue_range}")

    travel_intensity = company_data.get("travel_intensity")
    if travel_intensity:
        details_parts.append(f"Travel Intensity: {travel_intensity}")

    details_text = "\n".join(f"- {part}" for part in details_parts)

    user_message = (
        "Produce a comprehensive research brief for the following company, "
        "focusing on insights relevant to selling corporate travel and MICE services.\n\n"
        f"Company Profile:\n{details_text}\n\n"
        "Include:\n"
        "1. A concise summary of the company and its relevance as a travel/MICE prospect\n"
        "2. Key facts that a sales representative should know\n"
        "3. Specific talking points for initial outreach\n"
        "4. Likely pain points around corporate travel and events management\n"
        "5. Concrete opportunities for a travel/MICE service provider\n"
        "6. Any recent news or developments (if known)\n\n"
        "Respond with structured data matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def build_prospect_research_prompt(
    contact_data: dict,
    company_data: dict,
) -> list[dict]:
    """
    Build the message list for prospect (contact) research.

    Args:
        contact_data: dict with keys like first_name, last_name, job_title,
                      persona_type, linkedin_url, email.
        company_data: dict with company details.

    Returns:
        List of message dicts for the LLM.
    """
    contact_parts: list[str] = []

    first_name = contact_data.get("first_name", "")
    last_name = contact_data.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or "Unknown Contact"
    contact_parts.append(f"Name: {full_name}")

    job_title = contact_data.get("job_title")
    if job_title:
        contact_parts.append(f"Job Title: {job_title}")

    persona_type = contact_data.get("persona_type")
    if persona_type:
        contact_parts.append(f"Persona Type: {persona_type}")

    linkedin_url = contact_data.get("linkedin_url")
    if linkedin_url:
        contact_parts.append(f"LinkedIn: {linkedin_url}")

    contact_text = "\n".join(f"- {part}" for part in contact_parts)

    company_parts: list[str] = []
    company_name = company_data.get("name", "Unknown Company")
    company_parts.append(f"Company: {company_name}")

    industry = company_data.get("industry")
    if industry:
        company_parts.append(f"Industry: {industry}")

    employee_count = company_data.get("employee_count")
    if employee_count is not None:
        company_parts.append(f"Employee Count: {employee_count:,}")

    geography = company_data.get("geography")
    if geography:
        company_parts.append(f"Geography: {geography}")

    company_text = "\n".join(f"- {part}" for part in company_parts)

    user_message = (
        "Produce a prospect research brief for the following contact, "
        "focusing on insights that will help personalize outreach for "
        "corporate travel and MICE services.\n\n"
        f"Contact Profile:\n{contact_text}\n\n"
        f"Company Context:\n{company_text}\n\n"
        "Include:\n"
        "1. A summary of this prospect's likely priorities and relevance\n"
        "2. Key facts about their role and decision-making authority\n"
        "3. Personalized talking points for outreach to this specific person\n"
        "4. Pain points they likely face in their role related to travel/events\n"
        "5. Opportunities to position travel/MICE services to address their needs\n\n"
        "Respond with structured data matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def build_talking_points_prompt(
    contact_data: dict,
    company_data: dict,
) -> list[dict]:
    """
    Build the message list for generating focused talking points.

    Args:
        contact_data: dict with contact details.
        company_data: dict with company details.

    Returns:
        List of message dicts for the LLM.
    """
    first_name = contact_data.get("first_name", "")
    last_name = contact_data.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or "the prospect"

    job_title = contact_data.get("job_title", "decision-maker")
    company_name = company_data.get("name", "the company")
    industry = company_data.get("industry", "their industry")

    user_message = (
        f"Generate a focused set of conversation starters and talking points "
        f"for reaching out to {full_name}, a {job_title} at {company_name} "
        f"(industry: {industry}).\n\n"
        "The talking points should be:\n"
        "- Specific to their role and company context\n"
        "- Relevant to corporate travel and MICE services\n"
        "- Designed to open a meaningful conversation\n"
        "- Not generic or templated\n\n"
        "Also include a brief summary, any key facts about the prospect/company, "
        "relevant pain points, and opportunities.\n\n"
        "Respond with structured data matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
