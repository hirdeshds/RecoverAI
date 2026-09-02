RULE_BUCKETS = {
    "BAD_REQUEST_PAYMENT_TIMED_OUT": "bank_timeout",
    "GATEWAY_ERROR": "gateway_downtime",
    "CARD_EXPIRED": "card_expired",
    "INSUFFICIENT_FUNDS": "insufficient_balance",
    "CHECKOUT_DISMISSED": "user_abandoned",
    "INVOICE_EXPIRED": "invoice_expired"
}

def classify_by_rules(error_code: str) -> dict:
    """Maps error_code to root_cause bucket."""
    root_cause = RULE_BUCKETS.get(error_code)
    if root_cause:
        return {
            "root_cause": root_cause,
            "classifier_type": "rules",
            "confidence_score": 1.0,
            "reasoning": f"Exact rule match for error code {error_code}"
        }
    return {
        "root_cause": "ambiguous",
        "classifier_type": "rules",
        "confidence_score": 0.0,
        "reasoning": f"Unrecognized error code: {error_code}"
    }
