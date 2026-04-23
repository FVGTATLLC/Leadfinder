from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.campaigns import router as campaigns_router
from app.api.v1.gmail import router as gmail_router
from app.api.v1.companies import router as companies_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.exports import router as exports_router
from app.api.v1.messages import router as messages_router
from app.api.v1.research import router as research_router
from app.api.v1.settings import router as settings_router
from app.api.v1.strategies import router as strategies_router
from app.api.v1.teams import router as teams_router
from app.api.v1.users import router as users_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(teams_router)
api_router.include_router(gmail_router)
api_router.include_router(strategies_router)
api_router.include_router(companies_router)
api_router.include_router(contacts_router)
api_router.include_router(research_router)
api_router.include_router(campaigns_router)
api_router.include_router(messages_router)
api_router.include_router(analytics_router)
api_router.include_router(exports_router)
api_router.include_router(settings_router)
