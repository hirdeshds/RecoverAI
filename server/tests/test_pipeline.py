import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import Base, get_db
from app.ingestion.normalizer import (
    normalize_checkout_abandoned,
    normalize_invoice_overdue,
    normalize_mandate_failed,
    normalize_stripe_payment_failed,
    normalize_subscription_payment_failed,
)
from app.main import app
from app.models import Case, CaseEvent
from app.orchestrator.diagnose import RULES_MAP, diagnose


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_normalizers_cover_all_dev_a_sources():
    payment = normalize_stripe_payment_failed(
        {"customer": "cust_pay", "amount": 2599, "currency": "usd", "failure_code": "expired_card"}
    )
    assert payment.source == "payment"
    assert payment.customer_id == "cust_pay"
    assert payment.amount_at_risk == 25.99
    assert payment.currency == "USD"
    assert payment.raw_reason_code == "expired_card"

    checkout = normalize_checkout_abandoned({"customer_id": "cust_cart", "cart_total": 72, "currency": "usd"})
    assert checkout.source == "checkout"
    assert checkout.raw_reason_code == "checkout_timeout"

    invoice = normalize_invoice_overdue({"account_id": "acct_1", "invoice_amount": 12000, "currency": "inr"})
    assert invoice.source == "invoice"
    assert invoice.customer_id == "acct_1"
    assert invoice.raw_reason_code == "invoice_overdue"

    subscription = normalize_subscription_payment_failed(
        {"customer_id": "cust_sub", "renewal_amount": 49, "currency": "usd", "failure_code": "insufficient_funds"}
    )
    assert subscription.source == "subscription"
    assert subscription.raw_reason_code == "insufficient_funds"

    mandate = normalize_mandate_failed({"customer_id": "cust_mandate", "mandate_amount": 2500, "currency": "inr"})
    assert mandate.source == "mandate"
    assert mandate.raw_reason_code == "mandate_failed"


@pytest.mark.parametrize("raw_reason_code,root_cause", sorted(RULES_MAP.items()))
def test_diagnose_rules_map_without_llm(raw_reason_code, root_cause, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = diagnose(raw_reason_code, {})
    assert result["root_cause"] == root_cause
    assert result["confidence"] == 1.0
    assert result["method"] == "rules_prefilter"


def test_diagnose_unknown_reason_falls_back_without_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = diagnose("issuer_soft_decline", {"source": "payment"})
    assert result["root_cause"] == "other"
    assert result["method"] == "llm_missing_key_fallback"


@pytest.mark.parametrize(
    "path,payload,expected_source,expected_reason",
    [
        (
            "/webhooks/stripe/payment-failed",
            {"customer": "cust_1", "amount": 10000, "currency": "USD", "failure_code": "expired_card"},
            "payment",
            "expired_card",
        ),
        (
            "/webhooks/checkout/abandoned",
            {"customer_id": "cust_2", "cart_total": 125.50, "currency": "USD"},
            "checkout",
            "checkout_timeout",
        ),
        (
            "/webhooks/invoice/overdue",
            {"account_id": "acct_3", "invoice_amount": 12000, "currency": "INR"},
            "invoice",
            "invoice_overdue",
        ),
        (
            "/webhooks/subscription/payment-failed",
            {
                "customer_id": "cust_4",
                "renewal_amount": 49.99,
                "currency": "USD",
                "failure_code": "subscription_payment_failed",
            },
            "subscription",
            "subscription_payment_failed",
        ),
        (
            "/webhooks/mandate/failed",
            {"customer_id": "cust_5", "mandate_amount": 2500, "currency": "INR"},
            "mandate",
            "mandate_failed",
        ),
    ],
)
def test_webhooks_create_case_and_detected_event(client, db_session, path, payload, expected_source, expected_reason):
    response = client.post(path, json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "detected"

    case = db_session.get(Case, body["case_id"])
    assert case is not None
    assert case.source == expected_source
    assert case.status == "open"

    events = db_session.query(CaseEvent).filter(CaseEvent.case_id == body["case_id"]).all()
    assert len(events) == 1
    assert events[0].event_type == "detected"
    assert events[0].payload["raw_reason_code"] == expected_reason
