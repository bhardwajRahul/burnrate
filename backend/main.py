"""FastAPI entry point for burnrate credit card analytics backend."""

import logging
import sys
from pathlib import Path

# Ensure project root is in path for backend imports
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.models.database import SessionLocal, init_db
from backend.models.models import Settings
from backend.routers import analytics, cards, settings, statements, transactions
from backend.routers.settings import get_watcher_observer, set_watcher_observer
from backend.services.folder_watcher import start_watcher, stop_watcher

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    init_db()

    db = SessionLocal()
    try:
        s = db.query(Settings).first()
        if s and s.watch_folder:
            observer = start_watcher(s.watch_folder, db_session_factory=SessionLocal)
            if observer:
                set_watcher_observer(observer)
                logger.info("Folder watcher started on %s", s.watch_folder)
            else:
                logger.warning("Failed to start folder watcher for %s", s.watch_folder)
        else:
            logger.info("No watch_folder configured, skipping folder watcher")
    finally:
        db.close()

    yield

    observer = get_watcher_observer()
    if observer:
        stop_watcher(observer)
        set_watcher_observer(None)


app = FastAPI(title="Burnrate Credit Card Analytics", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:6006",
        "http://localhost:6007",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(statements.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

# Mount static files for future React build
static_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
