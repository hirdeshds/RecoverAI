import sys
import json
import uuid
from pathlib import Path

# Add project root to sys.path so imports work regardless of working directory
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from backend.database import get_db_connection, init_db
from backend.razorpay.client import get_razorpay_client, KEY_ID
from backend.webhooks.receiver import verify_webhook_signature, is_duplicate_event
from backend.webhooks.eventParser import parse_webhook_payload
from backend.metrics.aggregate import compute_aggregate_metrics
from db.seed_test_events import seed_test_events

load_dotenv()

app = FastAPI(
    title="RecoverAI Platform",
    description="AI Revenue Recovery Platform for Razorpay",
    version="1.0.0"
)

# Enable CORS for dashboard frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = BASE_DIR / "frontend"


class PaymentOrderRequest(BaseModel):
    amount: float = Field(gt=0, le=10000000)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    customer_name: str = Field(default="", max_length=100)
    customer_email: str = Field(default="", max_length=254)
    customer_contact: str = Field(default="", max_length=20)


class PaymentVerificationRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@app.on_event("startup")
def startup_event():
    """Initializes SQLite database schema on server startup."""
    init_db()

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "online", "system": "RecoverAI Python FastAPI Platform"}

@app.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    """
    Razorpay Webhook Endpoint:
    1. Verifies HMAC-SHA256 signature
    2. Deduplicates event
    3. Parses payload into revenue_at_risk database record
    """
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    if not verify_webhook_signature(raw_body, signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Razorpay webhook signature"
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload format"
        )

    event_id = str(payload.get("account_id", "")) + str(payload.get("created_at", "")) + str(payload.get("event", ""))
    if is_duplicate_event(event_id):
        return {"status": "ignored", "reason": "duplicate_event"}

    parsed_record = parse_webhook_payload(payload)

    conn = get_db_connection()
    cursor = conn.cursor()

    # If it's a successful payment recovery event, update status if existing or insert as recovered
    if parsed_record["status"] == "recovered":
        cursor.execute("""
            UPDATE revenue_at_risk SET status = 'recovered' WHERE razorpay_entity_id = ? OR customer_id = ?
        """, (parsed_record["razorpay_entity_id"], parsed_record["customer_id"]))
    
    cursor.execute("""
        INSERT INTO revenue_at_risk 
        (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        parsed_record["id"],
        parsed_record["customer_id"],
        parsed_record["event_type"],
        parsed_record["amount"],
        parsed_record["currency"],
        parsed_record["razorpay_entity_id"],
        parsed_record["error_code"],
        parsed_record["error_description"],
        parsed_record["status"]
    ))
    conn.commit()
    conn.close()

    return {"status": "processed", "record": parsed_record}

@app.get("/api/metrics")
def get_metrics():
    """Returns aggregated revenue metrics for dashboard."""
    try:
        metrics = compute_aggregate_metrics()
        return metrics
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute metrics: {str(err)}"
        )

@app.get("/api/audit-logs")
def get_audit_logs():
    """Returns recent audit logs for the dashboard live feed."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.id, r.event_type, r.amount, r.currency, r.error_code, r.error_description, r.status, r.created_at,
               d.root_cause, d.confidence_score, d.reasoning,
               i.action_type, i.channel, i.status AS intervention_status
        FROM revenue_at_risk r
        LEFT JOIN diagnoses d ON r.id = d.revenue_at_risk_id
        LEFT JOIN interventions i ON r.id = i.revenue_at_risk_id
        ORDER BY r.created_at DESC LIMIT 50
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"audit_logs": rows}

@app.post("/api/interventions/run-all")
def run_all_interventions():
    """Processes pending interventions and runs execution & diagnosis."""
    from intelligence.diagnosis.llmClassifier import classify_error
    from intelligence.decisionEngine.decisionRules import decide_action_for_cause
    from backend.executor.runIntervention import execute_intervention
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Diagnose open revenue_at_risk items without diagnosis
    cursor.execute("""
        SELECT id, error_code, error_description, amount FROM revenue_at_risk WHERE id NOT IN (SELECT revenue_at_risk_id FROM diagnoses)
    """)
    unprocessed = cursor.fetchall()
    
    for item in unprocessed:
        diag = classify_error(item["error_code"] or "", item["error_description"] or "")
        diag_id = f"diag_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO diagnoses (id, revenue_at_risk_id, root_cause, classifier_type, confidence_score, reasoning)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (diag_id, item["id"], diag["root_cause"], diag["classifier_type"], diag["confidence_score"], diag["reasoning"]))
        
        decision = decide_action_for_cause(diag["root_cause"])
        interv_id = f"int_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO interventions (id, revenue_at_risk_id, diagnosis_id, action_type, channel, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        """, (interv_id, item["id"], diag_id, decision["action"], decision["channel"]))

        cursor.execute("""
            INSERT INTO audit_logs (id, entity_type, entity_id, action, details)
            VALUES (?, 'revenue_at_risk', ?, 'DIAGNOSED_AND_DECIDED', ?)
        """, (f"aud_{uuid.uuid4().hex[:8]}", item["id"], f"Root cause: {diag['root_cause']} -> Action: {decision['action']} via {decision['channel']}"))

    # 2. Execute pending interventions
    cursor.execute("""
        SELECT i.id, i.action_type, i.channel, i.attempt_number, r.amount, r.razorpay_entity_id, r.id as rar_id
        FROM interventions i
        JOIN revenue_at_risk r ON i.revenue_at_risk_id = r.id
        WHERE i.status = 'pending'
    """)
    pending = cursor.fetchall()
    executed_count = 0
    stopped_count = 0
    
    for row in pending:
        interv_dict = dict(row)
        res = execute_intervention(interv_dict)
        new_status = res.get("status", "executed")
        cursor.execute("UPDATE interventions SET status = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?", (new_status, row["id"]))
        
        # Log to audit_logs
        cursor.execute("""
            INSERT INTO audit_logs (id, entity_type, entity_id, action, details)
            VALUES (?, 'intervention', ?, ?, ?)
        """, (f"aud_{uuid.uuid4().hex[:8]}", row["id"], f"ACTION_{new_status.upper()}", res.get("reason") or res.get("error") or "Executed successfully via Razorpay API"))
        
        if new_status == "executed":
            executed_count += 1
        elif new_status == "stopped":
            stopped_count += 1
            
    conn.commit()
    conn.close()
    return {"executed": executed_count, "stopped": stopped_count, "diagnosed": len(unprocessed)}

@app.post("/api/seed")
def trigger_seed():
    """Triggers test event database seeding."""
    try:
        seed_test_events()
        # Auto-run diagnosis & decision pipeline on seeded events
        run_all_interventions()
        return {"status": "success", "message": "Simulated Razorpay test events seeded & pipeline executed successfully"}
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding failed: {str(err)}"
        )


@app.post("/api/payments/create-order")
def create_payment_order(payment: PaymentOrderRequest):
    """Creates a Razorpay order; the secret key never leaves the server."""
    try:
        client = get_razorpay_client()
        order = client.order.create({
            "amount": int(round(payment.amount * 100)),
            "currency": payment.currency.upper(),
            "receipt": f"recoverai_{uuid.uuid4().hex[:16]}",
            "notes": {"source": "recoverai_dashboard"}
        })
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": KEY_ID,
            "customer": {
                "name": payment.customer_name,
                "email": payment.customer_email,
                "contact": payment.customer_contact,
            },
        }
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to create Razorpay order: {str(err)}"
        )


@app.post("/api/payments/verify")
def verify_payment(payment: PaymentVerificationRequest):
    """Verifies the Checkout signature using Razorpay's server-side SDK."""
    try:
        get_razorpay_client().utility.verify_payment_signature({
            "razorpay_order_id": payment.razorpay_order_id,
            "razorpay_payment_id": payment.razorpay_payment_id,
            "razorpay_signature": payment.razorpay_signature,
        })
        return {"status": "verified", "payment_id": payment.razorpay_payment_id}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Razorpay payment verification failed"
        )

# Serve static frontend web application
if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

    @app.get("/")
    def read_root():
        index_page = FRONTEND_DIR / "pages" / "index.html"
        if index_page.exists():
            return FileResponse(index_page)
        return {"message": "RecoverAI Python Platform running."}
