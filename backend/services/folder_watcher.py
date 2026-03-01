"""Folder watcher for auto-importing new statement PDFs."""

import logging
import time
from pathlib import Path
from typing import Callable, Optional

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from backend.services.statement_processor import process_statement

logger = logging.getLogger(__name__)

_watcher_observer: Optional[Observer] = None


def _log_processing_result(db_session_factory: Callable, file_name: str, result: dict) -> None:
    """Persist a processing result for frontend polling."""
    from backend.models.models import ProcessingLog

    db = db_session_factory()
    try:
        log = ProcessingLog(
            file_name=file_name,
            status=result.get("status", "error"),
            message=result.get("message", ""),
            bank=result.get("bank"),
            transaction_count=result.get("count", 0),
        )
        db.add(log)
        db.commit()
    except Exception:
        logger.exception("Failed to write processing log for %s", file_name)
        db.rollback()
    finally:
        db.close()


def _wait_for_file_stable(path: Path, timeout: float = 15.0, interval: float = 0.5) -> bool:
    """Wait until the file size stops changing, indicating the write is complete."""
    last_size = -1
    stable_start = time.monotonic()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            size = path.stat().st_size
            if size == last_size and size > 0:
                if time.monotonic() - stable_start >= 1.5:
                    return True
            else:
                last_size = size
                stable_start = time.monotonic()
        except OSError:
            pass
        time.sleep(interval)
    return False


class StatementWatchHandler(FileSystemEventHandler):
    """Handler for new PDF files in watch directory."""

    def __init__(self, db_session_factory: Callable):
        super().__init__()
        self.db_session_factory = db_session_factory

    def _process_pdf(self, path: Path):
        """Wait for file to stabilize then process it."""
        logger.info("Detected new PDF: %s", path.name)

        if not _wait_for_file_stable(path):
            logger.warning("File %s did not stabilize within timeout, processing anyway", path.name)

        try:
            result = process_statement(
                pdf_path=str(path),
                db_session_factory=self.db_session_factory,
            )
            logger.info("Processed %s: %s", path.name, result)
            _log_processing_result(self.db_session_factory, path.name, result)
        except Exception as e:
            logger.exception("Failed to process %s: %s", path.name, e)
            _log_processing_result(
                self.db_session_factory, path.name,
                {"status": "error", "message": str(e), "count": 0},
            )

    @staticmethod
    def _should_process(path: Path) -> bool:
        if path.suffix.lower() != ".pdf":
            return False
        if "_unlocked" in path.stem:
            return False
        return True

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if self._should_process(path):
            self._process_pdf(path)

    def on_moved(self, event):
        if event.is_directory:
            return
        path = Path(event.dest_path)
        if self._should_process(path):
            self._process_pdf(path)


def _resolve_true_case(path: Path) -> Path:
    """Resolve each path component to its true filesystem case.

    macOS APFS is case-insensitive, but FSEvents delivers events with the
    actual on-disk casing. watchdog compares paths case-sensitively, so we
    must match the real casing exactly.
    """
    parts = path.parts
    resolved = Path(parts[0])
    for component in parts[1:]:
        try:
            for entry in resolved.iterdir():
                if entry.name.lower() == component.lower():
                    resolved = entry
                    break
            else:
                resolved = resolved / component
        except OSError:
            resolved = resolved / component
    return resolved


def start_watcher(watch_path: str, db_session_factory: Callable) -> Optional[Observer]:
    """Create Observer, schedule handler, start. Returns observer for cleanup."""
    path = Path(watch_path).expanduser().resolve()
    path = _resolve_true_case(path)
    if not path.exists() or not path.is_dir():
        logger.warning("Watch path does not exist or is not a directory: %s", watch_path)
        return None

    handler = StatementWatchHandler(db_session_factory)
    observer = Observer()
    observer.schedule(handler, str(path), recursive=False)
    observer.start()
    logger.info("Started folder watcher on %s", path)
    return observer


def stop_watcher(observer: Optional[Observer]) -> None:
    """Stop the folder watcher."""
    if observer:
        observer.stop()
        observer.join(timeout=5)
        logger.info("Stopped folder watcher")
