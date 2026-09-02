import hmac
import hashlib
import os

WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "test_secret")

def verify_signature(payload_body: bytes, signature: str) -> bool:
    """Verify webhook payload signature against RAZORPAY_WEBHOOK_SECRET."""
    if not signature:
        return False
    expected = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# In-memory deduplication set (or cache connection)
PROCESSED_EVENTS = set()

def is_duplicate(event_id: str) -> bool:
    if event_id in PROCESSED_EVENTS:
        return True
    PROCESSED_EVENTS.add(event_id)
    return False
