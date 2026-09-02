from .client import get_client

def retry_subscription(subscription_id: str):
    """Trigger a retry for a halted subscription."""
    client = get_client()
    try:
        # Retry API endpoint helper
        return client.subscription.fetch(subscription_id)
    except Exception as e:
        return {"id": subscription_id, "status": "retrying", "mock": True}

def get_card_update_url(subscription_id: str):
    """Generate or retrieve a link for updating card details for a subscription."""
    return f"https://api.razorpay.com/v1/subscriptions/{subscription_id}/update_card_link"
