# SalesPilot — Agent Design Document

## LLM Abstraction Layer

All LLM interactions are routed through a provider-agnostic abstraction layer.

### Provider Interface (`agents/llm/provider.py`)

The `LLMProvider` abstract base class defines two methods:
- `complete()` — Standard chat completion returning text
- `complete_structured()` — Chat completion expecting structured JSON output

### Implementations
- `ClaudeProvider` — Anthropic Claude (claude-sonnet-4-20250514, claude-haiku-4-20250514)
- `OpenAIProvider` — OpenAI (gpt-4o, gpt-4o-mini)

### LLM Router (`agents/llm/router.py`)

The router selects the appropriate provider and model based on task type. It supports automatic fallback: if the primary provider fails, the request is retried with the fallback provider/model.

### Task-Model Mapping (`agents/llm/config.py`)

Each task type maps to a specific provider, model, and configuration:

| Task               | Primary          | Fallback     | Temperature |
|--------------------|------------------|--------------|-------------|
| discovery          | Claude Sonnet    | GPT-4o       | 0.7         |
| persona_mapping    | Claude Sonnet    | GPT-4o       | 0.5         |
| research           | GPT-4o           | Claude Sonnet| 0.3         |
| messaging_intro    | Claude Sonnet    | GPT-4o       | 0.8         |
| messaging_followup | Claude Sonnet    | GPT-4o       | 0.8         |
| analytics_insight  | GPT-4o Mini      | Claude Haiku | 0.3         |

Rationale: Creative tasks (messaging) use higher temperatures; analytical tasks (research, analytics) use lower temperatures. Claude is preferred for writing quality; OpenAI for structured data extraction.

## Agent Architecture

### Base Agent (`agents/base.py`)

All LLM-powered agents extend `BaseAgent`, which provides:
- `llm_router` — Access to the LLM routing layer
- `db_session` — Database session for persistence
- `execute(input_data)` — Abstract method each agent implements
- `log_execution()` — Audit logging for all agent runs

Returns `AgentResult` with: success, data, tokens_used, model_used, error.

## Agent Descriptions and Responsibilities

### 1. Discovery Agent (`discovery_agent.py`)
**Purpose**: Identify and score potential target companies matching an ICP strategy.

**Input**: Strategy filters (industry, geography, size, travel intensity)
**Output**: List of scored companies with ICP match rationale

**Process**:
1. Receives ICP filter criteria
2. Constructs prompt with industry context and scoring rubric
3. LLM generates company suggestions with scores and reasoning
4. Results parsed and stored as Company records
5. StrategyCompany links created automatically

### 2. Persona Agent (`persona_agent.py`)
**Purpose**: Map contacts to buyer persona types for targeted messaging.

**Input**: Contact details (name, title, company info)
**Output**: Persona classification (executive, decision_maker, champion, influencer)

**Process**:
1. Analyzes job title, seniority, and department signals
2. Cross-references with company size and industry patterns
3. Assigns persona type with confidence score
4. Updates contact record with persona classification

### 3. Enrichment Agent (`enrichment_agent.py`)
**Purpose**: Enrich contact and company data from available signals.

**Input**: Partial contact/company data
**Output**: Enriched fields (verified email patterns, inferred details)

**Process**:
1. Takes existing partial data
2. Uses LLM to infer missing fields based on patterns
3. Generates email format predictions based on company domain
4. Updates enrichment_status to "enriched" on success

### 4. Research Agent (`research_agent.py`)
**Purpose**: Generate contextual research briefs for outreach preparation.

**Input**: Company and contact data, brief type
**Output**: Research brief with summary, talking points, and pain points

**Process**:
1. Aggregates available company and contact data
2. Constructs research prompt with industry context
3. LLM generates structured brief (summary, talking_points, pain_points)
4. Brief stored in research_briefs table with expiration date (30 days)

### 5. Messaging Agent (`messaging_agent.py`)
**Purpose**: Generate personalized outreach email drafts.

**Input**: Contact, company, research brief, campaign settings, previous messages
**Output**: Email subject and body tailored to the prospect

**Process**:
1. Receives full prospect context (contact, company, research, history)
2. Selects prompt template based on campaign_type and step_number
3. Applies tone_preset (consultative, professional, casual, etc.)
4. For follow-ups, incorporates previous message context
5. Generates subject line and body with personalization tokens resolved
6. Returns draft for approval or auto-approval

### 6. Analytics Agent (`analytics_agent.py`)
**Purpose**: Generate natural-language insights from pipeline metrics.

**Input**: Aggregated metrics (open rates, reply rates, conversion data)
**Output**: Written insights and recommendations

**Process**:
1. Receives numerical metrics from analytics service
2. LLM interprets trends and patterns
3. Generates actionable recommendations
4. Returns structured insights for dashboard display

### 7. CRM Agent (`crm_agent.py`)
**Purpose**: Prepare and format data for CRM synchronization.

**Input**: Company/contact records, CRM target configuration
**Output**: CRM-ready payloads in the target format

## Orchestrator Agent (`orchestrator_agent.py`)

The orchestrator is NOT an LLM agent. It is a state-machine coordinator invoked periodically by Celery Beat.

### Orchestration Flow

```
Celery Beat (every N minutes)
    |
    v
OrchestratorAgent.tick()
    |
    +---> 1. Get active campaigns
    |         |
    |         +---> For each campaign:
    |                   |
    |                   +---> Get sequence steps
    |                   +---> Get active campaign_contacts
    |                   +---> For each contact:
    |                           |
    |                           +---> Check delay elapsed?
    |                           +---> Ensure research brief exists
    |                           |       (call ResearchAgent if needed)
    |                           +---> Generate message draft
    |                           |       (call MessagingAgent)
    |                           +---> Advance current_step pointer
    |                           +---> Check for replies
    |
    +---> 2. Send approved messages
    |         |
    |         +---> Query status='approved' + due messages
    |         +---> Send via SMTP
    |         +---> Update status to 'sent' or 'failed'
    |
    +---> 3. Complete finished campaigns
              |
              +---> Find campaigns with no active contacts
              +---> Mark as 'completed'
```

### Key Decisions
- **Delay enforcement**: Each sequence step has a `delay_days` value. The orchestrator only advances a contact if enough time has passed since their last sent message.
- **Auto-approval**: If a campaign has been approved by a manager (`approved_by` is set), generated messages are auto-approved. Otherwise, they enter `pending_approval` status for manual review.
- **Reply detection**: Messages marked as `replied` cause the corresponding campaign_contact to be moved to `replied` status, stopping further outreach.

## Prompt Engineering Approach

Prompts are organized in `agents/prompts/` with one module per domain:
- `discovery.py` — Company discovery and scoring prompts
- `persona.py` — Persona classification prompts
- `research.py` — Research brief generation prompts
- `messaging.py` — Email draft generation prompts
- `analytics.py` — Insight generation prompts

### Prompt Design Principles
1. **Structured output**: All prompts request JSON output with defined schemas
2. **Context injection**: Relevant data (company, contact, history) injected as structured context blocks
3. **Role framing**: System messages establish the agent's expertise and constraints
4. **Few-shot examples**: Critical prompts include example outputs for consistency
5. **Guardrails**: Prompts include explicit constraints (word limits, tone requirements, prohibited content)

## Configuration

Runtime model selection is configured in `agents/llm/config.py`. The `TASK_MODEL_MAP` dictionary allows changing providers, models, and parameters without code changes. In production, these values can be overridden via environment variables or the admin settings endpoint.
