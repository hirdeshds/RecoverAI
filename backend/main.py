from fastapi import FastAPI, Request, HTTPException
import sqlite3
import os

from .webhooks.receiver import verify_signature, is_duplicate
from .webhooks.eventParser import parse_webhook_payload
from .metrics.aggregate import compute_aggregate_metrics

app = FastAPI(title="RecoverAI Backend API")
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "recoverai.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()

@app.get("/health")
def health():
    return {"status": "ok", "system": "RecoverAI"}

@app.post("/webhooks/razorpay")
async def handle_razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    if not verify_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = await request.json()
    event_id = payload.get("account_id", "") + str(payload.get("created_at", ""))
    
    if is_duplicate(event_id):
        return {"status": "ignored", "reason": "duplicate_event"}

    parsed_event = parse_webhook_payload(payload)
    return {"status": "received", "event": parsed_event}

@app.get("/api/metrics")
def get_metrics():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    metrics = compute_aggregate_metrics(cursor)
    conn.close()
    return metrics
