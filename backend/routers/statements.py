"""Statement API endpoints."""

import os
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.models import ProcessingLog, Statement
from backend.services.statement_processor import process_statement

router = APIRouter(prefix="/statements", tags=["statements"])


@router.post("/upload")
def upload_statement(
    file: UploadFile = File(...),
    bank: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Accept PDF file upload with optional bank and password params."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF file required")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = file.file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = process_statement(
            pdf_path=tmp_path,
            bank=bank.lower() if bank else None,
            db_session=db,
            manual_password=password,
        )
        return result
    finally:
        if os.path.isfile(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                # logger.error(f"Error removing temporary file {tmp_path}: {e}")
                pass


@router.get("")
def list_statements(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """List all imported statements."""
    statements = db.query(Statement).order_by(Statement.imported_at.desc()).all()
    return [
        {
            "id": s.id,
            "bank": s.bank,
            "card_last4": s.card_last4,
            "period_start": s.period_start.isoformat() if s.period_start else None,
            "period_end": s.period_end.isoformat() if s.period_end else None,
            "transaction_count": s.transaction_count,
            "total_spend": s.total_spend,
            "total_amount_due": s.total_amount_due,
            "credit_limit": s.credit_limit,
            "imported_at": s.imported_at.isoformat() if s.imported_at else None,
        }
        for s in statements
    ]


@router.get("/processing-logs")
def get_processing_logs(
    unread_only: bool = True,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return recent processing logs for frontend polling."""
    q = db.query(ProcessingLog).order_by(ProcessingLog.created_at.desc())
    if unread_only:
        q = q.filter(ProcessingLog.acknowledged == 0)
    logs = q.limit(20).all()
    return [
        {
            "id": log.id,
            "fileName": log.file_name,
            "status": log.status,
            "message": log.message,
            "bank": log.bank,
            "transactionCount": log.transaction_count,
            "createdAt": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.post("/processing-logs/{log_id}/ack")
def acknowledge_log(log_id: str, db: Session = Depends(get_db)) -> Dict[str, str]:
    """Mark a processing log as acknowledged so it doesn't show again."""
    log = db.query(ProcessingLog).filter(ProcessingLog.id == log_id).first()
    if log:
        log.acknowledged = 1
        db.commit()
    return {"status": "ok"}
