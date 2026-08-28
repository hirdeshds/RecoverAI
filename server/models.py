import os
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Database Connection Settings
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recoverai.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ── SQLAlchemy Relational Models ──

class Case(Base):
    __tablename__ = "cases"

    id = Column(String(50), primary key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, index=True)
    phone = Column(String(50))
    amount = Column(Numeric(10, 2), nullable=False)
    type = Column(String(50), nullable=False) # payment_failed, checkout_abandoned, receivables
    failure_reason = Column(String(100), nullable=False)
    timezone = Column(String(50), nullable=False)
    intent_score = Column(Integer, default=50)
    has_support_ticket = Column(Boolean, default=False)
    status = Column(String(50), default="ingested") # ingested, recovering, recovered, failed, suppressed
    current_step_index = Column(Integer, default=0)
    has_coupon = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = relationship("CaseEvent", back_populates="case", cascade="all, delete-orphan")

class CaseEvent(Base):
    __tablename__ = "case_events"

    id = Column(Integer, primary key=True, index=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(String(50), nullable=False)
    level = Column(String(50), nullable=False) # INGEST, DIAGNOSE, GUARDRAIL, ACTION, SUCCESS, FAIL
    title = Column(String(150), nullable=False)
    description = Column(Text)
    channel = Column(String(50)) # card_retry, email, sms, voice, manual
    bubble = Column(Text) # Personalized templates preview or dialogues
    is_voice = Column(Boolean, default=False)

    case = relationship("Case", back_populates="events")

class BlacklistItem(Base):
    __tablename__ = "blacklists"

    id = Column(Integer, primary key=True, index=True, autoincrement=True)
    value = Column(String(100), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DecisionRule(Base):
    __tablename__ = "decision_rules"

    id = Column(String(50), primary key=True, index=True)
    name = Column(String(100), nullable=False)
    criterion = Column(String(200), nullable=False)
    action = Column(String(50), nullable=False) # force_human, bypass_retry, apply_coupon, suppress
    description = Column(Text)
    active = Column(Boolean, default=True)

class PlaybookConfig(Base):
    __tablename__ = "playbooks"

    id = Column(String(50), primary key=True) # saas_fail, checkout_drop, b2b_collect, hinglish_voice
    steps = Column(Text, nullable=False) # comma-separated steps (e.g. "retry_api,email_reminder")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Pydantic Validation Schemas ──

class RevenueEventRequest(BaseModel):
    id: str = Field(..., example="REC-101")
    customer_name: str
    email: str
    phone: Optional[str] = None
    amount: float
    type: str # payment_failed, checkout_abandoned, receivables
    failure_reason: str # insufficient_funds, expired_card, etc.
    timezone: str
    intent_score: Optional[int] = 50
    has_support_ticket: Optional[bool] = False

class CaseEventResponse(BaseModel):
    id: int
    case_id: str
    timestamp: str
    level: str
    title: str
    description: Optional[str] = None
    channel: Optional[str] = None
    bubble: Optional[str] = None
    is_voice: bool

    class Config:
        orm_mode = True

class CaseResponse(BaseModel):
    id: str
    customer_name: str
    email: str
    phone: Optional[str] = None
    amount: float
    type: str
    failure_reason: str
    timezone: str
    intent_score: int
    has_support_ticket: bool
    status: str
    current_step_index: int
    has_coupon: bool
    created_at: datetime
    updated_at: datetime
    events: List[CaseEventResponse] = []

    class Config:
        orm_mode = True

class BlacklistRequest(BaseModel):
    value: str

class BlacklistResponse(BaseModel):
    id: int
    value: str
    created_at: datetime

    class Config:
        orm_mode = True

class DecisionRuleRequest(BaseModel):
    id: str
    name: str
    criterion: str
    action: str
    description: Optional[str] = None
    active: bool = True

class DecisionRuleResponse(BaseModel):
    id: str
    name: str
    criterion: str
    action: str
    description: Optional[str] = None
    active: bool

    class Config:
        orm_mode = True

class PlaybookUpdateRequest(BaseModel):
    steps: List[str]

class PlaybookResponse(BaseModel):
    id: str
    steps: List[str]
    updated_at: datetime

# Database session dependency helper
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Database Initializer method
def init_db():
    # Auto-creates all tables in engine metadata
    Base.metadata.create_all(bind=engine)
