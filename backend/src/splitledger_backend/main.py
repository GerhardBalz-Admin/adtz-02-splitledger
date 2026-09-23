"""FastAPI application for SplitLedger.

Run with:  uv run uvicorn splitledger_backend.main:app --reload
"""

import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import MockDatabase
from .errors import install_error_handlers
from .routes import auth, expenses, groups
from .seed import seed_demo_data

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def create_app(db: MockDatabase | None = None) -> FastAPI:
    """Build the app around `db`; a new empty in-memory database when none is given."""
    app = FastAPI(
        title="SplitLedger API",
        version="0.1.0",
        description="Backend for SplitLedger. The contract is in openapi.yaml at the repository root.",
    )
    app.state.db = db if db is not None else MockDatabase()

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


def _default_database() -> MockDatabase:
    db = MockDatabase()
    if os.environ.get("SPLITLEDGER_DEMO_DATA", "1") != "0":
        seed_demo_data(db)
    return db


app = create_app(_default_database())
