import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.exceptions import AppException, app_exception_handler
from app.middleware.audit import AuditMiddleware
from app.middleware.response_wrapper import ResponseWrapperMiddleware
from app.utils.database import dispose_engine, get_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting SalesPilot backend...")
    # Eagerly initialise the database engine so connection issues surface immediately.
    get_engine()
    logger.info("Database engine initialised")
    yield
    logger.info("Shutting down SalesPilot backend...")
    await dispose_engine()
    logger.info("Database engine disposed")


def create_app() -> FastAPI:
    app = FastAPI(
        title="SalesPilot",
        description="Multi-agent AI outbound sales platform",
        version="0.1.0",
        lifespan=lifespan,
        redirect_slashes=False,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Audit middleware
    app.add_middleware(AuditMiddleware)

    # Response wrapper middleware – wraps JSON responses in {"data": ...}
    app.add_middleware(ResponseWrapperMiddleware)

    # Exception handlers
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]

    # Routes
    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": "salespilot-backend"}

    return app


app = create_app()
