import uuid

def parse_webhook_payload(payload: dict) -> dict:
    """
    Transforms raw Razorpay webhook payload into normalized revenue_at_risk dict/row.
    """
    event = payload.get("event", "")
    entity_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
    
    amount = entity_data.get("amount", 0) / 100.0 if "amount" in entity_data else 0.0
    currency = entity_data.get("currency", "INR")
    razorpay_entity_id = entity_data.get("id", payload.get("account_id", ""))
    
    error_code = entity_data.get("error_code", "UNKNOWN_ERROR")
    error_description = entity_data.get("error_description", "Webhook payload received")

    return {
        "id": f"rar_{uuid.uuid4().hex[:8]}",
        "customer_id": entity_data.get("customer_id", "cust_unknown"),
        "event_type": event,
        "amount": amount,
        "currency": currency,
        "razorpay_entity_id": razorpay_entity_id,
        "error_code": error_code,
        "error_description": error_description,
        "status": "open"
    }
