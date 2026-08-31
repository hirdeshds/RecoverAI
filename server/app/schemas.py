from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RevenueEventIn(BaseModel):
    source: str = Field(..., description="payment | checkout | invoice | subscription | mandate")
    customer_id: str
    amount_at_risk: float
    currency: str = "USD"
    raw_reason_code: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class WebhookDetectedOut(BaseModel):
    case_id: str
    status: str = "detected"


class CaseOut(BaseSchema):
    id: str
    source: str
    customer_id: str
    amount_at_risk: float
    amount_recovered: float = 0.0
    currency: str
    diagnosis: str | None = None
    status: str
    attempts: int
    promise_to_pay_date: datetime | None = None
    created_at: datetime | None = None
    last_action_at: datetime | None = None
    closed_at: datetime | None = None


class CaseEventOut(BaseSchema):
    id: int
    case_id: str
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    guardrails_checked: dict[str, Any] | None = None
    created_at: datetime | None = None


__all__ = ["RevenueEventIn", "WebhookDetectedOut", "CaseOut", "CaseEventOut"]
