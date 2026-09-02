from .paymentsApi import fetch_payment

def get_failure_context(entity_id: str, event_type: str) -> dict:
    """
    Shared interface used by Mahek's diagnosis module to gather full context 
    around a failure (error codes, network response details, payment method type).
    """
    if event_type == "payment_failed":
        details = fetch_payment(entity_id)
        return {
            "entity_id": entity_id,
            "error_code": details.get("error_code", "UNKNOWN_ERROR"),
            "error_description": details.get("error_description", "No description provided"),
            "method": details.get("method", "card"),
            "raw": details
        }
    return {
        "entity_id": entity_id,
        "error_code": "EVENT_DEFAULT_ERROR",
        "error_description": f"Failure context for {event_type}",
        "method": "unknown",
        "raw": {}
    }
