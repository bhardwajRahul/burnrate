"""SQLAlchemy models for burnrate credit card analytics."""

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from backend.models.database import Base


def generate_uuid() -> str:
    """Generate a UUID4 string for primary keys."""
    return str(uuid4())


class Settings(Base):
    """User settings including name, DOB, and watch folder."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    dob_day = Column(String(2), nullable=True)
    dob_month = Column(String(2), nullable=True)
    dob_year = Column(String(4), nullable=True)
    watch_folder = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Card(Base):
    """Credit card metadata."""

    __tablename__ = "cards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bank = Column(String(50), nullable=False)  # 'hdfc', 'icici', 'axis'
    last4 = Column(String(4), nullable=False)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Statement(Base):
    """Imported credit card statement."""

    __tablename__ = "statements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bank = Column(String(50), nullable=False)
    card_last4 = Column(String(4), nullable=True)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    file_hash = Column(String(64), nullable=False)  # SHA-256
    file_path = Column(String(1024), nullable=True)
    transaction_count = Column(Integer, default=0)
    total_spend = Column(Float, default=0.0)
    total_amount_due = Column(Float, nullable=True)
    credit_limit = Column(Float, nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="statement")


class Transaction(Base):
    """Individual transaction from a statement."""

    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    statement_id = Column(String(36), ForeignKey("statements.id"), nullable=False)
    date = Column(Date, nullable=False)
    merchant = Column(String(512), nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String(20), nullable=False)  # 'debit' or 'credit'
    category = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    card_id = Column(String(36), ForeignKey("cards.id"), nullable=True)
    bank = Column(String(50), nullable=True)
    card_last4 = Column(String(4), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    statement = relationship("Statement", back_populates="transactions")


class ProcessingLog(Base):
    """Log of statement processing attempts (success, error, duplicate)."""

    __tablename__ = "processing_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_name = Column(String(512), nullable=False)
    status = Column(String(20), nullable=False)  # success, error, duplicate
    message = Column(Text, nullable=True)
    bank = Column(String(50), nullable=True)
    transaction_count = Column(Integer, default=0)
    acknowledged = Column(Integer, default=0)  # 0=unread, 1=dismissed
    created_at = Column(DateTime, default=datetime.utcnow)
