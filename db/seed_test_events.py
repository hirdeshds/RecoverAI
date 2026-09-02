"""
Simulates failed payments, abandoned checkout, halted subscriptions, and overdue invoices via Razorpay test mode / mock data.
"""
import sqlite3
import os
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "recoverai.db")

def seed_events():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Load schema if tables do not exist
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r") as f:
            cursor.executescript(f.read())

    print("Seeding test events...")
    
    # 1. Seed Sample Customer
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    cursor.execute(
        "INSERT OR IGNORE INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)",
        (cust_id, "Test User", "test@example.com", "+919876543210")
    )

    # 2. Seed Failed Payment Event
    cursor.execute(
        """INSERT INTO revenue_at_risk 
           (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f"rar_{uuid.uuid4().hex[:8]}", cust_id, "payment_failed", 1499.00, "INR", "pay_test123", "BAD_REQUEST_PAYMENT_TIMED_OUT", "Bank server response timed out", "open")
    )

    # 3. Seed Abandoned Checkout Event
    cursor.execute(
        """INSERT INTO revenue_at_risk 
           (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f"rar_{uuid.uuid4().hex[:8]}", cust_id, "checkout_abandoned", 2999.00, "INR", "ord_test456", "CHECKOUT_DISMISSED", "User closed modal before payment", "open")
    )

    # 4. Seed Halted Subscription Event
    cursor.execute(
        """INSERT INTO revenue_at_risk 
           (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f"rar_{uuid.uuid4().hex[:8]}", cust_id, "sub_halted", 999.00, "INR", "sub_test789", "CARD_EXPIRED", "Recurring charge failed due to expired card", "open")
    )

    # 5. Seed Overdue Invoice Event
    cursor.execute(
        """INSERT INTO revenue_at_risk 
           (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f"rar_{uuid.uuid4().hex[:8]}", cust_id, "invoice_overdue", 5000.00, "INR", "inv_test101", "INVOICE_EXPIRED", "Invoice payment deadline passed", "open")
    )

    conn.commit()
    conn.close()
    print("Test events seeded successfully.")

if __name__ == "__main__":
    seed_events()
