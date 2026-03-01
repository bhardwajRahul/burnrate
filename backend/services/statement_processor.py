"""Statement processing orchestrator."""

import hashlib
import logging
import os
from pathlib import Path
from typing import Callable, Dict, Optional, Type

from sqlalchemy.orm import Session

from backend.models.database import SessionLocal
from backend.models.models import Card, Statement, Settings, Transaction
from backend.parsers.axis import AxisParser
from backend.parsers.detector import detect_bank
from backend.parsers.generic import GenericParser
from backend.parsers.hdfc import HDFCParser
from backend.parsers.icici import ICICIParser
from backend.services.categorizer import categorize
from backend.services.pdf_unlock import generate_passwords, is_encrypted, unlock_pdf

logger = logging.getLogger(__name__)

PARSERS: Dict[str, Type] = {
    "hdfc": HDFCParser,
    "icici": ICICIParser,
    "axis": AxisParser,
}

SUPPORTED_BANKS = [
    "hdfc", "icici", "axis", "sbi", "amex", "idfc_first",
    "indusind", "kotak", "sc", "yes", "au", "rbl",
]


def _compute_hash(file_path: str) -> str:
    """Compute SHA-256 hash of file for deduplication."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


def _get_user_profile(db: Session) -> Optional[Settings]:
    """Load user settings from DB."""
    return db.query(Settings).first()


def _get_card_last4s(db: Session, bank: Optional[str] = None) -> list:
    """Get list of card last4 digits for password generation. Filter by bank if provided."""
    cards = db.query(Card).all()
    if bank:
        cards = [c for c in cards if c.bank.lower() == bank.lower()]
    return [c.last4 for c in cards]


def process_statement(
    pdf_path: str,
    bank: Optional[str] = None,
    db_session: Optional[Session] = None,
    db_session_factory: Optional[Callable] = None,
    manual_password: Optional[str] = None,
) -> Dict:
    """
    Process a statement PDF: unlock, parse, categorize, persist.
    Returns summary dict { status, count, period, bank }.
    """
    close_session = False
    if db_session is None and db_session_factory:
        db_session = db_session_factory()
        close_session = True
    elif db_session is None:
        db_session = SessionLocal()
        close_session = True

    try:
        if not os.path.isfile(pdf_path):
            return {"status": "error", "message": "File not found", "count": 0}

        file_hash = _compute_hash(pdf_path)

        # Check for duplicate
        existing = db_session.query(Statement).filter(Statement.file_hash == file_hash).first()
        if existing:
            return {
                "status": "duplicate",
                "message": "Statement already imported",
                "count": 0,
                "period": None,
                "bank": None,
            }

        # Detect bank if not provided
        if not bank:
            bank = detect_bank(pdf_path)

        profile = _get_user_profile(db_session)
        card_last4s = _get_card_last4s(db_session, bank=bank) if bank else _get_card_last4s(db_session)
        working_path = pdf_path
        encrypted = is_encrypted(pdf_path)

        if encrypted and manual_password:
            unlocked = unlock_pdf(pdf_path, [manual_password])
            if unlocked:
                working_path = unlocked
                if not bank:
                    detected = detect_bank(working_path)
                    if detected and detected in SUPPORTED_BANKS:
                        bank = detected
            else:
                return {
                    "status": "error",
                    "message": "Could not unlock PDF with provided password",
                    "count": 0,
                }
        elif encrypted and profile:
            if bank:
                # Detected bank — try its passwords (works for dedicated and generic banks)
                passwords = generate_passwords(
                    bank=bank,
                    name=profile.name,
                    dob_day=profile.dob_day or "",
                    dob_month=profile.dob_month or "",
                    card_last4s=card_last4s,
                    dob_year=profile.dob_year or "",
                )
                unlocked = unlock_pdf(pdf_path, passwords)
                if unlocked:
                    working_path = unlocked
                else:
                    return {
                        "status": "error",
                        "message": "Could not unlock PDF - wrong password",
                        "count": 0,
                    }
            else:
                # Bank unknown — try every supported bank's passwords until one works
                unlocked = None
                for try_bank in SUPPORTED_BANKS:
                    try_card_last4s = _get_card_last4s(db_session, bank=try_bank)
                    passwords = generate_passwords(
                        bank=try_bank,
                        name=profile.name,
                        dob_day=profile.dob_day or "",
                        dob_month=profile.dob_month or "",
                        card_last4s=try_card_last4s,
                        dob_year=profile.dob_year or "",
                    )
                    unlocked = unlock_pdf(pdf_path, passwords)
                    if unlocked:
                        bank = try_bank
                        working_path = unlocked
                        logger.info("Unlocked with bank=%s passwords", try_bank)
                        break

                if not unlocked:
                    return {
                        "status": "error",
                        "message": "Could not unlock PDF - tried all bank password formats",
                        "count": 0,
                    }

                # Confirm bank from PDF content now that it's unlocked
                detected = detect_bank(working_path)
                if detected and detected in SUPPORTED_BANKS:
                    bank = detected

        if not bank:
            return {
                "status": "error",
                "message": "Could not detect bank",
                "count": 0,
            }

        # Parse — use dedicated parser if available, else generic
        if bank in PARSERS:
            parser = PARSERS[bank]()
        else:
            parser = GenericParser(bank=bank)
        parsed = parser.parse(working_path)

        # Clean up unlocked temp file if we created one
        if working_path != pdf_path and os.path.isfile(working_path):
            try:
                os.remove(working_path)
            except OSError:
                pass

        # Resolve card_last4 from parsed data or registered cards
        card_last4 = getattr(parsed, "card_last4", None)
        card_id = None
        if card_last4:
            card = db_session.query(Card).filter(
                Card.bank == bank, Card.last4 == card_last4
            ).first()
            if card:
                card_id = card.id
            else:
                # Auto-register card discovered from statement
                card = Card(bank=bank, last4=card_last4)
                db_session.add(card)
                db_session.flush()
                card_id = card.id
                logger.info("Auto-registered card %s %s", bank, card_last4)
        else:
            cards = db_session.query(Card).filter(Card.bank == bank).all()
            if len(cards) == 1:
                card_last4 = cards[0].last4
                card_id = cards[0].id

        # Create Statement record
        total_spend = sum(t.amount for t in parsed.transactions if t.type == "debit")
        statement = Statement(
            bank=bank,
            card_last4=card_last4,
            period_start=parsed.period_start,
            period_end=parsed.period_end,
            file_hash=file_hash,
            file_path=pdf_path,
            transaction_count=len(parsed.transactions),
            total_spend=total_spend,
            total_amount_due=getattr(parsed, "total_amount_due", None),
            credit_limit=getattr(parsed, "credit_limit", None),
        )
        db_session.add(statement)
        db_session.flush()

        # Insert transactions
        for pt in parsed.transactions:
            category = categorize(pt.merchant)
            tx = Transaction(
                statement_id=statement.id,
                date=pt.date,
                merchant=pt.merchant,
                amount=pt.amount,
                type=pt.type,
                category=category,
                description=pt.description,
                bank=bank,
                card_last4=card_last4,
                card_id=card_id,
            )
            db_session.add(tx)

        db_session.commit()

        return {
            "status": "success",
            "count": len(parsed.transactions),
            "period": {
                "start": parsed.period_start.isoformat() if parsed.period_start else None,
                "end": parsed.period_end.isoformat() if parsed.period_end else None,
            },
            "bank": bank,
        }

    except Exception as e:
        logger.exception("Statement processing failed")
        if db_session:
            db_session.rollback()
        return {
            "status": "error",
            "message": str(e),
            "count": 0,
            "period": None,
            "bank": bank,
        }
    finally:
        if close_session and db_session:
            db_session.close()
