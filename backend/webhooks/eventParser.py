import random
import string

def parse_webhook_payload(payload: dict) -> dict:
    """Converts a raw Razorpay webhook payload into a revenue_at_risk record dict."""
    event_type = payload.get("event", "")
    entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    amount_paise = entity.get("amount", 0)
    amount_rupees = float(amount_paise) / 100.0 if amount_paise else 0.0

    currency = entity.get("currency", "INR")
    razorpay_id = entity.get("id") or payload.get("account_id") or ""
    error_code = entity.get("error_code") or "UNKNOWN_ERROR"
    error_desc = entity.get("error_description") or "Webhook payload received"
    customer_id = entity.get("customer_id") or "cust_unknown"

    rand_suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))

    return {
        "id": f"rar_{rand_suffix}",
        "customer_id": customer_id,
        "event_type": event_type,
        "amount": amount_rupees,
        "currency": currency,
        "razorpay_entity_id": razorpay_id,
        "error_code": error_code,
        "error_description": error_desc,
        "status": "open"
    }
