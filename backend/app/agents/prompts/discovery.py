import json

SYSTEM_PROMPT = (
    "You are a B2B sales intelligence agent specialising in the Nigerian corporate "
    "travel and MICE (Meetings, Incentives, Conferences & Exhibitions) market. "
    "Your role is to identify Nigerian companies that match a given Ideal Customer Profile (ICP). "
    "You have deep knowledge of Nigerian businesses across industries, their travel patterns, "
    "company sizes, and presence in Nigerian cities.\n\n"
    "NIGERIAN INDUSTRY VERTICALS:\n"
    "- Oil & Gas (IOCs, Indigenous operators, Service companies)\n"
    "- Banking & Finance (Commercial banks, Insurance, Fintech)\n"
    "- Telecommunications (MNOs, Tower companies, ISPs)\n"
    "- Government / Parastatals (MDAs, State agencies, Regulators)\n"
    "- Manufacturing / FMCG (Consumer goods, Industrial, Agribusiness)\n"
    "- Technology (Software, Fintech, E-commerce)\n"
    "- Conglomerates (Diversified groups, Holdings)\n"
    "- Logistics & Transport (Shipping, Freight, Supply chain)\n"
    "- Professional Services (Consulting, Legal, Accounting)\n"
    "- Hospitality & Real Estate (Hotels, Property developers)\n\n"
    "MAJOR NIGERIAN BUSINESS HUBS:\n"
    "Lagos (Victoria Island, Ikoyi, Lekki, Ikeja), Abuja (CBD, Wuse, Maitama), "
    "Port Harcourt, Kano, Ibadan, Kaduna, Enugu, Warri, Calabar\n\n"
    "When suggesting companies, provide accurate and realistic information about "
    "real Nigerian companies. Focus on companies that genuinely match the ICP criteria. "
    "For each suggestion, include a brief reasoning explaining why the company "
    "is a good fit for the ICP."
)

COMPANY_SUGGESTION_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "companies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Full legal or commonly known company name",
                    },
                    "industry": {
                        "type": "string",
                        "description": "Primary industry classification",
                    },
                    "city": {
                        "type": "string",
                        "description": "Primary city in Nigeria (e.g. Lagos, Abuja, Port Harcourt)",
                    },
                    "employee_count": {
                        "type": "integer",
                        "description": "Estimated number of employees",
                    },
                    "revenue_range": {
                        "type": "string",
                        "description": "Estimated revenue range (e.g. '10M-50M', '100M-500M' in USD or Naira equivalent)",
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Brief explanation of why this company matches the ICP",
                    },
                    "domain": {
                        "type": "string",
                        "description": "Company website domain (e.g. 'example.com.ng')",
                    },
                    "travel_intensity": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "very_high"],
                        "description": "Estimated corporate travel intensity",
                    },
                },
                "required": [
                    "name",
                    "industry",
                    "city",
                    "employee_count",
                    "revenue_range",
                    "reasoning",
                ],
            },
            "minItems": 1,
            "maxItems": 25,
        },
    },
    "required": ["companies"],
}


SIZE_CATEGORIES = {
    "large": {
        "label": "Large Enterprise",
        "description": "Large corporations, multinationals, and major Nigerian enterprises",
        "employee_hint": "500+ employees",
        "revenue_hint": "$50M+ annual revenue",
        "examples": "Think of companies like Dangote, GTBank, MTN Nigeria, Shell Nigeria, etc.",
    },
    "sme": {
        "label": "SME (Small & Medium Enterprise)",
        "description": "Mid-sized Nigerian companies with established operations",
        "employee_hint": "50-499 employees",
        "revenue_hint": "$1M-$50M annual revenue",
        "examples": "Think of growing Nigerian companies, regional players, established local businesses.",
    },
    "small": {
        "label": "Small Business",
        "description": "Small but active Nigerian businesses with travel needs",
        "employee_hint": "10-49 employees",
        "revenue_hint": "Under $1M annual revenue",
        "examples": "Think of local firms, startups, boutique agencies, small consultancies with travel needs.",
    },
}


def build_discovery_prompt(filters: dict, size_category: str | None = None) -> list[dict]:
    """
    Build the message list for the discovery agent.

    Args:
        filters: ICP filter dict with keys like industry, city,
                 revenue_min, revenue_max, employee_min, employee_max,
                 travel_intensity, custom_tags.
        size_category: Optional size category - "large", "sme", or "small".
                      If provided, overrides employee/revenue filters with
                      category-appropriate ranges.

    Returns:
        List of message dicts for the LLM.
    """
    criteria_parts: list[str] = []

    industries = filters.get("industry", [])
    if industries:
        criteria_parts.append(f"Industries: {', '.join(industries)}")

    cities = filters.get("city", filters.get("geography", []))
    if cities:
        criteria_parts.append(f"Nigerian Cities: {', '.join(cities)}")

    # If size_category is specified, use category-specific ranges
    if size_category and size_category in SIZE_CATEGORIES:
        cat = SIZE_CATEGORIES[size_category]
        criteria_parts.append(f"Company Size: {cat['label']} ({cat['employee_hint']})")
        criteria_parts.append(f"Revenue: {cat['revenue_hint']}")
    else:
        employee_min = filters.get("employee_min")
        employee_max = filters.get("employee_max")
        if employee_min is not None or employee_max is not None:
            size_str = "Employee count: "
            if employee_min is not None and employee_max is not None:
                size_str += f"{employee_min:,} - {employee_max:,}"
            elif employee_min is not None:
                size_str += f"at least {employee_min:,}"
            else:
                size_str += f"up to {employee_max:,}"
            criteria_parts.append(size_str)

        revenue_min = filters.get("revenue_min")
        revenue_max = filters.get("revenue_max")
        if revenue_min is not None or revenue_max is not None:
            rev_str = "Revenue range: "
            if revenue_min is not None and revenue_max is not None:
                rev_str += f"${revenue_min:,} - ${revenue_max:,}"
            elif revenue_min is not None:
                rev_str += f"at least ${revenue_min:,}"
            else:
                rev_str += f"up to ${revenue_max:,}"
            criteria_parts.append(rev_str)

    travel_intensities = filters.get("travel_intensity", [])
    if travel_intensities:
        criteria_parts.append(
            f"Travel intensity levels: {', '.join(travel_intensities)}"
        )

    custom_tags = filters.get("custom_tags", [])
    if custom_tags:
        criteria_parts.append(f"Additional criteria/tags: {', '.join(custom_tags)}")

    criteria_text = "\n".join(f"- {part}" for part in criteria_parts)

    if not criteria_text:
        criteria_text = "- No specific criteria provided. Suggest diverse Nigerian B2B companies with significant corporate travel needs."

    # Build size-specific instruction
    size_instruction = ""
    if size_category and size_category in SIZE_CATEGORIES:
        cat = SIZE_CATEGORIES[size_category]
        size_instruction = (
            f"\n\nIMPORTANT: Focus ONLY on {cat['label']} companies. "
            f"{cat['description']}. {cat['examples']} "
            f"All companies should have approximately {cat['employee_hint']} "
            f"and {cat['revenue_hint']}. "
            f"Do NOT include companies from other size categories."
        )

    user_message = (
        "Based on the following Ideal Customer Profile (ICP) criteria, "
        "suggest up to 20 Nigerian companies that would be strong matches. "
        "All companies must be based in or have significant operations in Nigeria. "
        "For each company, provide the name, industry, city in Nigeria, "
        "estimated employee count, estimated revenue range, website domain, "
        "estimated travel intensity, and a brief reasoning."
        f"{size_instruction}\n\n"
        f"ICP Criteria:\n{criteria_text}\n\n"
        "CRITICAL REQUIREMENTS:\n"
        "1. ONLY suggest companies you are CERTAIN exist in real life. "
        "Do NOT invent company names that sound plausible but may not exist.\n"
        "2. ONLY provide a domain if you are certain of the correct URL. "
        "If unsure, leave the domain empty rather than guessing.\n"
        "3. For small businesses and SMEs: only include companies with "
        "public presence (news mentions, LinkedIn company pages, press releases, "
        "government registries). If you cannot recall specific small Nigerian "
        "companies that match, return fewer results rather than making up names.\n"
        "4. Prefer companies with verifiable public information over plausible-sounding guesses.\n"
        "5. Do NOT repeat companies that are commonly suggested. Try to include "
        "less obvious but VERIFIED real matches.\n\n"
        "Respond with structured data matching the required schema. "
        "It is better to return 5 real companies than 20 with half made up."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
