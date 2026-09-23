"""FastAPI application for SplitLedger.

Run with:  uv run uvicorn splitledger_backend.main:app --reload
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import DEFAULT_DATABASE_URL, Database
from .errors import install_error_handlers
from .routes import auth, expenses, groups
from .seed import seed_demo_data

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def create_app(database: Database | None = None) -> FastAPI:
    """Build the app around `database`.

    Without one, the app opens the configured database when it starts and closes it when it stops.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if database is not None:
            yield
            return
        app.state.database = open_default_database()
        try:
            yield
        finally:
            app.state.database.dispose()

    app = FastAPI(
        title="SplitLedger API",
        version="0.1.0",
        description="Backend for SplitLedger. The contract is in openapi.yaml at the repository root.",
        lifespan=lifespan,
    )
    if database is not None:
        app.state.database = database

    origins = [o.strip() for o in os.environ.get("SPLITLEDGER_CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o for o in origins if o],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    install_error_handlers(app)

    api = APIRouter(prefix="/api")
    api.include_router(auth.router)
    api.include_router(groups.router)
    api.include_router(expenses.router)
    app.include_router(api)

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


def open_default_database() -> Database:
    """The database at SPLITLEDGER_DATABASE_URL, with the demo data added if it is new and empty."""
    database = Database(os.environ.get("SPLITLEDGER_DATABASE_URL", DEFAULT_DATABASE_URL))
    if os.environ.get("SPLITLEDGER_DEMO_DATA", "1") != "0":
        with database.store() as store, store.transaction():
            if store.is_empty():
                seed_demo_data(store)
    return database


app = create_app()
