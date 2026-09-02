import os
try:
    import razorpay
except ImportError:
    razorpay = None

from dotenv import load_dotenv

load_dotenv()

KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_dummy_key")
KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret")

class MockRazorpayClient:
    class MockOrder:
        def create(self, data):
            return {"id": "ord_mock123", "amount": data["amount"], "currency": data["currency"]}
    def __init__(self):
        self.order = self.MockOrder()

def get_razorpay_client():
    """Initializes and returns thin Razorpay SDK client."""
    if razorpay is None:
        return MockRazorpayClient()
    return razorpay.Client(auth=(KEY_ID, KEY_SECRET))
