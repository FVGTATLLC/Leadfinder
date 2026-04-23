SYSTEM_PROMPT = (
    "You are an expert B2B sales copywriter specialising in the Nigerian corporate "
    "travel management and MICE (Meetings, Incentives, Conferences, Events) market.\n\n"
    "You work for a travel management company focused on the Nigerian market, offering "
    "corporate travel solutions, MICE event management, visa facilitation services, "
    "and travel technology platforms. Key strengths include local presence in Lagos and "
    "Abuja, Naira billing options, knowledge of Nigerian airlines and routes, and "
    "on-ground support across Nigeria.\n\n"
    "Your goal is to write compelling, personalized outreach emails that:\n"
    "- Feel genuine and human, not robotic or templated\n"
    "- Reference specific details about the recipient and their company\n"
    "- Clearly articulate the value proposition relevant to their needs\n"
    "- Include a single, clear call-to-action\n"
    "- Are concise (under 200 words for the email body)\n"
    "- Respect the recipient's time and intelligence\n\n"
    "Never use clickbait, misleading subject lines, or high-pressure tactics. "
    "Always maintain a professional tone appropriate to B2B communication."
)

TONE_INSTRUCTIONS: dict[str, str] = {
    "formal": (
        "Write in a formal, professional tone. Use complete sentences, proper "
        "salutations (Dear Mr./Ms.), and structured paragraphs. Avoid contractions, "
        "slang, or overly casual language. Maintain a respectful distance while being "
        "warm and approachable."
    ),
    "friendly": (
        "Write in a warm, conversational tone. Use the recipient's first name, "
        "contractions are fine, and keep the language approachable. Feel free to use "
        "light humor where appropriate. The email should read like a note from a "
        "trusted colleague, not a cold sales pitch."
    ),
    "consultative": (
        "Write in a consultative, advisory tone. Position yourself as a knowledgeable "
        "partner who understands their challenges. Lead with insights and questions "
        "rather than product features. Show genuine curiosity about their needs and "
        "offer to share expertise."
    ),
    "aggressive": (
        "Write in a direct, results-oriented tone. Lead with a bold statement or "
        "compelling statistic. Be assertive about the value proposition and create "
        "urgency around taking action. Keep sentences short and impactful. End with "
        "a strong, specific call-to-action."
    ),
}

MESSAGE_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "subject": {
            "type": "string",
            "description": "Email subject line, concise and compelling, under 60 characters",
        },
        "body": {
            "type": "string",
            "description": "Email body text, under 200 words, with clear CTA",
        },
        "variant_label": {
            "type": "string",
            "description": "A short label for this message variant, e.g. intro_v1, follow_up_2",
        },
    },
    "required": ["subject", "body", "variant_label"],
}


def _format_contact_info(contact: dict) -> str:
    """Format contact details into a readable string for prompts."""
    parts: list[str] = []
    name = contact.get("name", "the prospect")
    if name:
        parts.append(f"Name: {name}")
    title = contact.get("title")
    if title:
        parts.append(f"Title: {title}")
    email = contact.get("email")
    if email:
        parts.append(f"Email: {email}")
    persona = contact.get("persona_type")
    if persona:
        parts.append(f"Persona Type: {persona}")
    return "\n".join(f"- {p}" for p in parts)


def _format_company_info(company: dict) -> str:
    """Format company details into a readable string for prompts."""
    parts: list[str] = []
    name = company.get("name")
    if name:
        parts.append(f"Company: {name}")
    industry = company.get("industry")
    if industry:
        parts.append(f"Industry: {industry}")
    city = company.get("city")
    if city:
        parts.append(f"City: {city}")
    size = company.get("size")
    if size is not None:
        parts.append(f"Employee Count: {size:,}" if isinstance(size, int) else f"Employee Count: {size}")
    return "\n".join(f"- {p}" for p in parts)


def _format_research_info(research: dict | None) -> str:
    """Format research brief into a readable string for prompts."""
    if not research:
        return "No research data available. Use general industry knowledge."

    parts: list[str] = []
    summary = research.get("summary")
    if summary:
        parts.append(f"Summary: {summary}")

    talking_points = research.get("talking_points", [])
    if talking_points:
        tp_text = "; ".join(talking_points[:5])
        parts.append(f"Talking Points: {tp_text}")

    pain_points = research.get("pain_points", [])
    if pain_points:
        pp_text = "; ".join(pain_points[:5])
        parts.append(f"Pain Points: {pp_text}")

    return "\n".join(f"- {p}" for p in parts) if parts else "No research data available."


def build_intro_message_prompt(
    contact: dict,
    company: dict,
    research: dict | None,
    tone: str,
) -> list[dict]:
    """Build prompt for initial outreach / introduction email."""
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["consultative"])
    contact_info = _format_contact_info(contact)
    company_info = _format_company_info(company)
    research_info = _format_research_info(research)

    contact_name = contact.get("name", "the prospect")

    user_message = (
        f"Write a first-touch introduction email to {contact_name}.\n\n"
        f"CONTACT DETAILS:\n{contact_info}\n\n"
        f"COMPANY DETAILS:\n{company_info}\n\n"
        f"RESEARCH INSIGHTS:\n{research_info}\n\n"
        f"TONE: {tone}\n{tone_instruction}\n\n"
        "REQUIREMENTS:\n"
        "1. Personalise the subject line to the recipient or their company\n"
        "2. Open with something specific to them (not a generic greeting)\n"
        "3. Briefly introduce our corporate travel and MICE capabilities relevant to Nigerian companies\n"
        "4. Reference a specific pain point or opportunity from the research\n"
        "5. End with a clear, low-commitment CTA (e.g., 15-minute call, share a case study)\n"
        "6. Keep the body under 200 words\n"
        "7. Do NOT include any placeholder brackets like [Name] — use actual details\n\n"
        "Respond with structured JSON matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def build_followup_message_prompt(
    contact: dict,
    company: dict,
    research: dict | None,
    tone: str,
    step_number: int,
    previous_messages: list[dict] | None,
) -> list[dict]:
    """Build prompt for follow-up emails."""
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["consultative"])
    contact_info = _format_contact_info(contact)
    company_info = _format_company_info(company)
    research_info = _format_research_info(research)

    contact_name = contact.get("name", "the prospect")

    prev_context = "No previous messages sent yet."
    if previous_messages:
        prev_parts = []
        for i, msg in enumerate(previous_messages[:3], 1):
            subj = msg.get("subject", "No subject")
            body_preview = msg.get("body", "")[:150]
            prev_parts.append(f"  Email #{i}: Subject: {subj}\n  Preview: {body_preview}...")
        prev_context = "\n".join(prev_parts)

    user_message = (
        f"Write follow-up email #{step_number} to {contact_name}.\n\n"
        f"CONTACT DETAILS:\n{contact_info}\n\n"
        f"COMPANY DETAILS:\n{company_info}\n\n"
        f"RESEARCH INSIGHTS:\n{research_info}\n\n"
        f"PREVIOUS OUTREACH:\n{prev_context}\n\n"
        f"TONE: {tone}\n{tone_instruction}\n\n"
        "REQUIREMENTS:\n"
        "1. Reference previous outreach without being pushy or guilt-tripping\n"
        "2. Offer a new angle, insight, or piece of value\n"
        "3. Keep it shorter than the initial email\n"
        "4. If this is follow-up #2+, increase urgency slightly but respectfully\n"
        "5. Include a different CTA than previous emails\n"
        "6. Keep the body under 150 words\n"
        "7. Do NOT include any placeholder brackets — use actual details\n\n"
        "Respond with structured JSON matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def build_mice_pitch_prompt(
    contact: dict,
    company: dict,
    research: dict | None,
    tone: str,
) -> list[dict]:
    """Build prompt for MICE-specific pitch emails."""
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["consultative"])
    contact_info = _format_contact_info(contact)
    company_info = _format_company_info(company)
    research_info = _format_research_info(research)

    contact_name = contact.get("name", "the prospect")

    user_message = (
        f"Write a MICE (Meetings, Incentives, Conferences, Events) focused pitch "
        f"email to {contact_name}.\n\n"
        f"CONTACT DETAILS:\n{contact_info}\n\n"
        f"COMPANY DETAILS:\n{company_info}\n\n"
        f"RESEARCH INSIGHTS:\n{research_info}\n\n"
        f"TONE: {tone}\n{tone_instruction}\n\n"
        "MICE CAPABILITIES:\n"
        "- End-to-end event management across Nigeria and internationally\n"
        "- Venue sourcing and negotiation in Lagos, Abuja, and major Nigerian cities\n"
        "- Delegate management and registration\n"
        "- Travel logistics coordination including local and international flights\n"
        "- Budget optimisation with Naira billing (avg 15-25% cost savings)\n"
        "- On-ground support and event production\n"
        "- Post-event analytics and ROI reporting\n\n"
        "REQUIREMENTS:\n"
        "1. Focus specifically on their events/meetings needs\n"
        "2. Reference any relevant industry events or trends in Nigeria\n"
        "3. Highlight a specific MICE capability relevant to them\n"
        "4. Include a concrete example or metric (e.g., cost savings percentage)\n"
        "5. CTA should be meeting-focused (e.g., discuss upcoming events)\n"
        "6. Keep the body under 200 words\n"
        "7. Do NOT include any placeholder brackets — use actual details\n\n"
        "Respond with structured JSON matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def build_corporate_pitch_prompt(
    contact: dict,
    company: dict,
    research: dict | None,
    tone: str,
) -> list[dict]:
    """Build prompt for corporate travel management pitch emails."""
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["consultative"])
    contact_info = _format_contact_info(contact)
    company_info = _format_company_info(company)
    research_info = _format_research_info(research)

    contact_name = contact.get("name", "the prospect")

    user_message = (
        f"Write a corporate travel management pitch email to {contact_name}.\n\n"
        f"CONTACT DETAILS:\n{contact_info}\n\n"
        f"COMPANY DETAILS:\n{company_info}\n\n"
        f"RESEARCH INSIGHTS:\n{research_info}\n\n"
        f"TONE: {tone}\n{tone_instruction}\n\n"
        "CORPORATE TRAVEL CAPABILITIES:\n"
        "- Corporate travel management across Nigeria and international destinations\n"
        "- 24/7 traveller support and duty of care\n"
        "- Travel policy compliance and enforcement\n"
        "- Online booking tool and mobile app\n"
        "- Negotiated rates with Nigerian airlines, hotels, and ground transport\n"
        "- Naira-denominated billing and expense management\n"
        "- Travel data analytics and reporting\n"
        "- Visa and immigration support for Nigerian travellers\n\n"
        "REQUIREMENTS:\n"
        "1. Focus on travel management pain points specific to their industry in Nigeria\n"
        "2. Quantify potential benefits where possible (cost savings, time savings)\n"
        "3. Mention relevant capabilities based on their company profile\n"
        "4. Position us as a strategic partner, not just a vendor\n"
        "5. CTA should be consultative (e.g., travel programme assessment)\n"
        "6. Keep the body under 200 words\n"
        "7. Do NOT include any placeholder brackets — use actual details\n\n"
        "Respond with structured JSON matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def build_custom_message_prompt(
    contact: dict,
    company: dict,
    research: dict | None,
    tone: str,
    additional_context: str | None,
) -> list[dict]:
    """Build prompt for custom / freeform message generation."""
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["consultative"])
    contact_info = _format_contact_info(contact)
    company_info = _format_company_info(company)
    research_info = _format_research_info(research)

    contact_name = contact.get("name", "the prospect")

    custom_section = ""
    if additional_context:
        custom_section = f"\nADDITIONAL CONTEXT / INSTRUCTIONS:\n{additional_context}\n"

    user_message = (
        f"Write a personalised outreach email to {contact_name}.\n\n"
        f"CONTACT DETAILS:\n{contact_info}\n\n"
        f"COMPANY DETAILS:\n{company_info}\n\n"
        f"RESEARCH INSIGHTS:\n{research_info}\n\n"
        f"TONE: {tone}\n{tone_instruction}\n"
        f"{custom_section}\n"
        "REQUIREMENTS:\n"
        "1. Personalise the message to the recipient\n"
        "2. Reference our relevant corporate travel and MICE services for the Nigerian market\n"
        "3. Include a clear value proposition\n"
        "4. End with a specific CTA\n"
        "5. Keep the body under 200 words\n"
        "6. Do NOT include any placeholder brackets — use actual details\n\n"
        "Respond with structured JSON matching the required schema."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
