"""Analytics queries for spend data.

Net spend formula (single source of truth):
    net = sum(debits, category != cc_payment) − sum(credits, category != cc_payment)
CC payment transactions are excluded entirely; legitimate refunds/reversals
(credits with any other category) reduce the net spend.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.models.models import Transaction


def _date_filter(q, from_date: Optional[date], to_date: Optional[date]):
    if from_date:
        q = q.filter(Transaction.date >= from_date)
    if to_date:
        q = q.filter(Transaction.date <= to_date)
    return q


def compute_net_spend(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    bank: Optional[str] = None,
    card_last4: Optional[str] = None,
) -> float:
    """Single source of truth for net spend calculation."""
    q = (
        db.query(
            func.sum(
                case(
                    (Transaction.type == "debit", Transaction.amount),
                    else_=-Transaction.amount,
                )
            )
        )
        .filter(Transaction.category != "cc_payment")
    )
    q = _date_filter(q, from_date, to_date)
    if bank:
        q = q.filter(Transaction.bank == bank)
    if card_last4:
        q = q.filter(Transaction.card_last4 == card_last4)
    return round(q.scalar() or 0.0, 2)


def get_summary(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Total spend and card-wise breakdown."""
    total = compute_net_spend(db, from_date, to_date)

    # Per-card net spend: debits − credits (excluding cc_payment)
    card_q = (
        db.query(
            Transaction.bank,
            Transaction.card_last4,
            func.sum(
                case(
                    (Transaction.type == "debit", Transaction.amount),
                    else_=-Transaction.amount,
                )
            ).label("net_spend"),
            func.count(Transaction.id).label("count"),
        )
        .filter(Transaction.category != "cc_payment")
    )
    card_q = _date_filter(card_q, from_date, to_date)
    card_rows = card_q.group_by(Transaction.bank, Transaction.card_last4).all()

    return {
        "total_spend": total,
        "card_breakdown": [
            {
                "bank": r.bank,
                "card_last4": r.card_last4,
                "spend": round(r.net_spend or 0, 2),
                "count": r.count,
            }
            for r in card_rows
        ],
    }


def get_category_breakdown(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Category amounts and percentages."""
    q = (
        db.query(
            Transaction.category,
            func.sum(Transaction.amount).label("amount"),
            func.count(Transaction.id).label("count"),
        )
        .filter(Transaction.type == "debit")
        .filter(Transaction.category != "cc_payment")
    )
    if from_date:
        q = q.filter(Transaction.date >= from_date)
    if to_date:
        q = q.filter(Transaction.date <= to_date)
    rows = q.group_by(Transaction.category).all()

    total = sum(r.amount or 0 for r in rows)
    categories = [
        {
            "category": r.category,
            "amount": round(r.amount or 0, 2),
            "percentage": round((r.amount or 0) / total * 100, 1) if total else 0,
            "count": r.count,
        }
        for r in rows
    ]
    return {"total": round(total, 2), "categories": categories}


def get_monthly_trends(db: Session, months: int = 12) -> List[Dict[str, Any]]:
    """Monthly net spend aggregation (debits − non-cc credits)."""
    end = date.today()
    start = end - timedelta(days=months * 31)

    rows = (
        db.query(
            func.strftime("%Y-%m", Transaction.date).label("month"),
            func.sum(
                case(
                    (Transaction.type == "debit", Transaction.amount),
                    else_=-Transaction.amount,
                )
            ).label("spend"),
        )
        .filter(Transaction.category != "cc_payment")
        .filter(Transaction.date >= start)
        .filter(Transaction.date <= end)
        .group_by(func.strftime("%Y-%m", Transaction.date))
        .order_by("month")
        .all()
    )

    return [
        {"month": r.month, "spend": round(r.spend or 0, 2)}
        for r in rows
    ]


def get_top_merchants(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Top merchants by spend."""
    q = (
        db.query(
            Transaction.merchant,
            func.sum(Transaction.amount).label("spend"),
            func.count(Transaction.id).label("count"),
        )
        .filter(Transaction.type == "debit")
        .filter(Transaction.category != "cc_payment")
    )
    if from_date:
        q = q.filter(Transaction.date >= from_date)
    if to_date:
        q = q.filter(Transaction.date <= to_date)
    rows = (
        q.group_by(Transaction.merchant)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
        .all()
    )

    return [
        {"merchant": r.merchant, "spend": round(r.spend or 0, 2), "count": r.count}
        for r in rows
    ]
