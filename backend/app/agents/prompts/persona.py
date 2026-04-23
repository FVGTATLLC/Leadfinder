SYSTEM_PROMPT = (
    "You are a B2B sales intelligence researcher specializing in identifying "
    "REAL decision-makers at target companies for corporate travel and MICE "
    "(Meetings, Incentives, Conferences & Exhibitions) services.\n\n"
    "Your role is to research and find ACTUAL people who work at the given company. "
    "You should leverage your knowledge of publicly available information including "
    "LinkedIn profiles, company websites, news articles, press releases, and "
    "industry directories to identify real individuals.\n\n"
    "For each person you identify:\n"
    "1. Provide their REAL first name and last name (not generic placeholders)\n"
    "2. Provide their actual job title\n"
    "3. Provide their likely business email (use the company's email format, "
    "   typically firstname.lastname@domain.com or f.lastname@domain.com)\n"
    "4. Provide their LinkedIn profile URL if you can determine it\n"
    "5. Provide the city and country where they are likely based\n\n"
    "If you cannot find a specific real person for a role, provide your best "
    "estimate of who would hold that position based on the company's size, "
    "industry, and location. Since all target companies are Nigerian, use "
    "culturally appropriate Nigerian names (Yoruba, Igbo, Hausa, or other "
    "Nigerian naming conventions based on the company's location).\n\n"
    "Common relevant roles for corporate travel sales:\n"
    "- Procurement Head: Manages vendor selection and purchasing\n"
    "- Travel Manager: Oversees corporate travel programs\n"
    "- Admin/Office Manager: Coordinates logistics and office operations\n"
    "- CFO/Finance Head: Controls budgets and cost optimization\n"
    "- CEO/Managing Director: Final decision-maker in smaller companies\n"
    "- HR Head: Manages employee travel policies and incentive programs\n"
    "- Operations Director: Oversees day-to-day operations including travel\n\n"
    "IMPORTANT: Always try to provide real names. Use your knowledge of the "
    "company's leadership team from news, LinkedIn, and public records."
)

PERSONA_SUGGESTION_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "personas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "first_name": {
                        "type": "string",
                        "description": "Person's real first name (REQUIRED - never leave empty)",
                    },
                    "last_name": {
                        "type": "string",
                        "description": "Person's real last name (REQUIRED - never leave empty)",
                    },
                    "job_title": {
                        "type": "string",
                        "description": "Their actual job title at the company",
                    },
                    "email": {
                        "type": "string",
                        "description": "Likely business email address (e.g. firstname.lastname@companydomain.com)",
                    },
                    "phone": {
                        "type": "string",
                        "description": "Business phone number with country code if known, otherwise null",
                    },
                    "linkedin_url": {
                        "type": "string",
                        "description": "LinkedIn profile URL (e.g. https://linkedin.com/in/firstname-lastname)",
                    },
                    "city": {
                        "type": "string",
                        "description": "City where this person is based",
                    },
                    "country": {
                        "type": "string",
                        "description": "Country where this person is based",
                    },
                    "persona_type": {
                        "type": "string",
                        "enum": [
                            "procurement_head",
                            "admin",
                            "cfo",
                            "travel_manager",
                            "ceo",
                            "hr_head",
                            "other",
                        ],
                        "description": "Category of the persona",
                    },
                    "confidence_score": {
                        "type": "number",
                        "minimum": 0.0,
                        "maximum": 1.0,
                        "description": "Confidence in the accuracy of this contact (0.0-1.0). "
                        "Use 0.9+ if you know this is a real person from public records, "
                        "0.7-0.89 if estimated based on company info, "
                        "0.5-0.69 if this is a best guess.",
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Brief note on why this person is relevant and how you identified them",
                    },
                    "seniority": {
                        "type": "string",
                        "enum": ["c_suite", "vp", "director", "manager", "senior", "entry"],
                        "description": "Seniority level of this person",
                    },
                },
                "required": [
                    "first_name",
                    "last_name",
                    "job_title",
                    "persona_type",
                    "confidence_score",
                    "reasoning",
                ],
            },
            "minItems": 3,
            "maxItems": 10,
        },
    },
    "required": ["personas"],
}


def build_persona_prompt(company_data: dict) -> list[dict]:
    """Build the message list for the persona discovery agent."""
    details_parts: list[str] = []

    company_name = company_data.get("company_name", "Unknown Company")
    details_parts.append(f"Company Name: {company_name}")

    industry = company_data.get("industry")
    if industry:
        details_parts.append(f"Industry: {industry}")

    employee_count = company_data.get("employee_count")
    if employee_count is not None:
        details_parts.append(f"Employee Count: {employee_count:,}")

    geography = company_data.get("geography")
    if geography:
        details_parts.append(f"Geography/Region: {geography}")

    domain = company_data.get("domain")
    if domain:
        details_parts.append(f"Website Domain: {domain}")

    details_text = "\n".join(f"- {part}" for part in details_parts)

    email_hint = ""
    if domain:
        email_hint = (
            f"\n\nEmail format hint: The company's domain is {domain}. "
            f"Common email formats are: firstname.lastname@{domain}, "
            f"f.lastname@{domain}, or firstname@{domain}. "
            f"Use the most likely format for this company's region and size."
        )

    user_message = (
        f"Research the following company and identify REAL decision-makers "
        f"who would be relevant for selling corporate travel and MICE services.\n\n"
        f"Company Profile:\n{details_text}\n\n"
        f"IMPORTANT INSTRUCTIONS:\n"
        f"1. Provide REAL names of actual people at this company whenever possible\n"
        f"2. Search your knowledge for the company's leadership team, executives, "
        f"and key department heads from news articles, press releases, LinkedIn, "
        f"and company websites\n"
        f"3. For each person, provide their REAL business email if you know it "
        f"from public sources. If you do not know the actual email, first determine "
        f"the email format the company uses (e.g., firstname.lastname@domain, "
        f"first initial + lastname@domain, firstname@domain) by checking known "
        f"emails from that company, then generate the email using that format. "
        f"IMPORTANT: Only provide the SINGLE most likely email, not multiple guesses\n"
        f"4. Provide their LinkedIn URL in the format: "
        f"https://linkedin.com/in/firstname-lastname\n"
        f"5. Include the city and country where they're likely based\n"
        f"6. Use culturally appropriate names matching the company's home country\n"
        f"7. Identify 6-8 key contacts across different departments\n"
        f"8. Set confidence_score to 0.9+ ONLY if you are certain of the person's "
        f"real identity and email from public records. Use 0.6-0.7 for estimated emails"
        f"{email_hint}\n\n"
        f"Respond with structured data matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
