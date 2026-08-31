import uuid
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.ingestion.normalizer import (
    normalize_checkout_abandoned,
    normalize_invoice_overdue,
    normalize_mandate_failed,
    normalize_stripe_payment_failed,
    normalize_subscription_payment_failed,
)
from app.models import Case, CaseEvent
from app.schemas import RevenueEventIn, WebhookDetectedOut

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _event_payload(event: RevenueEventIn) -> dict[str, Any]:
    return event.model_dump() if hasattr(event, "model_dump") else event.dict()


def _create_case(db: Session, event: RevenueEventIn) -> WebhookDetectedOut:
    case = Case(
        id=str(uuid.uuid4()),
        source=event.source,
        customer_id=event.customer_id,
        amount_at_risk=event.amount_at_risk,
        currency=event.currency,
        status="open",
        attempts=0,
    )
    db.add(case)
    db.flush()

    db.add(
        CaseEvent(
            case_id=case.id,
            event_type="detected",
            payload=_event_payload(event),
        )
    )
    db.commit()
    return WebhookDetectedOut(case_id=case.id)


def _ingest(
    payload: dict[str, Any],
    normalizer: Callable[[dict[str, Any]], RevenueEventIn],
    db: Session,
) -> WebhookDetectedOut:
    return _create_case(db, normalizer(payload))


@router.post("/stripe/payment-failed", response_model=WebhookDetectedOut)
def stripe_payment_failed(payload: dict[str, Any], db: Session = Depends(get_db)) -> WebhookDetectedOut:
    return _ingest(payload, normalize_stripe_payment_failed, db)


@router.post("/checkout/abandoned", response_model=WebhookDetectedOut)
def checkout_abandoned(payload: dict[str, Any], db: Session = Depends(get_db)) -> WebhookDetectedOut:
    return _ingest(payload, normalize_checkout_abandoned, db)


@router.post("/invoice/overdue", response_model=WebhookDetectedOut)
def invoice_overdue(payload: dict[str, Any], db: Session = Depends(get_db)) -> WebhookDetectedOut:
    return _ingest(payload, normalize_invoice_overdue, db)


@router.post("/subscription/payment-failed", response_model=WebhookDetectedOut)
def subscription_payment_failed(payload: dict[str, Any], db: Session = Depends(get_db)) -> WebhookDetectedOut:
    return _ingest(payload, normalize_subscription_payment_failed, db)


@router.post("/mandate/failed", response_model=WebhookDetectedOut)
def mandate_failed(payload: dict[str, Any], db: Session = Depends(get_db)) -> WebhookDetectedOut:
    return _ingest(payload, normalize_mandate_failed, db)


__all__ = ["router"]
