import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog


@dataclass
class AgentResult:
    success: bool
    data: dict = field(default_factory=dict)
    tokens_used: int = 0
    model_used: str = ""
    error: str | None = None


class BaseAgent(ABC):
    """Abstract base class for all LLM-powered agents."""

    def __init__(self, llm_router: "LLMRouter", db_session: AsyncSession) -> None:  # noqa: F821
        self.llm_router = llm_router
        self.db_session = db_session

    @abstractmethod
    async def execute(self, input_data: dict) -> AgentResult:
        """Execute the agent's primary task."""
        ...

    async def log_execution(
        self,
        task_type: str,
        input_data: dict,
        result: AgentResult,
        tokens_used: int,
        model_used: str,
        user_id: uuid.UUID | None = None,
    ) -> None:
        """Log agent execution to the activity log."""
        log_entry = ActivityLog(
            user_id=user_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
            action=f"agent_execution:{task_type}",
            entity_type="agent",
            entity_id=uuid.uuid4(),
            details={
                "task_type": task_type,
                "model_used": model_used,
                "tokens_used": tokens_used,
                "success": result.success,
                "error": result.error,
                "input_summary": {
                    k: str(v)[:200] for k, v in input_data.items()
                },
            },
        )
        self.db_session.add(log_entry)
        await self.db_session.flush()
