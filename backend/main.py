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

@app.post("/api/seed")
def trigger_seed():
    """Triggers test event database seeding."""
    try:
        seed_test_events()
        return {"status": "success", "message": "Simulated Razorpay test events seeded successfully"}
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
