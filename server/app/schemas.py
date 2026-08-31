from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CaseBase(BaseSchema):
    case_id: str
    customer_id: str | None = None
    amount: int = 0
    currency: str = "INR"
    status: str = "open"
    reason: str | None = None


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseSchema):
    case_id: str | None = None
    customer_id: str | None = None
    amount: int | None = None
    currency: str | None = None
    status: str | None = None
    reason: str | None = None


class CaseRead(CaseBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CaseEventBase(BaseSchema):
    event_type: str
    source: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class CaseEventCreate(CaseEventBase):
    case_id: int


class CaseEventRead(CaseEventBase):
    id: int
    case_id: int
    created_at: datetime | None = None


class SuppressionBase(BaseSchema):
    reason: str
    status: str = "active"


class SuppressionCreate(SuppressionBase):
    case_id: int


class SuppressionRead(SuppressionBase):
    id: int
    case_id: int
    created_at: datetime | None = None


__all__ = [
    "CaseBase",
    "CaseCreate",
    "CaseUpdate",
    "CaseRead",
    "CaseEventBase",
    "CaseEventCreate",
    "CaseEventRead",
    "SuppressionBase",
    "SuppressionCreate",
    "SuppressionRead",
]
