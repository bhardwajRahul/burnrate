"""Transaction API endpoints."""

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.models import Transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("")
def list_transactions(
    db: Session = Depends(get_db),
    card: Optional[str] = Query(None, description="Filter by card UUID"),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    direction: Optional[str] = Query(None, description="incoming or outgoing"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """Query transactions with filters. Returns {transactions: [...], total: N, totalAmount: F}."""
    q = db.query(Transaction)
    if card:
        q = q.filter(Transaction.card_id == card)
    if from_date:
        q = q.filter(Transaction.date >= from_date)
    if to_date:
        q = q.filter(Transaction.date <= to_date)
    if category:
        q = q.filter(Transaction.category == category)
    if direction == "incoming":
        q = q.filter(Transaction.type == "credit")
    elif direction == "outgoing":
        q = q.filter(Transaction.type == "debit")
    if search:
        q = q.filter(
            Transaction.merchant.ilike(f"%{search}%")
            | Transaction.description.ilike(f"%{search}%")
        )

    # Exclude cc_payment from aggregate metrics but keep them in the list.
    # Net spend = sum(debits) − sum(credits) where category != cc_payment.
    filtered_ids = q.with_entities(Transaction.id)
    metrics_q = q.filter(Transaction.category != "cc_payment")
    total_count = metrics_q.count()

    total_amount = (
        db.query(
            func.sum(
                case(
                    (Transaction.type == "debit", Transaction.amount),
                    else_=-Transaction.amount,
                )
            )
        )
        .filter(
            Transaction.category != "cc_payment",
            Transaction.id.in_(filtered_ids),
        )
        .scalar() or 0.0
    )

    rows = q.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()

    return {
        "transactions": [
            {
                "id": r.id,
                "statementId": r.statement_id,
                "date": r.date.isoformat() if r.date else None,
                "merchant": r.merchant,
                "amount": r.amount,
                "type": r.type,
                "category": r.category,
                "description": r.description,
                "bank": r.bank,
                "cardLast4": r.card_last4,
                "cardId": r.card_id,
            }
            for r in rows
        ],
        "total": total_count,
        "totalAmount": round(total_amount, 2),
    }
