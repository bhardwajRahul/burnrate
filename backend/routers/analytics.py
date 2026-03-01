"""Analytics API endpoints."""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.models import Statement, Transaction
from backend.services.analytics import (
    compute_net_spend,
    get_category_breakdown,
    get_monthly_trends,
    get_summary,
    get_top_merchants,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _months_in_range(from_date: Optional[date], to_date: Optional[date]) -> int:
    """Count the number of calendar months spanned by a date range."""
    if not from_date or not to_date:
        return 1
    return max(
        (to_date.year - from_date.year) * 12 + (to_date.month - from_date.month) + 1,
        1,
    )


@router.get("/summary")
def analytics_summary(
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
) -> Dict[str, Any]:
    """Total spend, delta %, sparkline data, avg monthly spend."""
    summary = get_summary(db, from_date=from_date, to_date=to_date)
    total_spend = summary["total_spend"]

    # Compute delta % relative to filter range.
    # Compare the selected period to an equivalent prior period.
    if from_date and to_date:
        span = (to_date - from_date).days
        prev_end = from_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span)
        current_spend = total_spend
        period_label = "vs prior period"
    else:
        today = date.today()
        this_month_start = today.replace(day=1)
        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        current_spend = compute_net_spend(db, this_month_start, today)
        prev_start = last_month_start
        prev_end = last_month_end
        period_label = "vs last month"

    prev_spend = compute_net_spend(db, prev_start, prev_end)

    delta = (
        round(((current_spend - prev_spend) / prev_spend) * 100)
        if prev_spend > 0
        else 0
    )

    trends = get_monthly_trends(db, months=6)
    sparkline = [{"value": t["spend"]} for t in trends]

    credit_limit = db.query(func.max(Statement.credit_limit)).scalar() or 0

    months = _months_in_range(from_date, to_date)
    avg_monthly_spend = round(total_spend / months, 2) if months else 0

    return {
        "totalSpend": total_spend,
        "deltaPercent": delta,
        "deltaLabel": period_label,
        "period": "This month",
        "sparklineData": sparkline if sparkline else [{"value": 0}],
        "cardBreakdown": [
            {"bank": c["bank"], "last4": c["card_last4"], "amount": c["spend"], "count": c.get("count", 0)}
            for c in summary["card_breakdown"]
        ],
        "creditLimit": credit_limit,
        "avgMonthlySpend": avg_monthly_spend,
        "monthsInRange": months,
    }


@router.get("/categories")
def analytics_categories(
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
) -> Dict[str, Any]:
    """Category breakdown."""
    result = get_category_breakdown(db, from_date=from_date, to_date=to_date)
    return {
        "breakdown": [
            {
                "category": c["category"],
                "amount": c["amount"],
                "percentage": c["percentage"],
                "count": c["count"],
            }
            for c in result["categories"]
        ],
    }


@router.get("/trends")
def analytics_trends(
    db: Session = Depends(get_db),
    months: int = Query(12, ge=1, le=24),
) -> Dict[str, Any]:
    """Monthly trends."""
    data = get_monthly_trends(db, months=months)
    return {
        "trends": [{"month": t["month"], "spend": t["spend"]} for t in data],
    }


@router.get("/merchants")
def analytics_merchants(
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    limit: int = Query(10, ge=1, le=50),
) -> Dict[str, Any]:
    """Top merchants by spend."""
    data = get_top_merchants(db, from_date=from_date, to_date=to_date, limit=limit)
    return {
        "merchants": [
            {"merchant": m["merchant"], "amount": m["spend"], "count": m["count"]}
            for m in data
        ],
    }


@router.get("/statement-periods")
def statement_periods(
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
) -> Dict[str, Any]:
    """Return all statement periods with net spend computed per period."""
    q = db.query(Statement)

    if from_date:
        q = q.filter(Statement.period_end >= from_date)
    if to_date:
        q = q.filter(Statement.period_start <= to_date)

    statements = q.order_by(Statement.period_start.desc()).all()

    periods = []
    for s in statements:
        if s.period_start and s.period_end:
            net_spend = compute_net_spend(
                db, s.period_start, s.period_end,
                bank=s.bank, card_last4=s.card_last4,
            )
        else:
            net_spend = s.total_spend
        periods.append({
            "bank": s.bank,
            "cardLast4": s.card_last4,
            "periodStart": s.period_start.isoformat() if s.period_start else None,
            "periodEnd": s.period_end.isoformat() if s.period_end else None,
            "totalAmountDue": s.total_amount_due,
            "totalSpend": net_spend,
            "creditLimit": s.credit_limit,
        })

    return {"periods": periods}
