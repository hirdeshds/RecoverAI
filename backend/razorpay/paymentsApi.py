from .client import get_client

def fetch_payment(payment_id: str):
    """GET /payments/{id}"""
    client = get_client()
    try:
        return client.payment.fetch(payment_id)
    except Exception as e:
        return {"error": str(e), "id": payment_id}

def fetch_order_payments(order_id: str):
    """GET /orders/{id}/payments"""
    client = get_client()
    try:
        return client.order.payments(order_id)
    except Exception as e:
        return {"error": str(e), "order_id": order_id}
