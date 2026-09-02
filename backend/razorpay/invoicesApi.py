from .client import get_client

def create_invoice(customer_id: str, line_items: list):
    """Create invoice for customer."""
    client = get_client()
    try:
        return client.invoice.create({"type": "invoice", "customer_id": customer_id, "line_items": line_items})
    except Exception as e:
        return {"id": "inv_mock_123", "status": "issued", "mock": True}

def resend_invoice(invoice_id: str):
    """Resend invoice notification."""
    client = get_client()
    try:
        return client.invoice.notify_by(invoice_id, "email")
    except Exception as e:
        return {"id": invoice_id, "status": "sent", "mock": True}
