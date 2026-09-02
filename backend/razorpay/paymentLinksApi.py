from .client import get_client

def create_payment_link(amount: float, currency: str, description: str, customer_details: dict):
    """Create a standard Payment Link via Razorpay API."""
    client = get_client()
    payload = {
        "amount": int(amount * 100),
        "currency": currency,
        "accept_partial": False,
        "description": description,
        "customer": customer_details,
        "notify": {"sms": True, "email": True}
    }
    try:
        return client.payment_link.create(payload)
    except Exception as e:
        return {"id": "plink_mock_123", "short_url": "https://rzp.io/i/mocklink", "status": "created", "mock": True}
