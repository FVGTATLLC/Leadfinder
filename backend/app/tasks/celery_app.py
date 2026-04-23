from celery import Celery

from app.config import settings

celery_app = Celery(
    "salespilot",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.autodiscover_tasks(["app.tasks"])

celery_app.conf.beat_schedule = {
    "tick-orchestrator": {
        "task": "app.tasks.campaign_tasks.tick_orchestrator",
        "schedule": 900.0,  # every 15 minutes
    },
    "send-approved-messages": {
        "task": "app.tasks.campaign_tasks.send_approved_messages",
        "schedule": 300.0,  # every 5 minutes
    },
    "send-scheduled-messages": {
        "task": "app.tasks.message_tasks.send_scheduled_messages_task",
        "schedule": 300.0,  # every 5 minutes
    },
}
