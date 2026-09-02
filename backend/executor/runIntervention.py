from ..razorpay.paymentLinksApi import create_payment_link
from ..razorpay.invoicesApi import resend_invoice
from ..razorpay.subscriptionsApi import retry_subscription

def run_intervention(intervention: dict) -> dict:
    """
    Reads intervention (status=pending) and executes recovery action based on action_type.
    """
    action_type = intervention.get("action_type")
    
    if action_type == "send_payment_link":
        res = create_payment_link(
            amount=intervention.get("amount", 100.0),
            currency="INR",
            description="Recovery Payment Link",
            customer_details=intervention.get("customer", {})
        )
        return {"status": "executed", "result": res}
    
    elif action_type == "resend_invoice":
        res = resend_invoice(intervention.get("razorpay_entity_id", ""))
        return {"status": "executed", "result": res}

    elif action_type == "retry_charge":
        res = retry_subscription(intervention.get("razorpay_entity_id", ""))
        return {"status": "executed", "result": res}

    return {"status": "skipped", "reason": f"Unknown action_type {action_type}"}
