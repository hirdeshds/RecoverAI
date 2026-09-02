from backend.razorpay.paymentLinksApi import create_payment_link
from backend.razorpay.invoicesApi import resend_invoice
from backend.razorpay.subscriptionsApi import retry_subscription_charge
from backend.executor.stoppingRules import should_stop_intervention

def execute_intervention(intervention: dict) -> dict:
    """Reads an intervention record and executes the corresponding Razorpay recovery action."""
    action_type = intervention.get("action_type")
    razorpay_entity_id = intervention.get("razorpay_entity_id")
    amount = float(intervention.get("amount") or 100.0)
    attempts = int(intervention.get("attempt_number") or 1)

    # Check stopping rules first
    stop_check = should_stop_intervention(attempts=attempts, amount=amount)
    if stop_check["stop"]:
        return {"status": "stopped", "reason": stop_check["reason"]}

    try:
        if action_type == "send_payment_link":
            result = create_payment_link(amount=amount, currency="INR", description="Revenue Recovery")
            return {"status": "executed", "result": result}
        elif action_type == "resend_invoice":
            result = resend_invoice(razorpay_entity_id)
            return {"status": "executed", "result": result}
        elif action_type == "retry_charge":
            result = retry_subscription_charge(razorpay_entity_id)
            return {"status": "executed", "result": result}
    except Exception as err:
        return {"status": "failed", "error": str(err)}

    return {"status": "skipped", "reason": f"Unknown action type '{action_type}'"}
