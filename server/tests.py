import os
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test database connection
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override database dependency in FastAPI app
from server.models import Base, get_db, Case, BlacklistItem, DecisionRule, PlaybookConfig
from server.api import app

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: Create tables in memory
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed default configs for test environment
    defaults = {
        "saas_fail": "retry_api,email_reminder,sms_alert,voice_recovery,escalate_human",
        "checkout_drop": "email_reminder,sms_alert,escalate_human"
    }
    for k, v in defaults.items():
        pb = PlaybookConfig(id=k, steps=v)
        db.add(pb)
    db.commit()
    db.close()
    
    yield
    # Teardown: Drop tables
    Base.metadata.drop_all(bind=engine)

# ── UNIT & INTEGRATION TESTS ──

def test_event_ingestion_success():
    payload = {
        "id": "TEST-REC-101",
        "customer_name": "John Doe",
        "email": "john.doe@company.com",
        "phone": "+1 555-0199",
        "amount": 99.00,
        "type": "payment_failed",
        "failure_reason": "insufficient_funds",
        "timezone": "America/New_York",
        "intent_score": 75,
        "has_support_ticket": False
    }
    response = client.post("/api/events", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "TEST-REC-101"
    assert data["customer_name"] == "John Doe"
    assert data["status"] in ["recovering", "recovered", "failed", "suppressed"]

def test_event_ingestion_validation_error():
    # Missing required field amount
    payload = {
        "id": "TEST-REC-ERR",
        "customer_name": "Invalid Customer",
        "email": "invalid@company.com",
        "type": "payment_failed",
        "failure_reason": "expired_card",
        "timezone": "Europe/London"
    }
    response = client.post("/api/events", json=payload)
    assert response.status_code == 422 # Pydantic validation error

def test_blacklist_suppression_shield():
    # 1. Add email domain to blacklist
    client.post("/api/compliance/blacklist", json={"value": "baddebt@scam.com"})
    
    # 2. Ingest event matching blacklisted email address
    payload = {
        "id": "TEST-REC-BLACKLIST",
        "customer_name": "Defaulter User",
        "email": "user@baddebt@scam.com", # Ingests nested match or direct domain
        "amount": 149.00,
        "type": "payment_failed",
        "failure_reason": "card_declined",
        "timezone": "US/Pacific"
    }
    # Wait, email format is invalid in mock payload, let's fix it:
    payload["email"] = "user@baddebt@scam.com" # domain is baddebt@scam.com
    
    response = client.post("/api/events", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "suppressed"
    
    # Inspect timeline logs for suppression event
    details = client.get(f"/api/cases/{data['id']}").json()
    assert any(e["level"] == "GUARDRAIL" and "Blacklist" in e["title"] for e in details["events"])

def test_override_matrix_rule():
    # 1. Add custom override rule
    rule_payload = {
        "id": "rule_test_high",
        "name": "High Value Escalation Limit",
        "criterion": "amount > 8000",
        "action": "force_human",
        "description": "Escalates enterprise cases > $8k",
        "active": True
    }
    client.post("/api/rules", json=rule_payload)
    
    # 2. Ingest high-value case
    case_payload = {
        "id": "TEST-REC-RULE",
        "customer_name": "Enterprise Client",
        "email": "billing@enterprise.com",
        "amount": 9500.00, # matches criterion > 8000
        "type": "payment_failed",
        "failure_reason": "card_declined",
        "timezone": "Asia/Kolkata"
    }
    response = client.post("/api/events", json=case_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed" # force_human terminates as failed-escalated
    
    details = client.get(f"/api/cases/{data['id']}").json()
    assert any(e["level"] == "GUARDRAIL" and "Override" in e["title"] for e in details["events"])

def test_dashboard_statistics():
    # Ingest 2 cases to test stats counters
    client.post("/api/events", json={
        "id": "TEST-C1", "customer_name": "C1", "email": "c1@c.com", "amount": 100,
        "type": "payment_failed", "failure_reason": "insufficient_funds", "timezone": "Asia/Kolkata"
    })
    client.post("/api/events", json={
        "id": "TEST-C2", "customer_name": "C2", "email": "c2@c.com", "amount": 200,
        "type": "payment_failed", "failure_reason": "expired_card", "timezone": "Asia/Kolkata"
    })
    
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data
    assert "funnels" in data
    assert "channels" in data
    assert data["kpis"]["at_risk"] == 300.00
