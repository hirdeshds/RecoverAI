# seed_data.py
import random
import uuid

from app.db import SessionLocal, init_db
from app.models import Case, CaseEvent

SOURCES = [
    ("payment", ["expired_card", "insufficient_funds", "issuer_soft_decline"], (20, 500), "USD"),
    ("checkout", ["checkout_timeout", "payment_method_unavailable"], (50, 800), "USD"),
    ("invoice", ["invoice_overdue", "disputed_invoice"], (5000, 150000), "INR"),
    ("subscription", ["subscription_payment_failed", "insufficient_funds"], (10, 120), "USD"),
    ("mandate", ["mandate_failed"], (500, 5000), "INR"),
]

def generate_seed(count: int = 150, clear_existing: bool = False):
    init_db()
    db = SessionLocal()

    if clear_existing:
        db.query(CaseEvent).delete()
        db.query(Case).delete()
        db.commit()

    print(f"Generating {count} synthetic cases...")
    for _ in range(count):
        source, reasons, (min_amt, max_amt), currency = random.choice(SOURCES)
        reason = random.choice(reasons)
        amount = round(random.uniform(min_amt, max_amt), 2)

        case_id = str(uuid.uuid4())
        customer_id = f"cust_{random.randint(1000, 9999)}"
        case = Case(
            id=case_id,
            source=source,
            customer_id=customer_id,
            amount_at_risk=amount,
            currency=currency,
            status="open",
            attempts=0,
        )
        db.add(case)
        db.flush()

        event = CaseEvent(
            case_id=case_id,
            event_type="detected",
            payload={
                "source": source,
                "customer_id": customer_id,
                "amount_at_risk": amount,
                "currency": currency,
                "raw_reason_code": reason,
                "metadata": {"seed": True},
            },
        )
        db.add(event)

    db.commit()
    db.close()
    print("Seed complete.")

if __name__ == "__main__":
    generate_seed()
