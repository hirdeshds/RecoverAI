# RecoverAI

AI Revenue Recovery Agent platform for Razorpay integration.

## Directory Structure

```text
├── README.md
├── .env.example
├── .env (gitignored)
├── requirements.txt
│
├── db/
│   ├── schema.sql              # The 7 core database tables
│   ├── migrations/             # SQL schema migrations
│   └── seed_test_events.py     # Simulates failed payments, checkout, subs, invoices
│
├── backend/                    # Hirdesh's domain
│   ├── main.py                 # FastAPI application entrypoint
│   ├── webhooks/
│   │   ├── receiver.py         # Endpoint, signature verification, deduplication
│   │   └── eventParser.py      # Raw payload -> revenue_at_risk row
│   ├── razorpay/
│   │   ├── client.py           # Thin SDK wrapper, auth
│   │   ├── paymentsApi.py      # GET /payments/{id}, /orders/{id}/payments
│   │   ├── paymentLinksApi.py  # Create/send Payment Links
│   │   ├── invoicesApi.py      # Create/resend Invoices
│   │   ├── subscriptionsApi.py # Subscription retry/card update helpers
│   │   └── getFailureContext.py# Shared interface for diagnosis
│   ├── executor/
│   │   ├── stoppingRules.py    # Max attempts, cooldown, opt-out, dollar threshold gate
│   │   ├── backoff.py          # Exponential backoff on 429s
│   │   └── runIntervention.py  # Reads pending interventions & executes action
│   ├── promiseToPay/
│   │   └── checker.py          # Cron/polling checker, marks honored/missed
│   └── metrics/
│       └── aggregate.py        # Metrics aggregation endpoint logic
│
└── intelligence/               # Mahek's domain
    ├── diagnosis/
    │   ├── rulesClassifier.py  # Error code -> root cause classification
    │   └── llmClassifier.py    # Ambiguous case fallback + confidence
    ├── decisionEngine/
    │   ├── decisionRules.py    # Root cause -> action + channel + timing
    │   └── escalationLadder.py # Escalation logic (day 0-3, 4-14, 15-30, 30+)
    └── templates/
        └── messageTemplates.py # Pre-approved message library
```

## Setup & Running

1. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Update keys in .env
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Database Setup & Seeding**:
   ```bash
   python db/seed_test_events.py
   ```

4. **Run Server**:
   ```bash
   uvicorn backend.main:app --reload
   ```
